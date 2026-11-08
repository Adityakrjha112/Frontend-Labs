import { describe, expect, it } from "vitest";
import { parseQuestionBank } from "@/importer/validate";
import {
  createSession,
  EMPTY_FILTERS,
  filterQuestions,
  QUICK_SIZE,
  quickTen,
  seededRng,
  selectQuestions,
} from "@/lib/session";
import type { Question } from "@/lib/types";
import { QUESTIONS } from "@/lib/bank";
import { makeWorkbook } from "./fixtures/workbook";

const small = parseQuestionBank(makeWorkbook()).questions;
const ids = (qs: Question[]) => qs.map((q) => q.id);

describe("filterQuestions", () => {
  it("returns everything with no filters", () => {
    expect(filterQuestions(small, EMPTY_FILTERS)).toHaveLength(small.length);
  });

  it("filters by each dimension", () => {
    expect(ids(filterQuestions(small, { ...EMPTY_FILTERS, technologies: ["HTML, CSS, Tailwind"] }))).toEqual(["HCT-001"]);
    expect(ids(filterQuestions(small, { ...EMPTY_FILTERS, topics: ["Promises"] }))).toEqual(["ASYNC-001", "ASYNC-002", "ASYNC-004"]);
    expect(ids(filterQuestions(small, { ...EMPTY_FILTERS, difficulties: ["Advanced"] }))).toEqual(["ASYNC-003", "ASYNC-004"]);
    expect(ids(filterQuestions(small, { ...EMPTY_FILTERS, types: ["MCQ", "Predict Output"] }))).toEqual(["ASYNC-001", "ASYNC-002"]);
  });

  it("combines dimensions with AND and values with OR", () => {
    const f = { ...EMPTY_FILTERS, topics: ["Promises"], difficulties: ["Beginner", "Advanced"] as Question["difficulty"][] };
    expect(ids(filterQuestions(small, f))).toEqual(["ASYNC-001", "ASYNC-004"]);
  });

  it("returns an empty list when nothing matches", () => {
    expect(filterQuestions(small, { ...EMPTY_FILTERS, technologies: ["Next.js"] })).toEqual([]);
    const realEmpty = filterQuestions(QUESTIONS, { ...EMPTY_FILTERS, technologies: ["TypeScript"], types: ["Fix the Code"] });
    expect(realEmpty).toEqual([]);
  });
});

describe("selectQuestions", () => {
  it("returns exactly the requested count with no duplicates", () => {
    const picked = selectQuestions(QUESTIONS, 37, { rng: seededRng(1) });
    expect(picked).toHaveLength(37);
    expect(new Set(ids(picked)).size).toBe(37);
  });

  it("caps at the pool size", () => {
    expect(selectQuestions(small, 99, { rng: seededRng(2) })).toHaveLength(small.length);
  });

  it("deduplicates a pool that contains repeats", () => {
    const pool = [...small, ...small, small[0]!];
    const picked = selectQuestions(pool, 50, { rng: seededRng(3) });
    expect(picked).toHaveLength(small.length);
    expect(new Set(ids(picked)).size).toBe(small.length);
  });

  it.each([0, -3, Number.NaN, Number.POSITIVE_INFINITY])("returns [] for count %s", (n) => {
    expect(selectQuestions(small, n)).toEqual([]);
  });

  it("floors fractional counts", () => {
    expect(selectQuestions(small, 2.9, { rng: seededRng(4) })).toHaveLength(2);
  });

  it("returns [] for an empty pool", () => {
    expect(selectQuestions([], 10)).toEqual([]);
  });

  it("is deterministic for a given seed and shuffles across seeds", () => {
    const a = ids(selectQuestions(QUESTIONS, 10, { rng: seededRng(42) }));
    const b = ids(selectQuestions(QUESTIONS, 10, { rng: seededRng(42) }));
    const c = ids(selectQuestions(QUESTIONS, 10, { rng: seededRng(43) }));
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it("puts unseen questions first when seen IDs are given", () => {
    const seen = new Set(["ASYNC-001", "ASYNC-002", "ASYNC-003"]);
    const picked = selectQuestions(small, 2, { rng: seededRng(5), seen });
    expect(picked.every((q) => !seen.has(q.id))).toBe(true);
    // Once unseen run out, seen ones fill the remainder.
    expect(selectQuestions(small, 5, { rng: seededRng(5), seen })).toHaveLength(5);
  });

  it("respects custom filters plus count end to end", () => {
    const pool = filterQuestions(QUESTIONS, { ...EMPTY_FILTERS, technologies: ["React.js & Hooks"], difficulties: ["Advanced"] });
    const picked = selectQuestions(pool, 12, { rng: seededRng(9) });
    expect(picked).toHaveLength(12);
    expect(picked.every((q) => q.technology === "React.js & Hooks" && q.difficulty === "Advanced")).toBe(true);
  });
});

describe("Quick 10", () => {
  it("picks 10 distinct questions from the whole bank", () => {
    const picked = quickTen(QUESTIONS, new Set(), seededRng(7));
    expect(picked).toHaveLength(QUICK_SIZE);
    expect(new Set(ids(picked)).size).toBe(QUICK_SIZE);
  });

  it("prefers questions the user has not seen", () => {
    const seen = new Set(QUESTIONS.slice(0, 495).map((q) => q.id));
    const picked = quickTen(QUESTIONS, seen, seededRng(8));
    expect(picked.filter((q) => !seen.has(q.id))).toHaveLength(5);
  });

  it("still returns 10 when everything has been seen", () => {
    expect(quickTen(QUESTIONS, new Set(QUESTIONS.map((q) => q.id)), seededRng(1))).toHaveLength(10);
  });
});

describe("createSession", () => {
  it("removes duplicate IDs and starts at the first question", () => {
    const s = createSession({ title: "T", origin: "custom", questionIds: ["A", "B", "A"], timerEnabled: false, now: new Date(0), id: "x" });
    expect(s).toMatchObject({ id: "x", questionIds: ["A", "B"], currentIndex: 0, answers: {}, completedAt: null });
  });
});
