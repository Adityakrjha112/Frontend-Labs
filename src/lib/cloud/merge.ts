/**
 * Merging local (signed-out) data into a user's cloud data.
 *
 * Rules: nothing is overwritten wholesale. Every field is combined so no
 * progress is lost. Set-like data (bookmarks, tasks, logs, notes, statuses)
 * merges idempotently; counts (attempts, visits) are added, so migrate.ts
 * guarantees the same local data is never merged twice.
 */
import type { PersistedState, QuestionRecord } from "../storage";
import type { Session } from "../session";
import type { Day, LogEntry, RoadmapState, Status } from "@/roadmap/state";
import { MAX_NOTE } from "@/roadmap/state";

const union = (a: readonly string[], b: readonly string[]) => [...new Set([...a, ...b])];

/* ------------------------------------------------------------------ */
/* Practice                                                            */
/* ------------------------------------------------------------------ */

function sameRecord(a: QuestionRecord, b: QuestionRecord) {
  return a.attempts === b.attempts && a.successes === b.successes && a.lastOutcome === b.lastOutcome && a.lastAttemptAt === b.lastAttemptAt;
}

/** Combines attempts from both sides; the latest attempt decides the last outcome. */
export function mergeRecord(a: QuestionRecord, b: QuestionRecord): QuestionRecord {
  if (sameRecord(a, b)) return a;
  const latest = Date.parse(b.lastAttemptAt) > Date.parse(a.lastAttemptAt) ? b : a;
  return {
    attempts: a.attempts + b.attempts,
    successes: a.successes + b.successes,
    lastOutcome: latest.lastOutcome,
    lastAttemptAt: latest.lastAttemptAt,
  };
}

const newer = (a: Session | null, b: Session | null, key: "createdAt" | "completedAt"): Session | null => {
  if (!a) return b;
  if (!b) return a;
  return Date.parse(b[key] ?? b.createdAt) > Date.parse(a[key] ?? a.createdAt) ? b : a;
};

export function mergePractice(cloud: PersistedState, local: PersistedState): PersistedState {
  const progress: Record<string, QuestionRecord> = { ...cloud.progress };
  for (const [id, rec] of Object.entries(local.progress)) {
    progress[id] = progress[id] ? mergeRecord(progress[id]!, rec) : rec;
  }
  return {
    version: cloud.version,
    progress,
    bookmarks: union(cloud.bookmarks, local.bookmarks),
    reviewQueue: union(cloud.reviewQueue, local.reviewQueue),
    activityDays: union(cloud.activityDays, local.activityDays).sort(),
    // Answers in either session were already recorded in `progress`, so keeping
    // the most recent session loses no results.
    activeSession: newer(cloud.activeSession, local.activeSession, "createdAt"),
    lastSession: newer(cloud.lastSession, local.lastSession, "completedAt"),
    // An existing account's preference wins over this device's default.
    preferences: { timer: cloud.preferences.timer || local.preferences.timer },
  };
}

/* ------------------------------------------------------------------ */
/* Roadmap                                                             */
/* ------------------------------------------------------------------ */

const STATUS_RANK: Record<Status, number> = { "not-started": 0, "in-progress": 1, completed: 2 };

/** Marker used when two different notes for the same week are combined. */
export const NOTE_SEPARATOR = "\n\n--- Merged from this device ---\n";

export function mergeNotes(cloud: string | undefined, local: string | undefined): string | undefined {
  if (!local) return cloud;
  if (!cloud) return local;
  if (cloud === local || cloud.includes(local)) return cloud;
  if (local.includes(cloud)) return local;
  return `${cloud}${NOTE_SEPARATOR}${local}`.slice(0, MAX_NOTE);
}

function mergeDay(a: Day | undefined, b: Day | undefined): Day {
  const logs: LogEntry[] = [...(a?.logs ?? [])];
  const ids = new Set(logs.map((l) => l.id));
  for (const l of b?.logs ?? []) if (!ids.has(l.id)) logs.push(l);
  logs.sort((x, y) => Date.parse(x.at) - Date.parse(y.at));
  return { logs, tasks: union(a?.tasks ?? [], b?.tasks ?? []) };
}

export function mergeRoadmap(cloud: RoadmapState, local: RoadmapState): RoadmapState {
  const topics: RoadmapState["topics"] = { ...cloud.topics };
  for (const [id, st] of Object.entries(local.topics)) {
    if (!topics[id] || STATUS_RANK[st] > STATUS_RANK[topics[id]!]) topics[id] = st;
  }

  const tasks: RoadmapState["tasks"] = { ...cloud.tasks };
  for (const [id, at] of Object.entries(local.tasks)) {
    // Keep the earliest completion time.
    if (!tasks[id] || Date.parse(at) < Date.parse(tasks[id]!)) tasks[id] = at;
  }

  const notes: RoadmapState["notes"] = {};
  for (const id of union(Object.keys(cloud.notes), Object.keys(local.notes))) {
    const n = mergeNotes(cloud.notes[id], local.notes[id]);
    if (n) notes[id] = n;
  }

  const activity: RoadmapState["activity"] = {};
  for (const day of union(Object.keys(cloud.activity), Object.keys(local.activity))) {
    activity[day] = mergeDay(cloud.activity[day], local.activity[day]);
  }

  const visits: RoadmapState["visits"] = { ...cloud.visits };
  for (const [day, n] of Object.entries(local.visits)) {
    const c = visits[day];
    visits[day] = c === undefined || c === n ? n : c + n;
  }

  return {
    ...cloud,
    topics,
    tasks,
    notes,
    activity,
    visits,
    prefs: {
      theme: cloud.prefs.theme !== "system" ? cloud.prefs.theme : local.prefs.theme,
      filter: cloud.prefs.filter,
      open: { ...local.prefs.open, ...cloud.prefs.open },
    },
  };
}

/** True when a state holds nothing worth migrating. */
export function practiceIsEmpty(s: PersistedState): boolean {
  return (
    Object.keys(s.progress).length === 0 &&
    s.bookmarks.length === 0 &&
    s.reviewQueue.length === 0 &&
    s.activityDays.length === 0 &&
    !s.activeSession &&
    !s.lastSession &&
    !s.preferences.timer
  );
}

export function roadmapIsEmpty(s: RoadmapState): boolean {
  return (
    Object.keys(s.topics).length === 0 &&
    Object.keys(s.tasks).length === 0 &&
    Object.keys(s.notes).length === 0 &&
    Object.keys(s.activity).length === 0 &&
    Object.keys(s.visits).length === 0 &&
    Object.keys(s.prefs.open).length === 0 &&
    s.prefs.theme === "system" &&
    s.prefs.filter === "all"
  );
}
