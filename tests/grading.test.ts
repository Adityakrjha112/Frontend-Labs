import { describe, expect, it } from "vitest";
import { parseQuestionBank } from "@/importer/validate";
import { createSession, gradeMcq, outcomeOf, summarizeSession, type Session } from "@/lib/session";
import { isAutoGraded, QUESTION_TYPES } from "@/lib/types";
import { makeWorkbook } from "./fixtures/workbook";

const questions = parseQuestionBank(makeWorkbook()).questions;
const byId = new Map(questions.map((q) => [q.id, q]));
const mcq = byId.get("ASYNC-001")!; // correct answer: A

function session(answers: Session["answers"], questionIds = questions.map((q) => q.id)): Session {
  return { ...createSession({ title: "t", origin: "custom", questionIds, timerEnabled: false }), answers };
}

describe("MCQ grading", () => {
  it("marks the keyed option correct", () => {
    expect(gradeMcq(mcq, "A")).toBe(true);
  });

  it.each(["B", "C", "D"] as const)("marks option %s incorrect", (opt) => {
    expect(gradeMcq(mcq, opt)).toBe(false);
  });

  it("refuses to auto-grade non-MCQ questions", () => {
    expect(() => gradeMcq(byId.get("ASYNC-003")!, "A")).toThrow(/only MCQ is auto-graded/);
  });

  it("only MCQ is auto-graded", () => {
    expect(QUESTION_TYPES.filter(isAutoGraded)).toEqual(["MCQ"]);
  });
});

describe("session summary", () => {
  it("computes accuracy from MCQ only, excluding self-reviewed questions", () => {
    const s = summarizeSession(
      session({
        "ASYNC-001": { kind: "mcq", selected: "B", correct: false, hintsUsed: 0, seconds: 0 },
        "ASYNC-002": { kind: "self", draft: "x", verdict: "got-it", hintsUsed: 0, seconds: 0 },
        "ASYNC-003": { kind: "self", draft: "y", verdict: "got-it", hintsUsed: 1, seconds: 0 },
      }),
      byId,
    );
    // 0/1 MCQ correct even though both self-reviews were "got it".
    expect(s.graded).toEqual({ total: 1, answered: 1, correct: 0, accuracy: 0 });
    expect(s.selfReviewed).toMatchObject({ total: 4, reviewed: 2, gotIt: 2, missed: 0, completion: 0.5 });
  });

  it("reports null accuracy when no MCQ was answered", () => {
    const s = summarizeSession(
      session({ "ASYNC-003": { kind: "self", draft: "", verdict: "missed", hintsUsed: 0, seconds: 0 } }),
      byId,
    );
    expect(s.graded.accuracy).toBeNull();
  });

  it("does not count an unmarked self-review as complete", () => {
    const s = summarizeSession(
      session({ "ASYNC-002": { kind: "self", draft: "x", verdict: null, hintsUsed: 0, seconds: 0 } }, ["ASYNC-002"]),
      byId,
    );
    expect(s.selfReviewed).toMatchObject({ total: 1, reviewed: 0, completion: 0 });
    expect(s.missedIds).toEqual([]);
  });

  it("collects missed questions and groups missed topics", () => {
    const s = summarizeSession(
      session({
        "ASYNC-001": { kind: "mcq", selected: "C", correct: false, hintsUsed: 0, seconds: 0 },
        "ASYNC-002": { kind: "self", draft: "x", verdict: "missed", hintsUsed: 0, seconds: 0 },
        "ASYNC-003": { kind: "self", draft: "x", verdict: "missed", hintsUsed: 0, seconds: 0 },
        "ASYNC-004": { kind: "skipped" },
        "HCT-001": { kind: "self", draft: "x", verdict: "got-it", hintsUsed: 0, seconds: 0 },
      }),
      byId,
    );
    expect(s.missedIds).toEqual(["ASYNC-001", "ASYNC-002", "ASYNC-003"]);
    expect(s.missedTopics).toEqual([
      { technology: "Async JavaScript & Event Loop", topic: "Promises", count: 2 },
      { technology: "Async JavaScript & Event Loop", topic: "Async functions", count: 1 },
    ]);
    expect(s.skipped).toBe(1);
  });

  it("maps answers to outcomes", () => {
    expect(outcomeOf({ kind: "mcq", selected: "A", correct: true, hintsUsed: 0, seconds: 0 })).toBe("correct");
    expect(outcomeOf({ kind: "self", draft: "", verdict: null, hintsUsed: 0, seconds: 0 })).toBeNull();
    expect(outcomeOf({ kind: "skipped" })).toBeNull();
    expect(outcomeOf(undefined)).toBeNull();
  });
});
