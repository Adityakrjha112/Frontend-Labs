import { isAutoGraded, type Question } from "./types";
import type { QuestionRecord } from "./storage";

export interface Bucket {
  key: string;
  total: number;
  /** Distinct questions attempted at least once. */
  attempted: number;
  /** MCQ: questions whose latest answer was correct / MCQ attempted. */
  gradedAttempted: number;
  gradedCorrect: number;
  /** Self-reviewed: latest verdict "got it" / self-reviewed attempted. */
  selfAttempted: number;
  selfGotIt: number;
}

function emptyBucket(key: string): Bucket {
  return { key, total: 0, attempted: 0, gradedAttempted: 0, gradedCorrect: 0, selfAttempted: 0, selfGotIt: 0 };
}

function add(b: Bucket, q: Question, rec: QuestionRecord | undefined) {
  b.total++;
  if (!rec) return;
  b.attempted++;
  if (isAutoGraded(q.type)) {
    b.gradedAttempted++;
    if (rec.lastOutcome === "correct") b.gradedCorrect++;
  } else {
    b.selfAttempted++;
    if (rec.lastOutcome === "got-it") b.selfGotIt++;
  }
}

/** Aggregates latest outcomes per question, grouped by a key. */
export function bucketize(
  questions: readonly Question[],
  progress: Readonly<Record<string, QuestionRecord>>,
  keyOf: (q: Question) => string,
  order: readonly string[] = [],
): Bucket[] {
  const map = new Map<string, Bucket>(order.map((k) => [k, emptyBucket(k)]));
  for (const q of questions) {
    const k = keyOf(q);
    if (!map.has(k)) map.set(k, emptyBucket(k));
    add(map.get(k)!, q, progress[q.id]);
  }
  return [...map.values()];
}

export function overall(questions: readonly Question[], progress: Readonly<Record<string, QuestionRecord>>): Bucket {
  return bucketize(questions, progress, () => "all")[0] ?? emptyBucket("all");
}

export const ratio = (n: number, d: number): number | null => (d > 0 ? n / d : null);

export function pct(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}
