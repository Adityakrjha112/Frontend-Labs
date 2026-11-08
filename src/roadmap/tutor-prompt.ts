/**
 * Builds a detailed, week-specific prompt for studying with an AI assistant
 * in voice mode. Everything week-specific comes from the roadmap content
 * (and the explicit question mapping), so prompts never drift from the page.
 */
import { MONTH_BY_ID, ROADMAP, isStudyTopic, plain, type Topic } from "./model";
import type { Question, QuestionType } from "@/lib/types";

export interface TutorProgress {
  status: "not-started" | "in-progress" | "completed";
  /** IDs of checklist items already ticked. */
  doneItemIds: ReadonlySet<string>;
}

/** Spoken-friendly types first: they work best as interview questions out loud. */
const VOICE_FRIENDLY: readonly QuestionType[] = ["Conceptual", "Scenario", "Architecture", "Follow-up", "MCQ", "Find the Bug"];
export const MAX_BANK_QUESTIONS = 6;

/** Picks up to six bank questions that work out loud, spread across workbook topics. */
export function pickBankQuestions(questions: readonly Question[], max = MAX_BANK_QUESTIONS): Question[] {
  const ranked = [...questions].sort((a, b) => {
    const ra = VOICE_FRIENDLY.indexOf(a.type);
    const rb = VOICE_FRIENDLY.indexOf(b.type);
    return (ra < 0 ? 99 : ra) - (rb < 0 ? 99 : rb);
  });
  const picked: Question[] = [];
  const seenTopics = new Set<string>();
  // A follow-up only makes sense spoken right after its parent question.
  const usable = (q: Question) => !q.parentId || picked.some((p) => p.id === q.parentId);
  for (const q of ranked) {
    if (picked.length >= max) break;
    if (seenTopics.has(q.topic) || !usable(q)) continue;
    picked.push(q);
    seenTopics.add(q.topic);
  }
  // Fill remaining slots; repeat because a follow-up becomes usable once its parent is in.
  for (let added = true; added && picked.length < max; ) {
    added = false;
    for (const q of ranked) {
      if (picked.length >= max) break;
      if (!picked.includes(q) && usable(q)) {
        picked.push(q);
        added = true;
      }
    }
  }
  // Keep each follow-up directly after its parent.
  return picked.flatMap((q) => (q.parentId ? [] : [q, ...picked.filter((f) => f.parentId === q.id)]));
}

/** Week numbers mentioned in text like "Full weeks 1–2", "week 6, revisited in week 10", "weeks 7 and 14". */
export function weeksMentioned(text: string): number[] {
  const out = new Set<number>();
  for (const m of text.matchAll(/\bweeks?\s+((?:\d+(?:\s*[–-]\s*\d+)?(?:\s*(?:,|and)\s*)?)+)/gi)) {
    for (const part of m[1]!.split(/\s*(?:,|and)\s*/)) {
      const range = /^(\d+)\s*[–-]\s*(\d+)$/.exec(part.trim());
      if (range) for (let n = Number(range[1]); n <= Number(range[2]); n++) out.add(n);
      else if (/^\d+$/.test(part.trim())) out.add(Number(part.trim()));
    }
  }
  return [...out].sort((a, b) => a - b);
}

const bullet = (items: readonly string[]) => items.map((s) => `- ${s}`).join("\n");
const numbered = (items: readonly string[]) => items.map((s, i) => `${i + 1}. ${s}`).join("\n");
/** Roadmap text without markdown, for speaking. */
const t = (s: string | undefined) => plain(s).trim();

/** The roadmap text is quoted verbatim; it is addressed to the learner. */
const QUOTE_NOTE =
  "The week details below are quoted from my roadmap as written. They are addressed to me, the learner: \"you\" and \"your\" mean me, and \"I\" means my roadmap mentor. In this session, you play that mentor.";

const VOICE_RULES = `How to run this as a voice conversation:
- Speak in short turns of two to four sentences, then stop and give the turn back to me. Ask one question at a time and wait for my answer.
- Do not read code out symbol by symbol. Describe code in words ("a function that returns a promise"). If I need to see exact code, say "I'll put that in the chat" and keep it under ten lines.
- Make me do the thinking: ask me to explain ideas in my own words, predict what code will do, or talk through a decision before you explain.
- When I'm wrong or vague, say so plainly, tell me the correct idea in one or two sentences, then ask a follow-up to check I've got it.
- Hints before solutions. When I'm stuck, ask what I've tried and ruled out, give the smallest useful hint, and only give the full answer after a second attempt or if I ask for it.
- Keep track of my weak spots during the session; you'll need them at the end.
- If you're not sure about a detail, say so and point me to the resources listed below. Don't invent API names, flags or numbers.
- I can say "slower", "repeat that", "give me an example", "skip this", "quiz me", "next part" or "wrap up" at any time. Do what I ask.`;

function studentProfile(): string {
  // Restates the roadmap's assumptions in the first person (the original is addressed to the learner).
  return "About me: I'm a front-end developer with 2 to 5 years of experience, working through a 26-week front-end depth roadmap at about 10 hours a week. Keep principles stack-neutral, but use TypeScript, React and Next.js for concrete examples. My projects run against mocked APIs (Mock Service Worker or static JSON fixtures), with no backend to build.";
}

function progressLine(topic: Topic, progress?: TutorProgress): string {
  if (!progress) return "";
  const done = topic.items.filter((i) => progress.doneItemIds.has(i.id)).map((i) => t(i.label));
  const open = topic.items.filter((i) => !progress.doneItemIds.has(i.id)).map((i) => t(i.label));
  const status = { "not-started": "not started yet", "in-progress": "in progress", completed: "already completed (this is a review)" }[progress.status];
  return `\nWhere I am this week: ${status}. ${done.length ? `Tasks already done: ${done.join("; ")}.` : "No tasks done yet."}${open.length ? ` Still open: ${open.join("; ")}.` : ""}\n`;
}

export function buildTutorPrompt(topic: Topic, bankQuestions: readonly Question[], progress?: TutorProgress): string {
  const month = MONTH_BY_ID.get(topic.monthId)!;
  const c = topic.content;
  const header = `You are my front-end engineering tutor and interviewer for a live voice study session. This session covers week ${topic.week} of 26 of my roadmap: "${topic.title}" (month ${month.n}, "${t(month.content.title)}").`;

  if (!isStudyTopic(c)) {
    const cap = ROADMAP.capstone;
    const earlier = month.topics.filter((x) => x.week < topic.week).map((x) => `week ${x.week}: ${x.title}`);
    return [
      header,
      "",
      studentProfile(),
      progressLine(topic, progress),
      `This is a capstone week. I'm building a portfolio project, so act as a senior engineer mentoring me and reviewing my decisions. Don't write the project for me.`,
      "",
      QUOTE_NOTE,
      "",
      `About the capstone: ${t(month.content.intro)}`,
      earlier.length ? `Capstone weeks before this one: ${earlier.join("; ")}.` : "This is the first capstone week.",
      "",
      `This week's plan: ${t(c.plan)}`,
      "",
      `This week's deliverables:\n${bullet(c.tasks.map(t))}`,
      "",
      `Capstone features and the skills each one proves:\n${bullet(cap.features.map(([f, s]) => `${t(f)}: ${t(s)}`))}`,
      "",
      `Acceptance criteria the finished capstone must meet:\n${bullet(cap.acceptance.map(([a, b]) => `${t(a)}: ${t(b)}`))}`,
      "",
      VOICE_RULES,
      "",
      `Run the session in this order:
1. Ask how much time I have today and which deliverable I want to work on. Adjust the plan to fit.
2. Ask me to explain my current approach for that deliverable out loud, as if presenting it to a teammate.
3. Review it like a senior engineer: ask probing questions about tradeoffs, failure cases, accessibility, performance and testing. For every choice, make me say it in the form "We chose X over Y because Z; we accept the cost of W."
4. Help me break the remaining work into small steps I can finish this week.
5. Run a short mock interview: ask me two questions an interviewer might ask about this part of the project, one at a time, and score each answer from 1 to 5 with what a strong answer would add.
6. Wrap up: summarize decisions made, open risks, and the next three concrete steps. Tell me which deliverables I can tick off, and what to log as study activity (minutes and type: Learn, Build, Advanced exercise, Write or Review).`,
      "",
      `Start now: greet me in one sentence, then ask how much time I have today.`,
    ]
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  const g = ROADMAP.guide;
  const assessment = g.assessment.filter((row) => weeksMentioned(row[3]).includes(topic.week));
  const missed = g.hints.filter(([, h]) => new RegExp(`\\(Week ${topic.week}\\)`).test(h));
  const lastWeekOfMonth = month.topics[month.topics.length - 1]!.id === topic.id;

  const focus: string[] = [];
  if (c.gap) focus.push("My assessment flagged this week as a gap focus. Go slower, check my understanding more often, and expect some wrong mental models.");
  for (const [area, result, gap] of assessment) focus.push(`Assessment result for ${t(area)}: ${t(result)}. Core gap: ${t(gap)}.`);
  for (const [, h] of missed) focus.push(`A question I previously got wrong. Use this hint to re-test me early: ${t(h).replace(/\s*\(Week \d+\)\s*$/, "")}`);

  // Workbook text is passed through exactly as written (no markdown stripping).
  const bank = bankQuestions.map((q) => `${q.question}${q.code ? " (has a code snippet; describe it to me in words)" : ""}`);

  return [
    header,
    "",
    studentProfile(),
    progressLine(topic, progress),
    QUOTE_NOTE,
    "",
    `Why this week matters: ${t(c.purpose)}`,
    `Prerequisites: ${t(c.prereq)}`,
    `Time budget for the week: ${t(c.time)}.`,
    "",
    `Key concepts to cover, in this order:\n${bullet(t(c.concepts).replace(/\.$/, "").split(/;\s*/).filter(Boolean))}`,
    "",
    `Skip check (if I pass it quickly without looking anything up, I can skip to the advanced exercise): ${t(c.skip)}${
      /assessment question/i.test(c.skip) ? " You don't have my original assessment questions, so test the same idea with a fresh question of your own." : ""
    }`,
    "",
    `This week's project: ${t(c.project)}`,
    "",
    `Advanced exercise: ${t(c.exercise)}`,
    `The hint to give me only when I'm stuck: ${t(c.hint)}`,
    "",
    focus.length ? `Things to pay extra attention to:\n${bullet(focus)}\n` : "",
    `Roadmap interview questions for this week:\n${numbered(c.questions.map(t))}`,
    bank.length ? `\nExtra interview questions from my practice bank (ask them out loud, without reading any answer):\n${numbered(bank)}` : "",
    "",
    `Trusted resources to point me to:\n${bullet([...(c.resourceNote ? [t(c.resourceNote)] : []), ...c.resources.map(([title, url]) => `${title}: ${url}`)])}`,
    "",
    `This week's tasks I need to finish:\n${bullet(c.tasks.map(t))}`,
    lastWeekOfMonth
      ? `\nThis is the last week of month ${month.n}. The month milestone is:\n${bullet(month.content.milestone.map(t))}\nReview checkpoint: ${t(month.content.checkpoint)}`
      : "",
    "",
    VOICE_RULES,
    "",
    `Run the session in this order, adapting to the time I have:
1. Warm-up: ask how much time I have today and what I already know about this topic. Briefly confirm I'm comfortable with the prerequisites. Then tell me the plan for this session in one or two sentences.
2. Skip check: offer it. If I want to try, describe the task, let me talk through my solution, and judge honestly whether I passed. If I pass, go straight to step 5.
3. Concepts: go through the key concepts in order. For each one, give a short explanation with a concrete browser or framework example, then ask me one question that checks real understanding (predict an outcome, explain a why, or spot a bug). Don't move on until I've answered.
4. Project: help me plan this week's project out loud: the requirements, the first steps, the hardest part, and how I'll test it. Don't build it for me.
5. Advanced exercise: describe it, let me attempt it out loud, and use the hint only when I'm stuck.
6. Mock interview: ask the roadmap interview questions, then the extra questions, one at a time, like a real interviewer. After each answer, score it from 1 to 5 and tell me in one or two sentences what a strong answer would add. Ask one follow-up when my answer is shallow.
7. Wrap-up: summarize what I did well, my three weakest points with one thing to practise for each, which tasks I can tick off (the mock interview counts toward "Interview questions answered out loud"), and what to log as study activity (minutes and type: Learn, Build, Advanced exercise, Write or Review). Finish with a one-sentence idea for this week's written explainer.`,
    "",
    `Start now: greet me in one sentence, then ask how much time I have today.`,
  ]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
