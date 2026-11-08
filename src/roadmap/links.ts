import { QUESTIONS } from "@/lib/bank";
import { resolveMapping } from "./question-map";
import { TOPIC_BY_ID, type Topic } from "./model";

/** Resolved roadmap ↔ question links for the app. */
export const MAPPING = resolveMapping(QUESTIONS);

export function questionIdsForWeek(weekId: string): readonly string[] {
  return MAPPING.byWeek.get(weekId) ?? [];
}

export function topicsForQuestion(questionId: string): Topic[] {
  return (MAPPING.byQuestion.get(questionId) ?? []).map((w) => TOPIC_BY_ID.get(w)!).filter(Boolean);
}
