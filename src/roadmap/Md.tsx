import { Fragment, type ReactNode } from "react";

/**
 * Inline markdown for roadmap text, rendered as React elements (no
 * innerHTML). Supports the same subset as the original tracker:
 * `code`, **bold** and [text](https://...).
 */
const TOKEN = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\[[^\]]+\]\(https:\/\/[^)\s]+\))/g;

export function renderMd(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(TOKEN)) {
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    const tok = m[0];
    if (m[1]) out.push(<code key={i++}>{tok.slice(1, -1)}</code>);
    else if (m[2]) out.push(<strong key={i++}>{tok.slice(2, -2)}</strong>);
    else {
      const [, label, href] = /^\[([^\]]+)\]\((https:\/\/[^)\s]+)\)$/.exec(tok)!;
      out.push(
        <a key={i++} href={href} target="_blank" rel="noopener noreferrer">
          {label}
          <span className="sr-only"> (opens in a new tab)</span>
        </a>,
      );
    }
    last = at + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Md({ children }: { children: string }) {
  return <Fragment>{renderMd(children)}</Fragment>;
}
