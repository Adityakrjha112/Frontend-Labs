import { describe, expect, it } from "vitest";
import { QUESTIONS, QUESTION_BY_ID, questionsFor } from "@/lib/bank";
import { MONTHS, TOPICS, TOPIC_BY_ID, isStudyTopic, plain } from "@/roadmap/model";
import { MAPPING } from "@/roadmap/links";
import { buildTutorPrompt, pickBankQuestions, weeksMentioned, MAX_BANK_QUESTIONS } from "@/roadmap/tutor-prompt";

const bankFor = (week: string) => pickBankQuestions(questionsFor(MAPPING.byWeek.get(week) ?? []));
const promptFor = (week: string, progress?: Parameters<typeof buildTutorPrompt>[2]) =>
  buildTutorPrompt(TOPIC_BY_ID.get(week)!, bankFor(week), progress);

describe("weeksMentioned", () => {
  it("parses single weeks, ranges and lists", () => {
    expect(weeksMentioned("Full weeks 1–2")).toEqual([1, 2]);
    expect(weeksMentioned("Full week 6, revisited in week 10")).toEqual([6, 10]);
    expect(weeksMentioned("Full weeks 7 and 14")).toEqual([7, 14]);
    expect(weeksMentioned("Week 17, skip check available")).toEqual([17]);
    expect(weeksMentioned("no weeks here")).toEqual([]);
  });
});

describe("buildTutorPrompt", () => {
  it("builds a distinct prompt for every one of the 26 weeks", () => {
    const prompts = TOPICS.map((t) => promptFor(t.id));
    expect(new Set(prompts).size).toBe(26);
    for (const [i, p] of prompts.entries()) {
      expect(p).toContain(`week ${TOPICS[i]!.week} of 26`);
      expect(p).toContain(`"${TOPICS[i]!.title}"`);
      expect(p).toMatch(/Start now: greet me in one sentence/);
      expect(p).not.toMatch(/\n{3,}/);
    }
  });

  it("includes every roadmap detail for a study week, without markdown", () => {
    for (const t of TOPICS) {
      const c = t.content;
      if (!isStudyTopic(c)) continue;
      const p = promptFor(t.id);
      expect(p, t.id).toContain(plain(c.purpose));
      expect(p, t.id).toContain(plain(c.skip));
      expect(p, t.id).toContain(plain(c.project));
      expect(p, t.id).toContain(plain(c.exercise));
      expect(p, t.id).toContain(plain(c.hint));
      for (const q of c.questions) expect(p, t.id).toContain(plain(q));
      for (const [, url] of c.resources) expect(p, t.id).toContain(url);
      for (const task of c.tasks) expect(p, t.id).toContain(plain(task));
      expect(p, t.id).not.toContain("`");
      expect(p, t.id).not.toContain("**");
    }
  });

  it("explains that the quoted roadmap text is addressed to the learner", () => {
    expect(promptFor("w10")).toMatch(/"you" and "your" mean me, and "I" means my roadmap mentor/);
    expect(promptFor("w22")).toMatch(/"you" and "your" mean me/);
  });

  it("flags gap weeks and adds the matching assessment rows and missed questions", () => {
    const w6 = promptFor("w6");
    expect(w6).toContain("flagged this week as a gap focus");
    expect(w6).toContain("Assessment result for JavaScript async: Incorrect.");
    expect(w6).toContain("A question I previously got wrong");
    expect(w6).toContain("You don't have my original assessment questions");
    const w10 = promptFor("w10");
    expect(w10).toContain("Assessment result for JavaScript async"); // "revisited in week 10"
    expect(w10).toContain("Assessment result for React requests");
    const w9 = promptFor("w9");
    expect(w9).not.toContain("gap focus");
    expect(w9).not.toContain("Things to pay extra attention to");
  });

  it("adds the month milestone only in the month's last week", () => {
    const last = MONTHS[0]!.topics.at(-1)!.id;
    expect(promptFor(last)).toContain("This is the last week of month 1. The month milestone is:");
    expect(promptFor("w1")).not.toContain("The month milestone is:");
  });

  it("includes the learner's progress when given", () => {
    const p = promptFor("w6", { status: "in-progress", doneItemIds: new Set(["w6-t1"]) });
    expect(p).toContain("Where I am this week: in progress. Tasks already done: Station finder handles races, failures, and retries.");
    expect(p).toContain("Still open: Ten puzzles done;");
    expect(promptFor("w6")).not.toContain("Where I am this week");
  });

  it("uses a mentor and reviewer prompt for capstone weeks", () => {
    const p = promptFor("w23");
    expect(p).toContain("This is a capstone week.");
    expect(p).toContain("We chose X over Y because Z; we accept the cost of W.");
    expect(p).toContain("Capstone weeks before this one: week 22: Design and skeleton.");
    expect(p).not.toContain("Skip check");
  });

  it("tells the AI how to behave in voice mode", () => {
    const p = promptFor("w3");
    expect(p).toContain("Speak in short turns");
    expect(p).toContain("Do not read code out symbol by symbol");
    expect(p).toContain("Hints before solutions");
  });
});

describe("pickBankQuestions", () => {
  it("picks up to six mapped questions, preferring ones that work out loud", () => {
    for (const t of TOPICS) {
      const picked = bankFor(t.id);
      const mapped = MAPPING.byWeek.get(t.id) ?? [];
      expect(picked.length, t.id).toBe(Math.min(MAX_BANK_QUESTIONS, mapped.length));
      expect(picked.every((q) => mapped.includes(q.id)), t.id).toBe(true);
      expect(new Set(picked.map((q) => q.id)).size, t.id).toBe(picked.length);
    }
    expect(bankFor("w9").some((q) => q.type === "Conceptual")).toBe(true);
  });

  it("never includes a follow-up without its parent, and keeps them together", () => {
    for (const t of TOPICS) {
      const picked = bankFor(t.id);
      picked.forEach((q, i) => {
        if (q.parentId) expect(picked[i - 1]?.id === q.parentId || picked.slice(0, i).some((p) => p.id === q.parentId), `${t.id} ${q.id}`).toBe(true);
      });
    }
  });

  it("passes workbook question text through exactly as written", () => {
    const q = bankFor("w6")[0]!;
    expect(promptFor("w6")).toContain(QUESTION_BY_ID.get(q.id)!.question);
    expect(QUESTIONS).toHaveLength(500);
  });
});
