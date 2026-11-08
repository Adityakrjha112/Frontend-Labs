/**
 * Minimal, dependency-light .xlsx reader.
 *
 * The source workbook is written with namespace-prefixed SpreadsheetML
 * (`<x:worksheet>`, `t="str"` cells), which common spreadsheet libraries fail
 * to parse, so we unzip and read the parts directly. Every cell is returned
 * as text; formulas are never evaluated.
 */
import { readFile } from "node:fs/promises";
import { unzipSync, strFromU8 } from "fflate";
import { XMLParser } from "fast-xml-parser";
import type { RawWorkbook, SheetGrid } from "./validate";

const ARRAY_TAGS = new Set(["sheet", "Relationship", "si", "r", "row", "c"]);

const parser = new XMLParser({
  removeNSPrefix: true,
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: false,
  processEntities: true,
  isArray: (name) => ARRAY_TAGS.has(name),
});

type XmlNode = Record<string, unknown>;

export class WorkbookFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkbookFormatError";
  }
}

function parseXml(files: Record<string, Uint8Array>, path: string): XmlNode {
  const data = files[path];
  if (!data) throw new WorkbookFormatError(`missing part "${path}" in workbook package`);
  return parser.parse(strFromU8(data).replace(/^﻿/, "")) as XmlNode;
}

/** Text content of a parsed node (`<t>`/`<v>`), regardless of attributes. */
function textOf(node: unknown): string {
  if (node === undefined || node === null) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number" || typeof node === "boolean") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (typeof node === "object") {
    const obj = node as XmlNode;
    if ("#text" in obj) return textOf(obj["#text"]);
  }
  return "";
}

/** Shared-string item: plain `<t>` or rich-text runs `<r><t>`. Phonetic runs are ignored. */
function sharedStringText(si: XmlNode): string {
  if (si.t !== undefined) return textOf(si.t);
  if (Array.isArray(si.r)) return (si.r as XmlNode[]).map((r) => textOf(r.t)).join("");
  return "";
}

/** "AB12" → 27 (0-based column index). */
export function columnIndex(ref: string): number {
  const letters = /^([A-Z]+)/.exec(ref)?.[1];
  if (!letters) throw new WorkbookFormatError(`invalid cell reference "${ref}"`);
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function resolveTarget(target: string): string {
  if (target.startsWith("/")) return target.slice(1);
  return `xl/${target.replace(/^\.\//, "")}`;
}

function cellText(c: XmlNode, shared: string[]): string {
  const type = (c["@_t"] as string | undefined) ?? "n";
  if (type === "inlineStr") {
    const is = c.is as XmlNode | undefined;
    return is ? sharedStringText(is) : "";
  }
  const raw = textOf(c.v);
  if (type === "s") {
    const idx = Number(raw);
    const value = shared[idx];
    if (value === undefined) throw new WorkbookFormatError(`shared string index ${raw} out of range`);
    return value;
  }
  if (type === "b") return raw === "1" ? "TRUE" : raw === "0" ? "FALSE" : raw;
  return raw; // "str", "n", "e", "d": keep the stored text exactly.
}

function readSheet(xml: XmlNode, shared: string[]): SheetGrid {
  const ws = xml.worksheet as XmlNode | undefined;
  const rows = ((ws?.sheetData as XmlNode | undefined)?.row ?? []) as XmlNode[];
  const grid: SheetGrid = [];
  for (const [i, row] of rows.entries()) {
    const rowNumber = row["@_r"] ? Number(row["@_r"]) : i + 1;
    const cells: string[] = [];
    for (const [j, c] of ((row.c ?? []) as XmlNode[]).entries()) {
      const ref = c["@_r"] as string | undefined;
      const col = ref ? columnIndex(ref) : j;
      while (cells.length < col) cells.push("");
      cells[col] = cellText(c, shared);
    }
    while (grid.length < rowNumber - 1) grid.push([]);
    grid[rowNumber - 1] = cells;
  }
  const width = Math.max(0, ...grid.map((r) => r.length));
  return grid.map((r) => [...r, ...Array<string>(width - r.length).fill("")]);
}

export function readWorkbookBuffer(buffer: Uint8Array): RawWorkbook {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(buffer);
  } catch (e) {
    throw new WorkbookFormatError(`file is not a valid .xlsx package (${(e as Error).message})`);
  }
  const workbook = parseXml(files, "xl/workbook.xml").workbook as XmlNode | undefined;
  const rels = (parseXml(files, "xl/_rels/workbook.xml.rels").Relationships as XmlNode | undefined)
    ?.Relationship as XmlNode[] | undefined;
  const relTargets = new Map((rels ?? []).map((r) => [r["@_Id"] as string, r["@_Target"] as string]));

  const shared: string[] = files["xl/sharedStrings.xml"]
    ? (((parseXml(files, "xl/sharedStrings.xml").sst as XmlNode | undefined)?.si ?? []) as XmlNode[]).map(
        sharedStringText,
      )
    : [];

  const sheetEntries = ((workbook?.sheets as XmlNode | undefined)?.sheet ?? []) as XmlNode[];
  const sheets: RawWorkbook["sheets"] = {};
  for (const s of sheetEntries) {
    const name = s["@_name"] as string;
    const relId = s["@_id"] as string; // r:id with prefix removed
    const target = relTargets.get(relId);
    if (!target) throw new WorkbookFormatError(`sheet "${name}" has no relationship target`);
    sheets[name] = readSheet(parseXml(files, resolveTarget(target)), shared);
  }
  return { sheets };
}

export async function readWorkbookFile(path: string): Promise<RawWorkbook> {
  return readWorkbookBuffer(new Uint8Array(await readFile(path)));
}
