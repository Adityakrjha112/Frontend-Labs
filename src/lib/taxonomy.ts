import type { Difficulty, QuestionType, Technology } from "./types";

export interface TechnologyMeta {
  label: Technology;
  short: string;
  slug: string;
  idPrefix: string;
}

export const TECHNOLOGY_META: readonly TechnologyMeta[] = [
  { label: "JavaScript (Basic → Advanced)", short: "JavaScript", slug: "javascript", idPrefix: "JS" },
  { label: "React.js & Hooks", short: "React", slug: "react", idPrefix: "REACT" },
  { label: "Next.js", short: "Next.js", slug: "nextjs", idPrefix: "NEXT" },
  { label: "TypeScript", short: "TypeScript", slug: "typescript", idPrefix: "TS" },
  { label: "HTML, CSS, Tailwind", short: "HTML/CSS", slug: "html-css", idPrefix: "HCT" },
  { label: "DOM & Browser APIs", short: "DOM", slug: "dom", idPrefix: "DOM" },
  { label: "Async JavaScript & Event Loop", short: "Async", slug: "async", idPrefix: "ASYNC" },
  { label: "Performance, Accessibility, SEO", short: "Perf/A11y/SEO", slug: "perf", idPrefix: "PAS" },
  { label: "Debugging & Real-World Scenarios", short: "Debugging", slug: "debugging", idPrefix: "DBG" },
];

export function techMeta(label: Technology): TechnologyMeta {
  const meta = TECHNOLOGY_META.find((t) => t.label === label);
  if (!meta) throw new Error(`Unknown technology: ${label}`);
  return meta;
}

export const DIFFICULTY_RANK: Record<Difficulty, number> = {
  Beginner: 1,
  Intermediate: 2,
  Advanced: 3,
};

export const TYPE_BLURB: Record<QuestionType, string> = {
  MCQ: "Pick one option. Auto-graded.",
  "Predict Output": "Write the exact output, then compare.",
  "Code Trace": "Trace execution and write what is logged.",
  "Find the Bug": "Explain the bug and the fix.",
  "Fix the Code": "Write a corrected implementation.",
  "Write Code": "Write a working implementation.",
  Conceptual: "Explain the concept in your own words.",
  Scenario: "Reason through a real-world situation.",
  Architecture: "Describe the design and its trade-offs.",
  "Follow-up": "A deeper follow-up to an earlier question.",
};
