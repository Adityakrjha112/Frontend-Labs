/**
 * Moves signed-out (localStorage) data into the signed-in user's cloud data.
 * Independent of Firebase: the caller supplies an adapter, so it is testable.
 *
 * Counts (attempts, visits) are added together when merging, so the same
 * local data must never be merged twice. Two safeguards make that true:
 *  1. Each local snapshot is fingerprinted, and the fingerprint is stored in
 *     the account in the same atomic write as the merged data. A snapshot
 *     whose fingerprint is already recorded is not merged again.
 *  2. If local data changes while the upload is in flight, only the
 *     difference since the uploaded snapshot is merged in the next round.
 */
import {
  defaultState as defaultPractice,
  loadState as loadPractice,
  sanitizeState,
  STORAGE_KEY as PRACTICE_KEY,
  type PersistedState,
  type QuestionRecord,
  type StorageLike,
} from "../storage";
import {
  defaultState as defaultRoadmap,
  loadState as loadRoadmap,
  sanitize as sanitizeRoadmap,
  STORAGE_KEY as ROADMAP_KEY,
  type RoadmapState,
} from "@/roadmap/state";
import { mergePractice, mergeRoadmap, practiceIsEmpty, roadmapIsEmpty } from "./merge";

export interface LocalSnapshot {
  practice: string | null;
  roadmap: string | null;
}

export interface CloudData {
  practice: PersistedState;
  roadmap: RoadmapState;
}

export interface CloudRaw {
  practice: unknown;
  roadmap: unknown;
  /** Fingerprints of local snapshots already merged into this account. */
  merged?: unknown;
}

export interface MigrationAdapter {
  readLocal(): LocalSnapshot;
  /** Removes the given local keys only if their raw text is still `expected`. Returns false if anything changed. */
  clearLocal(keys: (keyof LocalSnapshot)[], expected: LocalSnapshot): boolean;
  readCloud(): Promise<CloudRaw>;
  /** Writes both stores and records the fingerprint, atomically. */
  writeCloud(data: CloudData, fingerprint: string): Promise<void>;
}

export interface MigrationResult extends CloudData {
  /** True when local data was merged into the account. */
  migrated: boolean;
  /** Counts of what came from this device, for the confirmation message. */
  fromDevice: { questions: number; tasks: number; notes: number };
}

/** FNV-1a 32-bit, as hex: a short, database-key-safe fingerprint. */
export function fingerprint(snap: LocalSnapshot): string {
  const text = `${snap.practice ?? ""}\u0000${snap.roadmap ?? ""}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `fp${h.toString(16).padStart(8, "0")}${text.length.toString(16)}`;
}

function memStorage(key: string, raw: string | null): StorageLike {
  const data = new Map<string, string>(raw === null ? [] : [[key, raw]]);
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
}

export function parseCloud(raw: CloudRaw, known?: ReadonlySet<string>): CloudData {
  return {
    practice: raw.practice ? sanitizeState(raw.practice, known) : defaultPractice(),
    roadmap: raw.roadmap ? sanitizeRoadmap(raw.roadmap).state : defaultRoadmap(),
  };
}

/** What `now` adds on top of `base` for count fields; set-like fields merge idempotently anyway. */
export function practiceDelta(now: PersistedState, base: PersistedState): PersistedState {
  const progress: Record<string, QuestionRecord> = {};
  for (const [id, r] of Object.entries(now.progress)) {
    const b = base.progress[id];
    if (!b) progress[id] = r;
    else if (r.attempts > b.attempts) {
      progress[id] = {
        attempts: r.attempts - b.attempts,
        successes: Math.max(0, r.successes - b.successes),
        lastOutcome: r.lastOutcome,
        lastAttemptAt: r.lastAttemptAt,
      };
    }
  }
  return { ...now, progress };
}

export function roadmapDelta(now: RoadmapState, base: RoadmapState): RoadmapState {
  const visits: Record<string, number> = {};
  for (const [day, n] of Object.entries(now.visits)) {
    const diff = n - (base.visits[day] ?? 0);
    if (diff > 0) visits[day] = diff;
  }
  return { ...now, visits };
}

export async function migrateLocalToCloud(adapter: MigrationAdapter, known?: ReadonlySet<string>, maxRounds = 3): Promise<MigrationResult> {
  const raw = await adapter.readCloud();
  let cloud = parseCloud(raw, known);
  const alreadyMerged = new Set(raw.merged && typeof raw.merged === "object" ? Object.keys(raw.merged) : []);
  let migrated = false;
  const fromDevice = { questions: 0, tasks: 0, notes: 0 };
  let base: CloudData | null = null; // the local data already uploaded in an earlier round

  for (let round = 0; round < maxRounds; round++) {
    const snap = adapter.readLocal();
    const practice = loadPractice(memStorage(PRACTICE_KEY, snap.practice), known);
    const roadmap = loadRoadmap(memStorage(ROADMAP_KEY, snap.roadmap));

    // Unreadable local data is never cleared, so its recovery backup still works.
    const practiceOk = snap.practice !== null && practice.status === "ok";
    const roadmapOk = snap.roadmap !== null && roadmap.banner?.error !== true;
    const keys = [...(practiceOk ? (["practice"] as const) : []), ...(roadmapOk ? (["roadmap"] as const) : [])];
    const local: CloudData = {
      practice: practiceOk ? practice.state : defaultPractice(),
      roadmap: roadmapOk ? roadmap.state : defaultRoadmap(),
    };

    const fp = fingerprint(snap);
    const nothingNew = (practiceIsEmpty(local.practice) && roadmapIsEmpty(local.roadmap)) || alreadyMerged.has(fp);
    if (nothingNew) {
      if (adapter.clearLocal(keys, snap)) return { ...cloud, migrated, fromDevice };
      continue;
    }

    if (round === 0 || !base) {
      fromDevice.questions = Object.keys(local.practice.progress).length;
      fromDevice.tasks = Object.keys(local.roadmap.tasks).length;
      fromDevice.notes = Object.keys(local.roadmap.notes).length;
    }

    const toMerge = base
      ? { practice: practiceDelta(local.practice, base.practice), roadmap: roadmapDelta(local.roadmap, base.roadmap) }
      : local;
    cloud = { practice: mergePractice(cloud.practice, toMerge.practice), roadmap: mergeRoadmap(cloud.roadmap, toMerge.roadmap) };
    await adapter.writeCloud(cloud, fp);
    alreadyMerged.add(fp);
    migrated = true;
    base = local;

    if (adapter.clearLocal(keys, snap)) return { ...cloud, migrated, fromDevice };
    // Local data changed during the upload: the next round merges only the difference.
  }
  throw new Error("Local data kept changing during sign-in, so it was left on this device. Try signing in again.");
}
