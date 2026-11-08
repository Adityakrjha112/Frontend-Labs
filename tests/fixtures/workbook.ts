import { strToU8, zipSync } from "fflate";
import { COLUMNS, type Column, type RawWorkbook, type SheetGrid } from "@/importer/validate";

/** Mirrors the real workbook's Schema sheet. */
export const SCHEMA_GRID: SheetGrid = [
  ["Column Name", "Data Type", "Required (Yes/Conditional)", "Description", "Allowed Values / Format", "Example"],
  ...COLUMNS.map((c) => [
    c,
    "Text",
    ["Code Snippet", "Options", "Expected Output"].includes(c) ? "Conditional" : "Yes",
    "",
    "",
    "",
  ]),
];

export type RowInput = Partial<Record<Column, string>>;

const MCQ_OPTIONS = JSON.stringify([
  { id: "A", text: "pending, fulfilled, rejected" },
  { id: "B", text: "waiting, running, complete" },
  { id: "C", text: "pending, resolved, canceled" },
  { id: "D", text: "created, scheduled, destroyed" },
]);

export const BASE_ROWS: Record<string, RowInput> = {
  mcq: {
    ID: "ASYNC-001",
    Technology: "Async JavaScript & Event Loop",
    Topic: "Promises",
    Subtopic: "States and settlement",
    Difficulty: "Beginner",
    "Question Type": "MCQ",
    Question: "Which set lists the three Promise states?",
    Options: MCQ_OPTIONS,
    "Correct Answer": "A",
    "Detailed Explanation": "A promise starts pending and settles once.",
    "Hint 1": "Settlement has two outcomes.",
    "Hint 2": "Is resolved necessarily fulfilled?",
    "Source URL": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise",
  },
  output: {
    ID: "ASYNC-002",
    Technology: "Async JavaScript & Event Loop",
    Topic: "Promises",
    Subtopic: "Executor timing",
    Difficulty: "Intermediate",
    "Question Type": "Predict Output",
    Question: "What is the exact log order?",
    "Code Snippet": 'console.log("start");\nPromise.resolve().then(() => console.log("then"));\nconsole.log("end");',
    "Correct Answer": "start\nend\nthen",
    "Detailed Explanation": "1. Sync first.\n2. Microtask after.",
    "Hint 1": "Think queues.",
    "Hint 2": "Microtasks run after the stack empties.",
    "Expected Output": "start\nend\nthen",
    "Source URL": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/then",
  },
  conceptual: {
    ID: "ASYNC-003",
    Technology: "Async JavaScript & Event Loop",
    Topic: "Async functions",
    Subtopic: "try/catch",
    Difficulty: "Advanced",
    "Question Type": "Conceptual",
    Question: "How does an awaited rejected promise interact with try/catch?",
    "Correct Answer": "await throws the rejection reason.",
    "Detailed Explanation": "The await expression throws.",
    "Hint 1": "Where is the error thrown?",
    "Hint 2": "Think of await as unwrapping.",
    "Source URL": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/await",
  },
  followUp: {
    ID: "ASYNC-004",
    Technology: "Async JavaScript & Event Loop",
    Topic: "Promises",
    Subtopic: "Combinators",
    Difficulty: "Advanced",
    "Question Type": "Follow-up",
    Question: "Follow-up to ASYNC-001: what does Promise.all do on rejection?",
    "Correct Answer": "It rejects with the first reason.",
    "Detailed Explanation": "Fail-fast behaviour.",
    "Hint 1": "Fail fast.",
    "Hint 2": "First rejection wins.",
    "Source URL": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all",
  },
  css: {
    ID: "HCT-001",
    Technology: "HTML, CSS, Tailwind",
    Topic: "Cascade layers",
    Subtopic: "Layer order",
    Difficulty: "Intermediate",
    "Question Type": "Write Code",
    Question: "Declare the layer order.",
    "Code Snippet": "'@layer base, theme;\n@layer base { .title { color: red; } }",
    "Correct Answer": "'@import \"tailwindcss\";",
    "Detailed Explanation": "Layers are ordered by first declaration.",
    "Hint 1": "Order matters.",
    "Hint 2": "Declare early.",
    "Source URL": "https://developer.mozilla.org/en-US/docs/Web/CSS/@layer",
  },
};

export function toRow(input: RowInput): string[] {
  return COLUMNS.map((c) => input[c] ?? "");
}

export function questionsGrid(rows: RowInput[], header: readonly string[] = COLUMNS): SheetGrid {
  return [[...header], ...rows.map(toRow)];
}

export function makeWorkbook(rows: RowInput[] = Object.values(BASE_ROWS)): RawWorkbook {
  return {
    sheets: {
      Overview: [["Frontend interview question bank"], ["Total unique questions", String(rows.length)]],
      Schema: SCHEMA_GRID,
      All_Questions: questionsGrid(rows),
    },
  };
}

/* ------------------------------------------------------------------ */
/* Real .xlsx writer (namespace-prefixed like the source workbook)     */
/* ------------------------------------------------------------------ */

const NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function colName(i: number): string {
  let n = i + 1;
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export interface XlsxOptions {
  /** Store strings via sharedStrings (t="s") instead of t="str". */
  sharedStrings?: boolean;
}

export function buildXlsx(sheets: Record<string, SheetGrid>, opts: XlsxOptions = {}): Uint8Array {
  const shared: string[] = [];
  const sharedIndex = (s: string) => {
    let i = shared.indexOf(s);
    if (i < 0) i = shared.push(s) - 1;
    return i;
  };
  const files: Record<string, Uint8Array> = {};
  const names = Object.keys(sheets);
  names.forEach((name, si) => {
    const rows = sheets[name]!
      .map((row, ri) => {
        const cells = row
          .map((v, ci) => {
            if (v === "") return ""; // sparse: omit empty cells
            const ref = `${colName(ci)}${ri + 1}`;
            return opts.sharedStrings
              ? `<x:c r="${ref}" t="s"><x:v>${sharedIndex(v)}</x:v></x:c>`
              : `<x:c r="${ref}" t="str"><x:v>${esc(v)}</x:v></x:c>`;
          })
          .join("");
        return `<x:row r="${ri + 1}">${cells}</x:row>`;
      })
      .join("");
    files[`xl/worksheets/sheet${si + 1}.xml`] = strToU8(
      `<?xml version="1.0" encoding="utf-8"?><x:worksheet xmlns:x="${NS}"><x:sheetData>${rows}</x:sheetData></x:worksheet>`,
    );
  });
  files["xl/workbook.xml"] = strToU8(
    `<?xml version="1.0" encoding="utf-8"?><x:workbook xmlns:x="${NS}"><x:sheets>${names
      .map((n, i) => `<x:sheet name="${esc(n)}" sheetId="${i + 1}" r:id="R${i + 1}" xmlns:r="${R_NS}" />`)
      .join("")}</x:sheets></x:workbook>`,
  );
  files["xl/_rels/workbook.xml.rels"] = strToU8(
    `﻿<?xml version="1.0" encoding="utf-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${names
      .map((_, i) => `<Relationship Type="${R_NS}/worksheet" Target="/xl/worksheets/sheet${i + 1}.xml" Id="R${i + 1}" />`)
      .join("")}</Relationships>`,
  );
  if (opts.sharedStrings) {
    files["xl/sharedStrings.xml"] = strToU8(
      `<?xml version="1.0" encoding="utf-8"?><x:sst xmlns:x="${NS}">${shared
        .map((s) => `<x:si><x:t xml:space="preserve">${esc(s)}</x:t></x:si>`)
        .join("")}</x:sst>`,
    );
  }
  return zipSync(files);
}
