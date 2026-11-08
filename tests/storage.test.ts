import { describe, expect, it } from "vitest";
import {
  BACKUP_KEY,
  computeStreak,
  dayKey,
  defaultState,
  loadState,
  recordOutcome,
  resetState,
  saveState,
  STATE_VERSION,
  STORAGE_KEY,
  toggleBookmark,
  toggleReview,
  type StorageLike,
} from "@/lib/storage";
import { createSession } from "@/lib/session";

class MemoryStorage implements StorageLike {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

const KNOWN = new Set(["JS-001", "JS-002", "JS-003"]);
const NOW = new Date(2026, 10, 8, 14, 0); // 8 Nov 2026, local time

describe("save / load", () => {
  it("round-trips state", () => {
    const store = new MemoryStorage();
    let s = defaultState();
    s = recordOutcome(s, "JS-001", "correct", NOW);
    s = toggleBookmark(s, "JS-002");
    s = { ...s, activeSession: createSession({ title: "Quick 10", origin: "quick", questionIds: ["JS-001", "JS-002"], timerEnabled: true, now: NOW, id: "s1" }) };
    expect(saveState(store, s)).toBe(true);
    const { state, status } = loadState(store, KNOWN);
    expect(status).toBe("ok");
    expect(state).toEqual(s);
    expect(JSON.parse(store.getItem(STORAGE_KEY)!).version).toBe(STATE_VERSION);
  });

  it("returns defaults when nothing is stored", () => {
    expect(loadState(new MemoryStorage())).toEqual({ state: defaultState(), status: "empty" });
    expect(loadState(null).status).toBe("empty");
  });

  it("survives storage that throws", () => {
    const broken: StorageLike = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceeded");
      },
      removeItem: () => {
        throw new Error("nope");
      },
    };
    expect(loadState(broken).state).toEqual(defaultState());
    expect(saveState(broken, defaultState())).toBe(false);
    expect(resetState(broken)).toEqual(defaultState());
  });
});

describe("corrupted storage recovery", () => {
  it.each([
    ["invalid JSON", "{not json"],
    ["a JSON array", "[1,2,3]"],
    ["missing version", JSON.stringify({ progress: {} })],
    ["a future version", JSON.stringify({ ...defaultState(), version: 99 })],
    ["JSON null", "null"],
  ])("recovers from %s and keeps a backup", (_name, raw) => {
    const store = new MemoryStorage();
    store.setItem(STORAGE_KEY, raw);
    const { state, status } = loadState(store, KNOWN);
    expect(status).toBe("recovered");
    expect(state).toEqual(defaultState());
    expect(store.getItem(BACKUP_KEY)).toBe(raw);
  });

  it("drops malformed entries but keeps valid ones", () => {
    const store = new MemoryStorage();
    store.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: STATE_VERSION,
        progress: {
          "JS-001": { attempts: 2, successes: 1, lastOutcome: "missed", lastAttemptAt: NOW.toISOString() },
          "JS-002": { attempts: -1, successes: 0, lastOutcome: "correct", lastAttemptAt: NOW.toISOString() },
          "JS-003": { attempts: 1, successes: 2, lastOutcome: "correct", lastAttemptAt: NOW.toISOString() },
          "GONE-001": { attempts: 1, successes: 1, lastOutcome: "correct", lastAttemptAt: NOW.toISOString() },
        },
        bookmarks: ["JS-001", 42, "JS-001", "GONE-001"],
        reviewQueue: "JS-002",
        activityDays: ["2026-11-07", "yesterday", "2026-11-07"],
        activeSession: { id: "x", title: "t", origin: "hacked", questionIds: ["JS-001"], createdAt: NOW.toISOString() },
        lastSession: {
          id: "y",
          title: "t",
          origin: "quick",
          createdAt: NOW.toISOString(),
          questionIds: ["JS-001", "GONE-001", "JS-002"],
          currentIndex: 9,
          answers: { "JS-001": { kind: "mcq", selected: "Z", correct: true }, "JS-002": { kind: "skipped" } },
        },
        preferences: { timer: "yes" },
      }),
    );
    const { state, status } = loadState(store, KNOWN);
    expect(status).toBe("ok");
    expect(Object.keys(state.progress)).toEqual(["JS-001"]);
    expect(state.bookmarks).toEqual(["JS-001"]);
    expect(state.reviewQueue).toEqual([]);
    expect(state.activityDays).toEqual(["2026-11-07"]);
    expect(state.activeSession).toBeNull();
    expect(state.lastSession?.questionIds).toEqual(["JS-001", "JS-002"]);
    expect(state.lastSession?.currentIndex).toBe(1);
    expect(state.lastSession?.answers).toEqual({ "JS-002": { kind: "skipped" } });
    expect(state.preferences.timer).toBe(false);
  });
});

describe("streaks", () => {
  const days = (...d: string[]) => d;

  it("is zero with no activity", () => {
    expect(computeStreak([], NOW)).toEqual({ current: 0, longest: 0, activeToday: false });
  });

  it("counts consecutive days ending today", () => {
    expect(computeStreak(days("2026-11-06", "2026-11-07", "2026-11-08"), NOW)).toEqual({ current: 3, longest: 3, activeToday: true });
  });

  it("stays alive when the last activity was yesterday", () => {
    expect(computeStreak(days("2026-11-06", "2026-11-07"), NOW)).toMatchObject({ current: 2, activeToday: false });
  });

  it("breaks after a missed day but remembers the longest", () => {
    expect(computeStreak(days("2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-06"), NOW)).toEqual({
      current: 0,
      longest: 4,
      activeToday: false,
    });
  });

  it("crosses month boundaries and DST changes, ignoring duplicates and order", () => {
    // US DST ended 1 Nov 2026; EU on 25 Oct 2026.
    const d = days("2026-11-01", "2026-10-31", "2026-10-25", "2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-30");
    expect(computeStreak(d, new Date(2026, 10, 1, 9))).toMatchObject({ current: 8, longest: 8, activeToday: true });
  });

  it("uses local calendar days", () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });
});

describe("recording outcomes", () => {
  it("tracks attempts, successes and activity days", () => {
    let s = recordOutcome(defaultState(), "JS-001", "incorrect", NOW);
    s = recordOutcome(s, "JS-001", "correct", new Date(2026, 10, 9));
    expect(s.progress["JS-001"]).toMatchObject({ attempts: 2, successes: 1, lastOutcome: "correct" });
    expect(s.activityDays).toEqual(["2026-11-08", "2026-11-09"]);
  });

  it("adds misses to the review queue and clears them on success", () => {
    let s = recordOutcome(defaultState(), "JS-001", "missed", NOW);
    expect(s.reviewQueue).toEqual(["JS-001"]);
    s = recordOutcome(s, "JS-001", "incorrect", NOW);
    expect(s.reviewQueue).toEqual(["JS-001"]);
    s = recordOutcome(s, "JS-001", "got-it", NOW);
    expect(s.reviewQueue).toEqual([]);
  });

  it("toggles bookmarks and review entries", () => {
    let s = toggleBookmark(defaultState(), "JS-001");
    expect(s.bookmarks).toEqual(["JS-001"]);
    s = toggleBookmark(s, "JS-001");
    expect(s.bookmarks).toEqual([]);
    expect(toggleReview(s, "JS-002").reviewQueue).toEqual(["JS-002"]);
  });
});

describe("reset", () => {
  it("clears stored state and the corruption backup", () => {
    const store = new MemoryStorage();
    saveState(store, recordOutcome(defaultState(), "JS-001", "correct", NOW));
    store.setItem(BACKUP_KEY, "{bad");
    store.setItem("unrelated", "keep");
    expect(resetState(store)).toEqual(defaultState());
    expect(store.getItem(STORAGE_KEY)).toBeNull();
    expect(store.getItem(BACKUP_KEY)).toBeNull();
    expect(store.getItem("unrelated")).toBe("keep");
    expect(loadState(store).status).toBe("empty");
  });
});
