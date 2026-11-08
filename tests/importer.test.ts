import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  formatIssue,
  isEmptyCell,
  parseQuestionBank,
  stripProtectivePrefix,
  WorkbookValidationError,
  type RawWorkbook,
  type ValidationIssue,
} from "@/importer/validate";
import { readWorkbookBuffer, readWorkbookFile, columnIndex } from "@/importer/workbook";
import { detectLanguage } from "@/importer/language";
import { BASE_ROWS, buildXlsx, makeWorkbook, questionsGrid, SCHEMA_GRID, type RowInput } from "./fixtures/workbook";

function issuesOf(wb: RawWorkbook): ValidationIssue[] {
  try {
    parseQuestionBank(wb);
  } catch (e) {
    if (e instanceof WorkbookValidationError) return e.issues;
    throw e;
  }
  throw new Error("expected validation to fail");
}

const withRow = (key: keyof typeof BASE_ROWS, patch: RowInput) =>
  makeWorkbook(Object.entries(BASE_ROWS).map(([k, r]) => (k === key ? { ...r, ...patch } : r)));

describe("importer: valid workbook", () => {
  it("parses every row into a typed question", () => {
    const { questions, warnings } = parseQuestionBank(makeWorkbook());
    expect(warnings).toEqual([]);
    expect(questions.map((q) => q.id)).toEqual(["ASYNC-001", "ASYNC-002", "ASYNC-003", "ASYNC-004", "HCT-001"]);

    const mcq = questions[0]!;
    expect(mcq.type).toBe("MCQ");
    expect(mcq.options).toHaveLength(4);
    expect(mcq.options?.[0]).toEqual({ id: "A", text: "pending, fulfilled, rejected" });
    expect(mcq.correctAnswer).toBe("A");
    expect(mcq.hints).toEqual(["Settlement has two outcomes.", "Is resolved necessarily fulfilled?"]);
  });

  it("keeps content byte-for-byte (line breaks, quotes, spacing)", () => {
    const out = parseQuestionBank(makeWorkbook()).questions[1]!;
    expect(out.code).toBe(BASE_ROWS.output!["Code Snippet"]);
    expect(out.expectedOutput).toBe("start\nend\nthen");
    expect(out.explanation).toBe("1. Sync first.\n2. Microtask after.");
  });

  it("extracts the parent ID of follow-up questions", () => {
    const fu = parseQuestionBank(makeWorkbook()).questions.find((q) => q.type === "Follow-up")!;
    expect(fu.parentId).toBe("ASYNC-001");
  });

  it("reads a real .xlsx with namespace-prefixed XML and t=\"str\" cells", () => {
    const bytes = buildXlsx(makeWorkbook().sheets);
    const parsed = parseQuestionBank(readWorkbookBuffer(bytes));
    expect(parsed.questions).toHaveLength(5);
    expect(parsed.questions[1]!.code).toContain("\n");
  });

  it("reads shared strings, XML entities and sparse cells", () => {
    const bytes = buildXlsx(makeWorkbook().sheets, { sharedStrings: true });
    const raw = readWorkbookBuffer(bytes);
    const parsed = parseQuestionBank(raw);
    expect(parsed.questions[0]!.options?.[0]?.text).toBe("pending, fulfilled, rejected");
    // Empty Code Snippet for MCQ was omitted from the XML and must read as "".
    expect(raw.sheets.All_Questions![1]![7]).toBe("");
    expect(parsed.questions[1]!.code).toContain('console.log("start")');
  });

  it("imports the shipped workbook: 500 questions with expected counts", async () => {
    const raw = await readWorkbookFile(resolve("data/frontend_interview_question_bank.xlsx"));
    const { questions, warnings } = parseQuestionBank(raw);
    expect(warnings).toEqual([]);
    expect(questions).toHaveLength(500);
    const byTech = Object.fromEntries(
      [...new Set(questions.map((q) => q.technology))].map((t) => [t, questions.filter((q) => q.technology === t).length]),
    );
    expect(byTech).toMatchObject({ "JavaScript (Basic → Advanced)": 150, "React.js & Hooks": 100, "Next.js": 65 });
    expect(questions.filter((q) => q.type === "MCQ")).toHaveLength(76);
    expect(questions.every((q) => !q.code?.startsWith("'@"))).toBe(true);
  });

  it("rejects a file that is not an xlsx package", () => {
    expect(() => readWorkbookBuffer(new TextEncoder().encode("not a zip"))).toThrow(/not a valid \.xlsx/);
  });

  it("converts cell references to column indexes", () => {
    expect(columnIndex("A1")).toBe(0);
    expect(columnIndex("O501")).toBe(14);
    expect(columnIndex("AA3")).toBe(26);
  });
});

describe("importer: required fields", () => {
  it("reports sheet, row, question ID and field for an empty required value", () => {
    const issues = issuesOf(withRow("conceptual", { "Hint 2": "" }));
    expect(issues).toEqual([
      { sheet: "All_Questions", row: 4, questionId: "ASYNC-003", field: "Hint 2", message: "required value is empty" },
    ]);
    expect(formatIssue(issues[0]!)).toBe(
      'sheet "All_Questions", row 4, question ASYNC-003, field "Hint 2": required value is empty',
    );
  });

  it("treats whitespace-only values as empty", () => {
    const issues = issuesOf(withRow("mcq", { "Detailed Explanation": "   \n " }));
    expect(issues[0]).toMatchObject({ field: "Detailed Explanation", questionId: "ASYNC-001" });
  });

  it("reports a missing ID with the row number and no question ID", () => {
    const issues = issuesOf(withRow("output", { ID: "" }));
    expect(issues[0]).toMatchObject({ row: 3, questionId: null, field: "ID" });
  });

  it("fails when a header column is missing", () => {
    const wb = makeWorkbook();
    wb.sheets.All_Questions = questionsGrid([BASE_ROWS.mcq!]).map((r) => r.slice(0, 14)); // drop Source URL
    expect(issuesOf(wb)[0]).toMatchObject({ sheet: "All_Questions", row: 1, field: "Source URL" });
  });

  it("fails when the All_Questions sheet is missing", () => {
    const wb = makeWorkbook();
    delete wb.sheets.All_Questions;
    expect(issuesOf(wb)[0]).toMatchObject({ sheet: "All_Questions", message: "sheet is missing or empty" });
  });

  it("fails when the Schema sheet does not define a column", () => {
    const wb = makeWorkbook();
    wb.sheets.Schema = SCHEMA_GRID.filter((r) => r[0] !== "Hint 2");
    expect(issuesOf(wb)).toContainEqual(expect.objectContaining({ sheet: "Schema", field: "Hint 2" }));
  });

  it("collects every issue instead of stopping at the first", () => {
    const wb = makeWorkbook([
      { ...BASE_ROWS.mcq, Topic: "" },
      { ...BASE_ROWS.output, Difficulty: "Expert" },
    ]);
    const err = (() => {
      try {
        parseQuestionBank(wb);
      } catch (e) {
        return e as WorkbookValidationError;
      }
    })()!;
    expect(err.issues).toHaveLength(2);
    expect(err.message).toContain("2 issue(s)");
    expect(err.message).toContain('row 3, question ASYNC-002, field "Difficulty"');
  });
});

describe("importer: duplicate IDs", () => {
  it("flags the second occurrence and points to the first row", () => {
    const issues = issuesOf(makeWorkbook([BASE_ROWS.mcq!, { ...BASE_ROWS.conceptual, ID: "ASYNC-001" }]));
    expect(issues).toEqual([
      expect.objectContaining({ row: 3, questionId: "ASYNC-001", field: "ID", message: "duplicate ID; first used on row 2" }),
    ]);
  });

  it("rejects malformed IDs and prefixes that do not match the technology", () => {
    expect(issuesOf(withRow("mcq", { ID: "ASYNC-1" }))[0]).toMatchObject({ field: "ID" });
    expect(issuesOf(withRow("mcq", { ID: "JS-001" }))[0]?.message).toMatch(/prefix "JS" does not match/);
  });
});

describe("importer: allowed values", () => {
  it("rejects an unknown question type", () => {
    expect(issuesOf(withRow("conceptual", { "Question Type": "Essay" }))[0]).toMatchObject({
      field: "Question Type",
      message: '"Essay" is not an allowed question type',
    });
  });

  it("rejects an unknown difficulty and technology", () => {
    expect(issuesOf(withRow("conceptual", { Difficulty: "Expert" }))[0]).toMatchObject({ field: "Difficulty" });
    expect(issuesOf(withRow("conceptual", { Technology: "Vue" }))[0]).toMatchObject({ field: "Technology" });
  });

  it("rejects non-https or multiple source URLs", () => {
    expect(issuesOf(withRow("conceptual", { "Source URL": "http://example.com" }))[0]).toMatchObject({ field: "Source URL" });
    expect(issuesOf(withRow("conceptual", { "Source URL": "https://a.dev https://b.dev" }))[0]).toMatchObject({ field: "Source URL" });
  });

  it("requires follow-ups to reference an existing parent", () => {
    const issues = issuesOf(withRow("followUp", { Question: "Follow-up to ASYNC-099: what next?" }));
    expect(issues[0]).toMatchObject({ field: "Question", questionId: "ASYNC-004", message: "follow-up parent ASYNC-099 does not exist" });
    expect(issuesOf(withRow("followUp", { Question: "What next?" }))[0]).toMatchObject({ field: "Question" });
  });
});

describe("importer: MCQ options", () => {
  it.each([
    ["invalid JSON", '[{"id":"A","text":"x"},', /not valid JSON/],
    ["not an array", '{"id":"A"}', /must be a JSON array/],
    ["three options", JSON.stringify([{ id: "A", text: "a" }, { id: "B", text: "b" }, { id: "C", text: "c" }]), /exactly 4 entries, found 3/],
    ["wrong ids", JSON.stringify(["A", "B", "C", "E"].map((id) => ({ id, text: id }))), /Options\[3\]\.id must be "D"/],
    ["empty text", JSON.stringify(["A", "B", "C", "D"].map((id) => ({ id, text: id === "B" ? " " : id }))), /Options\[1\]\.text/],
    ["missing", "", /MCQ requires Options/],
  ])("rejects %s", (_name, options, pattern) => {
    const issue = issuesOf(withRow("mcq", { Options: options }))[0]!;
    expect(issue).toMatchObject({ sheet: "All_Questions", row: 2, questionId: "ASYNC-001", field: "Options" });
    expect(issue.message).toMatch(pattern);
  });

  it("rejects a correct answer that does not resolve to an option", () => {
    expect(issuesOf(withRow("mcq", { "Correct Answer": "E" }))[0]).toMatchObject({
      field: "Correct Answer",
      message: '"E" does not match any option id (A–D)',
    });
  });

  it("rejects options on non-MCQ questions", () => {
    expect(issuesOf(withRow("conceptual", { Options: BASE_ROWS.mcq!.Options }))[0]).toMatchObject({ field: "Options" });
  });
});

describe("importer: expected output", () => {
  it("is required for Predict Output and Code Trace", () => {
    expect(issuesOf(withRow("output", { "Expected Output": "" }))[0]).toMatchObject({
      row: 3,
      questionId: "ASYNC-002",
      field: "Expected Output",
      message: "Predict Output requires Expected Output",
    });
    expect(issuesOf(withRow("output", { "Question Type": "Code Trace", "Expected Output": "" }))[0]?.message).toBe(
      "Code Trace requires Expected Output",
    );
  });

  it("must match the correct answer exactly", () => {
    expect(issuesOf(withRow("output", { "Expected Output": "start\nthen\nend" }))[0]?.message).toBe(
      "must match Correct Answer exactly",
    );
  });

  it("must be empty for other types", () => {
    expect(issuesOf(withRow("conceptual", { "Expected Output": "x" }))[0]).toMatchObject({ field: "Expected Output" });
  });
});

describe("importer: empty-field handling", () => {
  it("maps empty conditional fields to null", () => {
    const [mcq, , conceptual] = parseQuestionBank(makeWorkbook()).questions;
    expect(mcq!.code).toBeNull();
    expect(mcq!.codeLanguage).toBeNull();
    expect(mcq!.expectedOutput).toBeNull();
    expect(conceptual!.options).toBeNull();
    expect(conceptual!.parentId).toBeNull();
  });

  it("treats whitespace-only conditional fields as empty", () => {
    const q = parseQuestionBank(withRow("conceptual", { "Code Snippet": "  \n", Options: " " })).questions[2]!;
    expect(q.code).toBeNull();
    expect(q.options).toBeNull();
  });

  it("ignores trailing blank rows", () => {
    const wb = makeWorkbook();
    wb.sheets.All_Questions!.push(Array(15).fill(""), Array(15).fill(""));
    expect(parseQuestionBank(wb).questions).toHaveLength(5);
  });

  it("removes exactly the protective apostrophe before =, +, - or @", () => {
    const css = parseQuestionBank(makeWorkbook()).questions.find((q) => q.id === "HCT-001")!;
    expect(css.code!.startsWith("@layer base, theme;")).toBe(true);
    expect(css.correctAnswer).toBe('@import "tailwindcss";');
    expect(css.codeLanguage).toBe("css");
    expect(stripProtectivePrefix("'=SUM(A1)")).toBe("=SUM(A1)");
    expect(stripProtectivePrefix("''@x")).toBe("''@x");
    expect(stripProtectivePrefix("'hello'")).toBe("'hello'");
  });

  it("recognises empty cells", () => {
    expect(isEmptyCell("")).toBe(true);
    expect(isEmptyCell(" \t")).toBe(true);
    expect(isEmptyCell(undefined)).toBe(true);
    expect(isEmptyCell("0")).toBe(false);
  });

  it("warns (without failing) when Overview totals disagree", () => {
    const wb = makeWorkbook();
    wb.sheets.Overview = [["Total unique questions", "500"]];
    expect(parseQuestionBank(wb).warnings[0]).toMatch(/Overview reports 500/);
  });
});

describe("importer: language detection", () => {
  it("detects JS/TS, HTML and CSS without altering content", () => {
    expect(detectLanguage("const a = 1;")).toBe("tsx");
    expect(detectLanguage('<div class="cards">\n  <article>x</article>\n</div>')).toBe("markup");
    expect(detectLanguage(".row { display: flex; }")).toBe("css");
    expect(detectLanguage('@import "tailwindcss";')).toBe("css");
    expect(detectLanguage("export default function App() { return <div />; }")).toBe("tsx");
  });
});

describe("importer CLI", () => {
  it("exits non-zero with a precise message for a malformed workbook", () => {
    const dir = mkdtempSync(join(tmpdir(), "flab-"));
    const file = join(dir, "bad.xlsx");
    const wb = makeWorkbook([BASE_ROWS.mcq!, { ...BASE_ROWS.output, "Expected Output": "" }]);
    writeFileSync(file, buildXlsx(wb.sheets));
    let stderr = "";
    let code = 0;
    try {
      execFileSync(process.execPath, ["--import", "tsx", "scripts/import-questions.ts", file], { stdio: "pipe" });
    } catch (e) {
      const err = e as { status: number; stderr: Buffer };
      code = err.status;
      stderr = err.stderr.toString();
    }
    expect(code).toBe(1);
    expect(stderr).toContain('sheet "All_Questions", row 3, question ASYNC-002, field "Expected Output"');
  });
});
