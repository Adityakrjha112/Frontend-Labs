import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import content from "@/roadmap/content.json";
import { ALL_ITEMS, MONTHS, ROADMAP, TOPICS, TOPIC_BY_ID } from "@/roadmap/model";
import {
  addDays,
  addLog,
  APP_ID,
  BACKUP_KEY,
  checkImport,
  completeWeek,
  currentStreak,
  currentTopic,
  defaultState,
  describeDay,
  exportJSON,
  heatRange,
  keyOf,
  levelFor,
  loadState,
  longestStreak,
  matchTopic,
  minutesError,
  parseKey,
  recordVisit,
  removeLog,
  sanitize,
  saveState,
  setNote,
  setStatus,
  setTask,
  STORAGE_KEY,
  todayGoals,
  type StorageLike,
} from "@/roadmap/state";
import { PARTIAL_COVERAGE, resolveMapping, UNMAPPED_WEEKS, WEEK_RULES } from "@/roadmap/question-map";
import { QUESTIONS } from "@/lib/bank";
import legacy from "./fixtures/legacy-sanitize.json";

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

const NOW = new Date(2026, 10, 8, 14, 0);
const TODAY = keyOf(NOW);

describe("roadmap content", () => {
  it("is byte-for-byte the content extracted from the original index.html", () => {
    // SHA-256 of JSON.stringify(ROADMAP) taken from the original page before it was removed.
    expect(createHash("sha256").update(JSON.stringify(content)).digest("hex")).toBe(
      "409bba5183b14eddc84ffdfa130a6715b12f915f7e48f828c2a420791e99f82e",
    );
  });

  it("has 6 months, 26 weeks and the original checklist item IDs", () => {
    expect(MONTHS).toHaveLength(6);
    expect(TOPICS.map((t) => t.id)).toEqual(Array.from({ length: 26 }, (_, i) => `w${i + 1}`));
    expect(TOPIC_BY_ID.get("w6")!.items.map((i) => i.id)).toEqual(["w6-t1", "w6-t2", "w6-t3", "w6-iq"]);
    expect(TOPIC_BY_ID.get("w22")!.items.every((i) => !i.id.endsWith("-iq"))).toBe(true);
    expect(MONTHS[0]!.milestoneItems[0]!.id).toBe("m1-ms1");
    expect(MONTHS[5]!.checkpointItem).toMatchObject({ id: "m6-cp", label: "Final review passed" });
    expect(new Set(ALL_ITEMS.map((i) => i.id)).size).toBe(ALL_ITEMS.length);
    expect(ROADMAP.title).toBe("Front-End Engineering Depth: 6-Month Roadmap");
  });
});

describe("parity with the original tracker", () => {
  it.each(Object.keys(legacy))("sanitize(%s) matches the original page's output", (key) => {
    const { input, output } = (legacy as Record<string, { input: unknown; output: unknown }>)[key]!;
    expect(sanitize(input)).toEqual(output);
  });
});

describe("roadmap storage", () => {
  it("round-trips through the original storage key and schema", () => {
    const store = new MemoryStorage();
    let s = setTask(defaultState(), "w1-t1", true, NOW).state;
    s = setNote(s, "w1", "hello");
    expect(saveState(store, s)).toBe(true);
    const saved = JSON.parse(store.getItem(STORAGE_KEY)!);
    expect(saved).toMatchObject({ app: APP_ID, schema: 1 });
    const r = loadState(store);
    expect(r.state).toEqual(s);
    expect(r.banner).toBeNull();
  });

  it("keeps unreadable data as a backup and starts fresh", () => {
    const store = new MemoryStorage();
    store.setItem(STORAGE_KEY, "{oops");
    const r = loadState(store);
    expect(r.state).toEqual(defaultState());
    expect(r.banner?.error).toBe(true);
    expect(store.getItem(BACKUP_KEY)).toBe("{oops");
  });

  it.each([
    ["another app", JSON.stringify({ app: "other" })],
    ["a newer schema", JSON.stringify({ app: APP_ID, schema: 2 })],
  ])("refuses %s", (_n, raw) => {
    const store = new MemoryStorage();
    store.setItem(STORAGE_KEY, raw);
    expect(loadState(store).banner?.error).toBe(true);
  });

  it("reports skipped invalid entries without failing", () => {
    const store = new MemoryStorage();
    store.setItem(STORAGE_KEY, JSON.stringify({ app: APP_ID, schema: 1, topics: { w1: "completed", nope: "completed" } }));
    const r = loadState(store);
    expect(r.state.topics).toEqual({ w1: "completed" });
    expect(r.banner?.text).toMatch(/^1 saved entry was invalid/);
  });

  it("warns when storage is blocked", () => {
    const blocked: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {},
    };
    expect(loadState(blocked)).toMatchObject({ storageOK: false, banner: { error: true } });
  });

  it("imports its own exports and rejects foreign JSON", () => {
    const s = completeWeek(setTask(defaultState(), "w1-t1", true, NOW).state, "w1").state;
    const r = checkImport(exportJSON(s, NOW));
    expect(r).toMatchObject({ ok: true, skipped: 0 });
    expect(r.ok && r.state).toEqual(s);
    expect(checkImport("")).toMatchObject({ ok: false, message: "Choose a file or paste exported JSON first." });
    expect(checkImport("{")).toMatchObject({ ok: false });
    expect(checkImport('{"hello":1}')).toMatchObject({ ok: false, message: expect.stringMatching(/doesn't look like a roadmap export/) });
    expect(checkImport(JSON.stringify({ app: APP_ID, schema: 9 }))).toMatchObject({ ok: false });
  });
});

describe("roadmap state transitions", () => {
  it("ticking a task starts the week and makes today a study day", () => {
    const c = setTask(defaultState(), "w2-t1", true, NOW);
    expect(c.state.topics.w2).toBe("in-progress");
    expect(c.state.activity[TODAY]?.tasks).toEqual(["w2-t1"]);
    expect(c.notices).toEqual(["Week 2 is now in progress.", "Task done. Today counts as a study day."]);
    const undo = setTask(c.state, "w2-t1", false, NOW);
    expect(undo.state.tasks["w2-t1"]).toBeUndefined();
    expect(undo.state.activity[TODAY]).toBeUndefined();
  });

  it("does not mutate the previous state", () => {
    const before = defaultState();
    const snapshot = JSON.stringify(before);
    setTask(before, "w1-t1", true, NOW);
    addLog(before, { minutes: 30, kind: "Learn", topic: "", note: "" }, NOW);
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it("tracks the current week and completion messages", () => {
    let s = defaultState();
    expect(currentTopic(s)?.id).toBe("w1");
    const c = completeWeek(s, "w1");
    expect(c.notices[0]).toBe("Week 1 completed. Up next: week 2, Accessibility fundamentals.");
    s = c.state;
    expect(currentTopic(s)?.id).toBe("w2");
    for (const t of TOPICS) s = setStatus(s, t.id, "completed");
    expect(currentTopic(s)).toBeNull();
  });

  it("logs and removes study minutes", () => {
    const a = addLog(defaultState(), { minutes: 45, kind: "Build", topic: "w3", note: "grid" }, NOW);
    expect(a.notices).toEqual(["Logged 45 min. Today counts as a study day."]);
    const log = a.state.activity[TODAY]!.logs[0]!;
    expect(levelFor(a.state, TODAY)).toBe(2);
    expect(describeDay(a.state, TODAY)).toBe("study day, 45 minutes logged");
    const r = removeLog(a.state, TODAY, log.id);
    expect(r.state.activity[TODAY]).toBeUndefined();
  });

  it("counts visits separately from study", () => {
    const s = recordVisit(recordVisit(defaultState(), NOW), NOW);
    expect(s.visits[TODAY]).toBe(2);
    expect(describeDay(s, TODAY)).toBe("visited, no study");
    expect(currentStreak(s, TODAY)).toBe(0);
  });

  it("computes streaks like the original (alive through yesterday)", () => {
    let s = defaultState();
    for (const d of [-5, -4, -2, -1]) s = addLog(s, { minutes: 10, kind: "Learn", topic: "", note: "" }, parseKey(addDays(TODAY, d))).state;
    expect(currentStreak(s, TODAY)).toBe(2);
    expect(longestStreak(s)).toBe(2);
    s = addLog(s, { minutes: 10, kind: "Learn", topic: "", note: "" }, parseKey(addDays(TODAY, -3))).state;
    expect(longestStreak(s)).toBe(5);
  });

  it("levels heatmap cells by minutes and starts the range on a Monday", () => {
    let s = defaultState();
    s = addLog(s, { minutes: 120, kind: "Learn", topic: "", note: "" }, NOW).state;
    expect(levelFor(s, TODAY)).toBe(4);
    const { start } = heatRange(TODAY);
    expect(parseKey(start).getDay()).toBe(1);
  });

  it("filters weeks by text, notes and status", () => {
    const s = setNote(setStatus(defaultState(), "w6", "in-progress"), "w3", "remember subgrid quirk");
    const w6 = TOPIC_BY_ID.get("w6")!;
    expect(matchTopic(s, w6, "microtask", "all")).toBe(true);
    expect(matchTopic(s, w6, "microtask", "completed")).toBe(false);
    expect(matchTopic(s, TOPIC_BY_ID.get("w3")!, "quirk", "all")).toBe(true);
  });

  it("lists today's goals: done-today first, then the next 3 open tasks", () => {
    const s = setTask(defaultState(), "w1-t1", true, NOW).state;
    expect(todayGoals(s, TODAY).map((i) => i.id)).toEqual(["w1-t1", "w1-t2", "w1-t3", "w1-iq"]);
  });

  it("validates log minutes", () => {
    expect(minutesError("30")).toBeNull();
    expect(minutesError("0")).toMatch(/between 1 and 600/);
    expect(minutesError("1.5")).not.toBeNull();
    expect(minutesError("")).not.toBeNull();
  });
});

describe("roadmap ↔ question mapping", () => {
  const m = resolveMapping(QUESTIONS);

  it("keeps the workbook at 500 questions", () => {
    expect(QUESTIONS).toHaveLength(500);
  });

  it("has no rule that matches nothing", () => {
    expect(m.dangling).toEqual([]);
  });

  it("accounts for every week exactly once (mapped or explained)", () => {
    for (const t of TOPICS) {
      const mapped = t.id in WEEK_RULES;
      const unmapped = t.id in UNMAPPED_WEEKS;
      expect(mapped !== unmapped, t.id).toBe(true);
      if (mapped) expect(m.byWeek.get(t.id)!.length, t.id).toBeGreaterThan(0);
    }
    expect(Object.keys(UNMAPPED_WEEKS).sort()).toEqual(["w16", "w20", "w22", "w23", "w24", "w25", "w26"]);
    for (const w of Object.keys(PARTIAL_COVERAGE)) expect(WEEK_RULES[w], w).toBeDefined();
  });

  it("every rule has a reason", () => {
    for (const rules of Object.values(WEEK_RULES)) for (const r of rules) expect(r.why.trim()).not.toBe("");
  });

  it("links questions to the expected weeks", () => {
    expect(m.byQuestion.get("ASYNC-002")).toEqual(["w6"]);
    expect(m.byQuestion.get("HCT-028")).toEqual(["w2"]);
    expect(m.byQuestion.get("NEXT-005")).toContain("w12");
    expect(m.byQuestion.get("HCT-035")).toBeUndefined(); // :has selector, deliberately unmapped
    expect(m.byWeek.get("w9")).toHaveLength(QUESTIONS.filter((q) => q.id.startsWith("TS-")).length);
  });

  it("reports dangling selectors and IDs", () => {
    const bad = resolveMapping(QUESTIONS, { w1: [{ topics: [["HCT", "Nope"]], ids: ["ZZ-001"], why: "x" }] });
    expect(bad.dangling).toEqual(["w1: HCT / Nope", "w1: ZZ-001"]);
  });
});
