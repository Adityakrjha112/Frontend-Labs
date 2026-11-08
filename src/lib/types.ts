/**
 * Domain types for Frontend Lab.
 *
 * The question shape mirrors the `All_Questions` sheet of the workbook.
 * Text fields are kept byte-for-byte as written (apart from removing the
 * workbook's documented protective apostrophe), and are always rendered
 * as plain text, never as HTML.
 */

export const TECHNOLOGIES = [
  "JavaScript (Basic → Advanced)",
  "React.js & Hooks",
  "Next.js",
  "TypeScript",
  "HTML, CSS, Tailwind",
  "DOM & Browser APIs",
  "Async JavaScript & Event Loop",
  "Performance, Accessibility, SEO",
  "Debugging & Real-World Scenarios",
] as const;
export type Technology = (typeof TECHNOLOGIES)[number];

export const DIFFICULTIES = ["Beginner", "Intermediate", "Advanced"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const QUESTION_TYPES = [
  "MCQ",
  "Predict Output",
  "Code Trace",
  "Find the Bug",
  "Fix the Code",
  "Write Code",
  "Conceptual",
  "Scenario",
  "Architecture",
  "Follow-up",
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const MCQ_OPTION_IDS = ["A", "B", "C", "D"] as const;
export type McqOptionId = (typeof MCQ_OPTION_IDS)[number];

export interface McqOption {
  id: McqOptionId;
  text: string;
}

/** Language hint for syntax highlighting. Derived, never alters content. */
export type CodeLanguage = "tsx" | "css" | "markup";

export interface Question {
  id: string;
  technology: Technology;
  topic: string;
  subtopic: string;
  difficulty: Difficulty;
  type: QuestionType;
  question: string;
  /** null when the workbook cell is empty (not applicable). */
  code: string | null;
  codeLanguage: CodeLanguage | null;
  /** Present only for MCQ. */
  options: McqOption[] | null;
  correctAnswer: string;
  explanation: string;
  hints: [string, string];
  /** Present only for Predict Output and Code Trace. */
  expectedOutput: string | null;
  sourceUrl: string;
  /** For Follow-up questions: the ID of the question it follows. */
  parentId: string | null;
}

export interface QuestionBank {
  generatedFrom: string;
  questionCount: number;
  questions: Question[];
}

/** Types whose answer can be checked objectively by the app. */
export function isAutoGraded(type: QuestionType): boolean {
  return type === "MCQ";
}

/** Types that require an Expected Output per the Schema sheet. */
export function requiresExpectedOutput(type: QuestionType): boolean {
  return type === "Predict Output" || type === "Code Trace";
}

/** Types whose reference answer is code and should be shown as a code block. */
export function answerIsCode(type: QuestionType): boolean {
  return type === "Write Code" || type === "Fix the Code";
}

/** Types where the user's draft is code-like (monospace input). */
export function draftIsCode(type: QuestionType): boolean {
  return (
    type === "Predict Output" ||
    type === "Code Trace" ||
    type === "Write Code" ||
    type === "Fix the Code"
  );
}
