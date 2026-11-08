/**
 * Imports data/frontend_interview_question_bank.xlsx into
 * src/data/questions.json. Exits non-zero with a precise error (sheet, row,
 * question ID, field) when the workbook is malformed, which fails `build`.
 *
 * Usage: npm run import:questions [-- path/to/workbook.xlsx]
 */
import { writeFile, mkdir } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { readWorkbookFile } from "../src/importer/workbook";
import { parseQuestionBank, WorkbookValidationError } from "../src/importer/validate";
import type { QuestionBank } from "../src/lib/types";

const input = resolve(process.argv[2] ?? "data/frontend_interview_question_bank.xlsx");
const output = resolve("src/data/questions.json");

async function main() {
  const raw = await readWorkbookFile(input);
  const { questions, warnings } = parseQuestionBank(raw);
  for (const w of warnings) console.warn(`warning: ${w}`);
  const bank: QuestionBank = {
    generatedFrom: basename(input),
    questionCount: questions.length,
    questions,
  };
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(bank, null, 1) + "\n", "utf8");
  console.log(`Imported ${questions.length} questions from ${basename(input)} → src/data/questions.json`);
}

main().catch((err: unknown) => {
  if (err instanceof WorkbookValidationError) console.error(err.message);
  else console.error(`Import failed for ${input}:`, err instanceof Error ? err.message : err);
  process.exit(1);
});
