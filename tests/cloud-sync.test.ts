import { describe, expect, it } from "vitest";
import { defaultState as defaultPractice, recordOutcome, toggleBookmark, STORAGE_KEY as PRACTICE_KEY, type PersistedState } from "@/lib/storage";
import { createSession } from "@/lib/session";
import {
  addLog,
  defaultState as defaultRoadmap,
  setNote,
  setStatus,
  setTask,
  STORAGE_KEY as ROADMAP_KEY,
  type RoadmapState,
} from "@/roadmap/state";
import { mergeNotes, mergePractice, mergeRecord, mergeRoadmap, NOTE_SEPARATOR, practiceIsEmpty, roadmapIsEmpty } from "@/lib/cloud/merge";
import { fingerprint, migrateLocalToCloud, practiceDelta, type CloudData, type CloudRaw, type LocalSnapshot, type MigrationAdapter } from "@/lib/cloud/migrate";

const KNOWN = new Set(["JS-001", "JS-002", "JS-003"]);
const D1 = new Date("2026-11-01T10:00:00Z");
const D2 = new Date("2026-11-05T10:00:00Z");

/* A cloud user with some history, and a device with signed-out progress. */
function cloudPractice(): PersistedState {
  let s = recordOutcome(defaultPractice(), "JS-001", "correct", D1);
  s = toggleBookmark(s, "JS-002");
  return { ...s, preferences: { timer: true } };
}
function localPractice(): PersistedState {
  let s = recordOutcome(defaultPractice(), "JS-001", "incorrect", D2);
  s = recordOutcome(s, "JS-003", "got-it", D2);
  return toggleBookmark(s, "JS-003");
}
function cloudRoadmap(): RoadmapState {
  let s = setTask(defaultRoadmap(), "w1-t1", true, D1).state;
  s = setNote(s, "w1", "cloud note");
  return { ...s, prefs: { ...s.prefs, theme: "dark" } };
}
function localRoadmap(): RoadmapState {
  let s = setTask(defaultRoadmap(), "w1-t2", true, D2).state;
  s = setStatus(s, "w1", "completed");
  s = setNote(s, "w1", "device note");
  s = setNote(s, "w2", "only on device");
  return addLog(s, { minutes: 30, kind: "Learn", topic: "w1", note: "" }, D2).state;
}

describe("merging practice data", () => {
  it("keeps everything from both sides", () => {
    const m = mergePractice(cloudPractice(), localPractice());
    expect(m.progress["JS-001"]).toEqual({ attempts: 2, successes: 1, lastOutcome: "incorrect", lastAttemptAt: D2.toISOString() });
    expect(m.progress["JS-003"]).toMatchObject({ attempts: 1, lastOutcome: "got-it" });
    expect(m.bookmarks.sort()).toEqual(["JS-002", "JS-003"]);
    expect(m.reviewQueue).toEqual(["JS-001"]); // missed on the device
    expect(m.activityDays).toEqual(["2026-11-01", "2026-11-05"]);
    expect(m.preferences.timer).toBe(true);
  });

  it("merges set-like data idempotently (counts are guarded by the migration)", () => {
    const once = mergePractice(cloudPractice(), localPractice());
    const again = mergePractice(once, localPractice());
    expect(again.bookmarks).toEqual(once.bookmarks);
    expect(again.reviewQueue).toEqual(once.reviewQueue);
    expect(again.activityDays).toEqual(once.activityDays);
  });

  it("recognises identical records instead of double-counting them", () => {
    const r = { attempts: 3, successes: 2, lastOutcome: "correct" as const, lastAttemptAt: D1.toISOString() };
    expect(mergeRecord(r, { ...r })).toEqual(r);
  });

  it("keeps the most recent session in progress", () => {
    const older = createSession({ title: "Old", origin: "quick", questionIds: ["JS-001"], timerEnabled: false, now: D1, id: "a" });
    const newer = createSession({ title: "New", origin: "quick", questionIds: ["JS-002"], timerEnabled: false, now: D2, id: "b" });
    expect(mergePractice({ ...defaultPractice(), activeSession: older }, { ...defaultPractice(), activeSession: newer }).activeSession?.id).toBe("b");
    expect(mergePractice({ ...defaultPractice(), activeSession: newer }, { ...defaultPractice(), activeSession: null }).activeSession?.id).toBe("b");
  });
});

describe("merging roadmap data", () => {
  it("keeps tasks, the furthest status, logs and both notes", () => {
    const m = mergeRoadmap(cloudRoadmap(), localRoadmap());
    expect(Object.keys(m.tasks).sort()).toEqual(["w1-t1", "w1-t2"]);
    expect(m.topics.w1).toBe("completed");
    expect(m.notes.w1).toBe(`cloud note${NOTE_SEPARATOR}device note`);
    expect(m.notes.w2).toBe("only on device");
    expect(m.activity["2026-11-05"]?.logs).toHaveLength(1);
    expect(m.prefs.theme).toBe("dark"); // the account's choice wins
  });

  it("never downgrades a status and keeps the earliest completion time", () => {
    const cloud = setStatus(setTask(defaultRoadmap(), "w3-t1", true, D1).state, "w3", "completed");
    const local = setStatus(setTask(defaultRoadmap(), "w3-t1", true, D2).state, "w3", "in-progress");
    const m = mergeRoadmap(cloud, local);
    expect(m.topics.w3).toBe("completed");
    expect(m.tasks["w3-t1"]).toBe(D1.toISOString());
  });

  it("is idempotent for the same local data", () => {
    const local = localRoadmap(); // one instance: log IDs are random per creation
    const once = mergeRoadmap(cloudRoadmap(), local);
    expect(mergeRoadmap(once, local)).toEqual(once);
  });

  it("merges notes without repeating text", () => {
    expect(mergeNotes("abc", "abc")).toBe("abc");
    expect(mergeNotes("abc and more", "abc")).toBe("abc and more");
    expect(mergeNotes(undefined, "x")).toBe("x");
    expect(mergeNotes("x", undefined)).toBe("x");
  });

  it("treats default states as empty", () => {
    expect(practiceIsEmpty(defaultPractice())).toBe(true);
    expect(roadmapIsEmpty(defaultRoadmap())).toBe(true);
    expect(practiceIsEmpty(localPractice())).toBe(false);
    expect(roadmapIsEmpty(localRoadmap())).toBe(false);
  });
});

/* ------------------------------------------------------------------ */

function fakeEnv(local: LocalSnapshot, cloud: CloudRaw) {
  const env = {
    local: { ...local },
    cloud: { merged: {}, ...cloud } as CloudRaw & { merged: Record<string, string> },
    writes: 0,
    /** Simulates the user changing local data while the cloud write is in flight. */
    onWrite: undefined as undefined | (() => void),
  };
  const adapter: MigrationAdapter = {
    readLocal: () => ({ ...env.local }),
    clearLocal: (keys, expected) => {
      if (env.local.practice !== expected.practice || env.local.roadmap !== expected.roadmap) return false;
      for (const k of keys) env.local[k] = null;
      return true;
    },
    readCloud: async () => JSON.parse(JSON.stringify(env.cloud)),
    writeCloud: async (data: CloudData, fp: string) => {
      env.writes++;
      env.cloud = { ...JSON.parse(JSON.stringify(data)), merged: { ...env.cloud.merged, [fp]: "now" } };
      env.onWrite?.();
      env.onWrite = undefined;
    },
  };
  return { env, adapter };
}

const raw = (s: unknown) => JSON.stringify(s);

describe("migrating local data on sign-in", () => {
  it("merges local data into existing cloud data and clears the local copy", async () => {
    const snapshot = { practice: raw(localPractice()), roadmap: raw(localRoadmap()) };
    const { env, adapter } = fakeEnv(snapshot, { practice: cloudPractice(), roadmap: cloudRoadmap() });
    const r = await migrateLocalToCloud(adapter, KNOWN);
    expect(r.migrated).toBe(true);
    expect(r.fromDevice).toEqual({ questions: 2, tasks: 1, notes: 2 });
    expect(Object.keys(r.practice.progress).sort()).toEqual(["JS-001", "JS-003"]);
    expect(r.practice.bookmarks.sort()).toEqual(["JS-002", "JS-003"]);
    expect(r.roadmap.notes.w1).toContain("cloud note");
    expect(r.roadmap.notes.w1).toContain("device note");
    expect({ practice: env.cloud.practice, roadmap: env.cloud.roadmap }).toEqual(JSON.parse(raw({ practice: r.practice, roadmap: r.roadmap })));
    expect(Object.keys(env.cloud.merged)).toEqual([fingerprint(snapshot)]);
    expect(env.local).toEqual({ practice: null, roadmap: null });
  });

  it("uploads local data for a brand-new account", async () => {
    const { env, adapter } = fakeEnv({ practice: raw(localPractice()), roadmap: null }, { practice: null, roadmap: null });
    const r = await migrateLocalToCloud(adapter, KNOWN);
    expect(r.practice.progress["JS-003"]).toBeDefined();
    expect(env.writes).toBe(1);
  });

  it("does not write when there is nothing local to migrate", async () => {
    const { env, adapter } = fakeEnv({ practice: null, roadmap: null }, { practice: cloudPractice(), roadmap: cloudRoadmap() });
    const r = await migrateLocalToCloud(adapter, KNOWN);
    expect(r.migrated).toBe(false);
    expect(env.writes).toBe(0);
    expect(r.practice.progress["JS-001"]).toBeDefined();
  });

  it("is safe to repeat: the same local data is never counted twice", async () => {
    const local = { practice: raw(localPractice()), roadmap: raw(localRoadmap()) };
    const first = fakeEnv(local, { practice: cloudPractice(), roadmap: cloudRoadmap() });
    const r1 = await migrateLocalToCloud(first.adapter, KNOWN);
    expect(r1.practice.progress["JS-001"]?.attempts).toBe(2);
    // Simulate clearing the local copy having failed, then signing in again.
    const second = fakeEnv(local, first.env.cloud);
    const r2 = await migrateLocalToCloud(second.adapter, KNOWN);
    expect(second.env.writes).toBe(0);
    expect(r2.practice).toEqual(r1.practice);
    expect(r2.roadmap).toEqual(r1.roadmap);
    expect(r2.practice.progress["JS-001"]?.attempts).toBe(2);
    expect(second.env.local).toEqual({ practice: null, roadmap: null });
  });

  it("keeps unreadable local data on the device instead of deleting it", async () => {
    const { env, adapter } = fakeEnv({ practice: "{broken", roadmap: raw(localRoadmap()) }, { practice: null, roadmap: null });
    await migrateLocalToCloud(adapter, KNOWN);
    expect(env.local.practice).toBe("{broken");
    expect(env.local.roadmap).toBeNull();
  });

  it("merges again when local data changes during the upload, so nothing is lost", async () => {
    const { env, adapter } = fakeEnv({ practice: raw(localPractice()), roadmap: null }, { practice: null, roadmap: null });
    env.onWrite = () => {
      env.local.practice = raw(recordOutcome(localPractice(), "JS-002", "correct", D2));
    };
    const r = await migrateLocalToCloud(adapter, KNOWN);
    expect(env.writes).toBe(2);
    expect(r.practice.progress["JS-002"]).toBeDefined();
    // The records uploaded in the first round are not added a second time.
    expect(r.practice.progress["JS-001"]?.attempts).toBe(1);
    expect(r.practice.progress["JS-003"]?.attempts).toBe(1);
    expect(env.local.practice).toBeNull();
  });

  it("computes the difference between two local snapshots for counts", () => {
    const base = localPractice();
    const now = recordOutcome(base, "JS-001", "correct", D2);
    const d = practiceDelta(now, base);
    expect(d.progress).toEqual({ "JS-001": { attempts: 1, successes: 1, lastOutcome: "correct", lastAttemptAt: D2.toISOString() } });
  });

  it("fingerprints are stable and database-key safe", () => {
    const a = fingerprint({ practice: "x", roadmap: null });
    expect(a).toBe(fingerprint({ practice: "x", roadmap: null }));
    expect(a).not.toBe(fingerprint({ practice: "y", roadmap: null }));
    expect(a).toMatch(/^fp[0-9a-f]+$/);
  });

  it("survives the Realtime Database dropping empty objects and arrays", async () => {
    // RTDB stores no empty containers, so cloud data comes back without them.
    const sparse = { practice: { version: 1, progress: { "JS-001": cloudPractice().progress["JS-001"] } }, roadmap: { app: "fe-depth-tracker", schema: 1 } };
    const { adapter } = fakeEnv({ practice: null, roadmap: null }, sparse);
    const r = await migrateLocalToCloud(adapter, KNOWN);
    expect(r.practice.bookmarks).toEqual([]);
    expect(r.practice.activeSession).toBeNull();
    expect(r.roadmap.prefs).toEqual(defaultRoadmap().prefs);
    expect(r.practice.progress["JS-001"]).toBeDefined();
  });

  it("uses the same storage keys as the rest of the app", () => {
    expect(PRACTICE_KEY).toBe("frontend-lab:state");
    expect(ROADMAP_KEY).toBe("fe-depth-tracker:v1");
  });
});
