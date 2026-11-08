/**
 * Pure validation of the workbook contents into typed questions.
 *
 * Input is the raw text grid of each sheet (row 0 is the header row, which
 * is spreadsheet row 1). Nothing here touches the file system, so it can be
 * tested with in-memory fixtures.
 */
import {
  DIFFICULTIES,
  MCQ_OPTION_IDS,
  QUESTION_TYPES,
  TECHNOLOGIES,
  requiresExpectedOutput,
  type Difficulty,
  type McqOption,
  type Question,
  type QuestionType,
  type Technology,
} from "../lib/types";
import { TECHNOLOGY_META } from "../lib/taxonomy";
import { detectLanguage } from "./language";

export type SheetGrid = string[][];
export interface RawWorkbook {
  sheets: Record<string, SheetGrid>;
}

export interface ValidationIssue {
  sheet: string;
  /** 1-based spreadsheet row, or null for sheet-level problems. */
  row: number | null;
  questionId: string | null;
  field: string | null;
  message: string;
}

export function formatIssue(issue: ValidationIssue): string {
  const parts = [`sheet "${issue.sheet}"`];
  if (issue.row !== null) parts.push(`row ${issue.row}`);
  if (issue.questionId) parts.push(`question ${issue.questionId}`);
  if (issue.field) parts.push(`field "${issue.field}"`);
  return `${parts.join(", ")}: ${issue.message}`;
}

export class WorkbookValidationError extends Error {
  readonly issues: ValidationIssue[];
  constructor(issues: ValidationIssue[]) {
    const shown = issues.slice(0, 50).map((i) => `  - ${formatIssue(i)}`);
    const more = issues.length > 50 ? [`  …and ${issues.length - 50} more`] : [];
    super(
      [`Workbook validation failed with ${issues.length} issue(s):`, ...shown, ...more].join("\n"),
    );
    this.name = "WorkbookValidationError";
    this.issues = issues;
  }
}

export const SHEETS = {
  schema: "Schema",
  overview: "Overview",
  questions: "All_Questions",
} as const;

/** Columns the app depends on, in the order the Schema sheet defines them. */
export const COLUMNS = [
  "ID",
  "Technology",
  "Topic",
  "Subtopic",
  "Difficulty",
  "Question Type",
  "Question",
  "Code Snippet",
  "Options",
  "Correct Answer",
  "Detailed Explanation",
  "Hint 1",
  "Hint 2",
  "Expected Output",
  "Source URL",
] as const;
export type Column = (typeof COLUMNS)[number];

/**
 * The workbook's "Import handling" note: values beginning with =, +, - or @
 * are protected with a leading apostrophe; remove exactly that prefix.
 */
export function stripProtectivePrefix(value: string): string {
  return /^'[=+\-@]/.test(value) ? value.slice(1) : value;
}

/** Empty cells mean "not applicable" (Overview → Import handling). */
export function isEmptyCell(value: string | undefined | null): boolean {
  return value === undefined || value === null || value.trim() === "";
}

const ID_PATTERN = /^([A-Z]+)-(\d{3})$/;
const FOLLOW_UP_PATTERN = /^Follow-up to ([A-Z]+-\d{3}):/;

type SchemaRule = "Yes" | "Conditional";

function readSchema(grid: SheetGrid | undefined, issues: ValidationIssue[]): Map<string, SchemaRule> | null {
  const sheet = SHEETS.schema;
  if (!grid || grid.length === 0) {
    issues.push({ sheet, row: null, questionId: null, field: null, message: "sheet is missing or empty" });
    return null;
  }
  const header = grid[0]!.map((h) => h.trim());
  const nameCol = header.indexOf("Column Name");
  const reqCol = header.findIndex((h) => h.startsWith("Required"));
  if (nameCol < 0 || reqCol < 0) {
    issues.push({
      sheet,
      row: 1,
      questionId: null,
      field: nameCol < 0 ? "Column Name" : "Required (Yes/Conditional)",
      message: "header column is missing",
    });
    return null;
  }
  const rules = new Map<string, SchemaRule>();
  grid.slice(1).forEach((r, i) => {
    const name = (r[nameCol] ?? "").trim();
    if (!name) return;
    const req = (r[reqCol] ?? "").trim();
    if (req !== "Yes" && req !== "Conditional") {
      issues.push({ sheet, row: i + 2, questionId: null, field: name, message: `unknown requirement "${req}"; expected Yes or Conditional` });
      return;
    }
    rules.set(name, req);
  });
  for (const col of COLUMNS) {
    if (!rules.has(col)) {
      issues.push({ sheet, row: null, questionId: null, field: col, message: "column is not defined in the Schema sheet" });
    }
  }
  return rules;
}

function parseOptions(raw: string): { options: McqOption[] } | { error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return { error: `Options is not valid JSON (${(e as Error).message})` };
  }
  if (!Array.isArray(parsed)) return { error: "Options must be a JSON array" };
  if (parsed.length !== MCQ_OPTION_IDS.length) {
    return { error: `Options must contain exactly ${MCQ_OPTION_IDS.length} entries, found ${parsed.length}` };
  }
  const options: McqOption[] = [];
  for (const [i, item] of parsed.entries()) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      return { error: `Options[${i}] must be an object with id and text` };
    }
    const { id, text } = item as Record<string, unknown>;
    if (id !== MCQ_OPTION_IDS[i]) {
      return { error: `Options[${i}].id must be "${MCQ_OPTION_IDS[i]}", found ${JSON.stringify(id)}` };
    }
    if (typeof text !== "string" || text.trim() === "") {
      return { error: `Options[${i}].text must be a non-empty string` };
    }
    options.push({ id: id as McqOption["id"], text });
  }
  return { options };
}

export interface ParseResult {
  questions: Question[];
  warnings: string[];
}

/**
 * Validates the workbook and returns typed questions.
 * Throws WorkbookValidationError listing every issue found.
 */
export function parseQuestionBank(workbook: RawWorkbook): ParseResult {
  const issues: ValidationIssue[] = [];
  const warnings: string[] = [];
  const schema = readSchema(workbook.sheets[SHEETS.schema], issues);

  const sheet = SHEETS.questions;
  const grid = workbook.sheets[sheet];
  if (!grid || grid.length === 0) {
    issues.push({ sheet, row: null, questionId: null, field: null, message: "sheet is missing or empty" });
    throw new WorkbookValidationError(issues);
  }
  if (!schema) throw new WorkbookValidationError(issues);

  const header = grid[0]!.map((h) => h.trim());
  const colIndex = new Map<Column, number>();
  for (const col of COLUMNS) {
    const idx = header.indexOf(col);
    if (idx < 0) {
      issues.push({ sheet, row: 1, questionId: null, field: col, message: "required header column is missing" });
    } else {
      colIndex.set(col, idx);
    }
  }
  if (issues.length > 0) throw new WorkbookValidationError(issues);

  const questions: Question[] = [];
  const seenIds = new Map<string, number>();
  const followUps: { q: Question; row: number }[] = [];

  grid.slice(1).forEach((cells, i) => {
    const row = i +2;
    if (cells.every((c) => isEmptyCell(c))) return; // trailing blank rows

    const get = (col: Column): string => stripProtectivePrefix(cells[colIndex.get(col)!] ?? "");
    const rawId = get("ID").trim();
    const questionId = rawId || null;
    const rowIssues: ValidationIssue[] = [];
    const fail = (field: Column | null, message: string) =>
      rowIssues.push({ sheet, row, questionId, field, message });

    // Required fields per Schema.
    for (const col of COLUMNS) {
      if (schema.get(col) === "Yes" && isEmptyCell(get(col))) fail(col, "required value is empty");
    }

    // ID format, uniqueness and prefix.
    let idPrefix: string | null = null;
    if (rawId) {
      const m = ID_PATTERN.exec(rawId);
      if (!m) fail("ID", `"${rawId}" does not match PREFIX-000`);
      else idPrefix = m[1]!;
      const firstRow = seenIds.get(rawId);
      if (firstRow !== undefined) fail("ID", `duplicate ID; first used on row ${firstRow}`);
      else seenIds.set(rawId, row);
    }

    const technology = get("Technology").trim();
    if (technology && !(TECHNOLOGIES as readonly string[]).includes(technology)) {
      fail("Technology", `"${technology}" is not an allowed technology label`);
    } else if (technology && idPrefix) {
      const expected = TECHNOLOGY_META.find((t) => t.label === technology)!.idPrefix;
      if (expected !== idPrefix) fail("ID", `prefix "${idPrefix}" does not match technology (expected "${expected}")`);
    }

    const difficulty = get("Difficulty").trim();
    if (difficulty && !(DIFFICULTIES as readonly string[]).includes(difficulty)) {
      fail("Difficulty", `"${difficulty}" is not one of ${DIFFICULTIES.join(", ")}`);
    }

    const type = get("Question Type").trim();
    const typeValid = (QUESTION_TYPES as readonly string[]).includes(type);
    if (type && !typeValid) fail("Question Type", `"${type}" is not an allowed question type`);

    // Conditional: Options (MCQ only).
    const rawOptions = get("Options");
    const correct = get("Correct Answer");
    let options: McqOption[] | null = null;
    if (type === "MCQ") {
      if (isEmptyCell(rawOptions)) {
        fail("Options", "MCQ requires Options");
      } else {
        const result = parseOptions(rawOptions);
        if ("error" in result) fail("Options", result.error);
        else {
          options = result.options;
          if (!isEmptyCell(correct) && !options.some((o) => o.id === correct.trim())) {
            fail("Correct Answer", `"${correct}" does not match any option id (A–D)`);
          }
        }
      }
    } else if (typeValid && !isEmptyCell(rawOptions)) {
      fail("Options", `must be empty for ${type} questions`);
    }

    // Conditional: Expected Output (Predict Output / Code Trace only).
    const rawExpected = get("Expected Output");
    let expectedOutput: string | null = null;
    if (typeValid && requiresExpectedOutput(type as QuestionType)) {
      if (isEmptyCell(rawExpected)) fail("Expected Output", `${type} requires Expected Output`);
      else {
        expectedOutput = rawExpected;
        if (!isEmptyCell(correct) && rawExpected !== correct) {
          fail("Expected Output", "must match Correct Answer exactly");
        }
      }
    } else if (typeValid && !isEmptyCell(rawExpected)) {
      fail("Expected Output", `must be empty for ${type} questions`);
    }

    // Source URL.
    const sourceUrl = get("Source URL").trim();
    if (sourceUrl) {
      let ok = false;
      try {
        ok = new URL(sourceUrl).protocol === "https:" && !/\s/.test(sourceUrl);
      } catch {
        ok = false;
      }
      if (!ok) fail("Source URL", `"${sourceUrl}" is not a single https:// URL`);
    }

    // Follow-up parent reference.
    const questionText = get("Question");
    let parentId: string | null = null;
    if (type === "Follow-up" && !isEmptyCell(questionText)) {
      const m = FOLLOW_UP_PATTERN.exec(questionText);
      if (!m) fail("Question", 'Follow-up must start with "Follow-up to PREFIX-000:"');
      else parentId = m[1]!;
    }

    if (rowIssues.length > 0) {
      issues.push(...rowIssues);
      return;
    }

    const codeRaw = get("Code Snippet");
    const code = isEmptyCell(codeRaw) ? null : codeRaw;
    const q: Question = {
      id: rawId,
      technology: technology as Technology,
      topic: get("Topic").trim(),
      subtopic: get("Subtopic").trim(),
      difficulty: difficulty as Difficulty,
      type: type as QuestionType,
      question: questionText,
      code,
      codeLanguage: code ? detectLanguage(code) : null,
      options,
      correctAnswer: type === "MCQ" ? correct.trim() : correct,
      explanation: get("Detailed Explanation"),
      hints: [get("Hint 1"), get("Hint 2")],
      expectedOutput,
      sourceUrl,
      parentId,
    };
    questions.push(q);
    if (parentId) followUps.push({ q, row });
  });

  for (const { q, row } of followUps) {
    if (!seenIds.has(q.parentId!)) {
      issues.push({ sheet, row, questionId: q.id, field: "Question", message: `follow-up parent ${q.parentId} does not exist` });
    }
  }

  if (questions.length === 0 && issues.length === 0) {
    issues.push({ sheet, row: null, questionId: null, field: null, message: "no questions found" });
  }
  if (issues.length > 0) throw new WorkbookValidationError(issues);

  // Overview cross-check is advisory: the Overview totals are derived data.
  const overview = workbook.sheets[SHEETS.overview];
  const totalRow = overview?.find((r) => (r[0] ?? "").trim() === "Total unique questions");
  if (!overview) warnings.push(`sheet "${SHEETS.overview}" is missing; skipped total cross-check`);
  else if (totalRow && Number(totalRow[1]) !== questions.length) {
    warnings.push(`Overview reports ${totalRow[1]} questions but All_Questions has ${questions.length}`);
  }

  return { questions, warnings };
}
