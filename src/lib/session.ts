import {
  isAutoGraded,
  type Difficulty,
  type McqOptionId,
  type Question,
  type QuestionType,
  type Technology,
} from "./types";

/* ------------------------------------------------------------------ */
/* Filters & selection                                                 */
/* ------------------------------------------------------------------ */

/** An empty list means "no constraint" for that dimension. */
export interface QuestionFilters {
  technologies: Technology[];
  topics: string[];
  difficulties: Difficulty[];
  types: QuestionType[];
}

export const EMPTY_FILTERS: QuestionFilters = {
  technologies: [],
  topics: [],
  difficulties: [],
  types: [],
};

export function filterQuestions(questions: readonly Question[], f: QuestionFilters): Question[] {
  return questions.filter(
    (q) =>
      (f.technologies.length === 0 || f.technologies.includes(q.technology)) &&
      (f.topics.length === 0 || f.topics.includes(q.topic)) &&
      (f.difficulties.length === 0 || f.difficulties.includes(q.difficulty)) &&
      (f.types.length === 0 || f.types.includes(q.type)),
  );
}

export type Rng = () => number;

/** Deterministic PRNG for tests and reproducible shuffles. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export interface SelectOptions {
  rng?: Rng;
  /** IDs already practised; unseen questions are picked first when set. */
  seen?: ReadonlySet<string>;
}

/**
 * Picks up to `count` distinct questions from the pool.
 * Returns an empty array when the pool is empty or count < 1.
 */
export function selectQuestions(
  pool: readonly Question[],
  count: number,
  { rng = Math.random, seen }: SelectOptions = {},
): Question[] {
  const n = Number.isFinite(count) ? Math.floor(count) : 0;
  if (n < 1 || pool.length === 0) return [];
  const unique = [...new Map(pool.map((q) => [q.id, q])).values()];
  const shuffled = shuffle(unique, rng);
  const ordered = seen
    ? [...shuffled.filter((q) => !seen.has(q.id)), ...shuffled.filter((q) => seen.has(q.id))]
    : shuffled;
  return ordered.slice(0, n);
}

export const QUICK_SIZE = 10;

/** One-click Quick 10: random mix across the whole bank, unseen first. */
export function quickTen(all: readonly Question[], seen: ReadonlySet<string>, rng: Rng = Math.random): Question[] {
  return selectQuestions(all, QUICK_SIZE, { rng, seen });
}

/* ------------------------------------------------------------------ */
/* Sessions                                                            */
/* ------------------------------------------------------------------ */

export type SessionOrigin = "quick" | "custom" | "review" | "bookmarks" | "retry" | "single" | "roadmap";
export type SelfVerdict = "got-it" | "missed";

export type SessionAnswer =
  | { kind: "mcq"; selected: McqOptionId; correct: boolean; hintsUsed: number; seconds: number }
  | { kind: "self"; draft: string; verdict: SelfVerdict | null; hintsUsed: number; seconds: number }
  | { kind: "skipped" };

export interface Session {
  id: string;
  title: string;
  origin: SessionOrigin;
  questionIds: string[];
  createdAt: string;
  currentIndex: number;
  answers: Record<string, SessionAnswer>;
  timerEnabled: boolean;
  completedAt: string | null;
}

export function createSession(input: {
  title: string;
  origin: SessionOrigin;
  questionIds: readonly string[];
  timerEnabled: boolean;
  now?: Date;
  id?: string;
}): Session {
  const now = input.now ?? new Date();
  return {
    id: input.id ?? `s-${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    title: input.title,
    origin: input.origin,
    questionIds: [...new Set(input.questionIds)],
    createdAt: now.toISOString(),
    currentIndex: 0,
    answers: {},
    timerEnabled: input.timerEnabled,
    completedAt: null,
  };
}

/* ------------------------------------------------------------------ */
/* Grading                                                             */
/* ------------------------------------------------------------------ */

/** Objective grading. Only MCQ questions can be graded by the app. */
export function gradeMcq(question: Question, selected: McqOptionId): boolean {
  if (!isAutoGraded(question.type)) {
    throw new Error(`${question.id} is ${question.type}; only MCQ is auto-graded`);
  }
  return question.correctAnswer === selected;
}

/** Normalised outcome used by progress tracking. */
export type Outcome = "correct" | "incorrect" | "got-it" | "missed";

export function outcomeOf(answer: SessionAnswer | undefined): Outcome | null {
  if (!answer || answer.kind === "skipped") return null;
  if (answer.kind === "mcq") return answer.correct ? "correct" : "incorrect";
  return answer.verdict;
}

export function isMiss(outcome: Outcome | null): boolean {
  return outcome === "incorrect" || outcome === "missed";
}

export interface SessionSummary {
  total: number;
  /** Objective (MCQ) results; accuracy is null when no MCQ was answered. */
  graded: { total: number; answered: number; correct: number; accuracy: number | null };
  /** Self-reviewed results; never included in accuracy. */
  selfReviewed: { total: number; reviewed: number; gotIt: number; missed: number; completion: number | null };
  skipped: number;
  missedIds: string[];
  missedTopics: { technology: Technology; topic: string; count: number }[];
}

export function summarizeSession(session: Session, byId: ReadonlyMap<string, Question>): SessionSummary {
  const graded = { total: 0, answered: 0, correct: 0, accuracy: null as number | null };
  const self = { total: 0, reviewed: 0, gotIt: 0, missed: 0, completion: null as number | null };
  let skipped = 0;
  const missedIds: string[] = [];
  const topics = new Map<string, { technology: Technology; topic: string; count: number }>();

  for (const id of session.questionIds) {
    const q = byId.get(id);
    if (!q) continue;
    const answer = session.answers[id];
    if (isAutoGraded(q.type)) graded.total++;
    else self.total++;

    if (!answer || answer.kind === "skipped") {
      if (answer?.kind === "skipped") skipped++;
      continue;
    }
    if (answer.kind === "mcq") {
      graded.answered++;
      if (answer.correct) graded.correct++;
    } else if (answer.verdict) {
      self.reviewed++;
      if (answer.verdict === "got-it") self.gotIt++;
      else self.missed++;
    }
    if (isMiss(outcomeOf(answer))) {
      missedIds.push(id);
      const key = `${q.technology}\u0000${q.topic}`;
      const entry = topics.get(key) ?? { technology: q.technology, topic: q.topic, count: 0 };
      entry.count++;
      topics.set(key, entry);
    }
  }
  graded.accuracy = graded.answered > 0 ? graded.correct / graded.answered : null;
  self.completion = self.total > 0 ? self.reviewed / self.total : null;
  return {
    total: session.questionIds.length,
    graded,
    selfReviewed: self,
    skipped,
    missedIds,
    missedTopics: [...topics.values()].sort((a, b) => b.count - a.count || a.topic.localeCompare(b.topic)),
  };
}

/** Soft per-question time target used by the optional timer. */
export function targetSeconds(difficulty: Difficulty): number {
  return difficulty === "Beginner" ? 60 : difficulty === "Intermediate" ? 120 : 180;
}
