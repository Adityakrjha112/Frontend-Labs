import data from "@/data/questions.json";
import type { Question, QuestionBank, Technology } from "./types";
import { TECHNOLOGY_META } from "./taxonomy";

const bank = data as QuestionBank;

export const QUESTIONS: readonly Question[] = bank.questions;
export const QUESTION_BY_ID: ReadonlyMap<string, Question> = new Map(QUESTIONS.map((q) => [q.id, q]));
export const KNOWN_IDS: ReadonlySet<string> = new Set(QUESTION_BY_ID.keys());

/** Topics per technology in first-seen order. */
export const TOPICS_BY_TECH: ReadonlyMap<Technology, string[]> = (() => {
  const map = new Map<Technology, string[]>(TECHNOLOGY_META.map((t) => [t.label, []]));
  for (const q of QUESTIONS) {
    const list = map.get(q.technology)!;
    if (!list.includes(q.topic)) list.push(q.topic);
  }
  return map;
})();

export function questionsFor(ids: readonly string[]): Question[] {
  return ids.map((id) => QUESTION_BY_ID.get(id)).filter((q): q is Question => q !== undefined);
}
