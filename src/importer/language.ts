import type { CodeLanguage } from "../lib/types";

const JS_HINT = /\b(const|let|var|function|import|export|return|await|async|console)\b|=>|\bclass\s+[A-Z]/;
const CSS_RULE = /^\s*(@[a-z-]+|[.#:*[\]a-zA-Z][^{};=()<>]*)\s*\{/m;

/**
 * Picks a highlighting grammar for a snippet. This is a display hint only;
 * it never changes the snippet text.
 */
export function detectLanguage(code: string): CodeLanguage {
  const trimmed = code.trimStart();
  if (/^@(import|tailwind|layer|theme|custom-variant|utility|media|container|supports|font-face)\b/.test(trimmed)) {
    return "css";
  }
  if (JS_HINT.test(code)) return "tsx";
  if (trimmed.startsWith("<")) return "markup";
  if (CSS_RULE.test(code)) return "css";
  return "tsx";
}
