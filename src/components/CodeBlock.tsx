"use client";

import { Highlight, type PrismTheme } from "prism-react-renderer";
import type { CodeLanguage } from "@/lib/types";

/** Warm, high-contrast palette tuned for the dark code surface (AA on #1d1c18). */
const labTheme: PrismTheme = {
  plain: { color: "#ece8de", backgroundColor: "transparent" },
  styles: [
    { types: ["comment", "prolog", "doctype", "cdata"], style: { color: "#a39d8f", fontStyle: "italic" } },
    { types: ["punctuation"], style: { color: "#c7c1b3" } },
    { types: ["keyword", "atrule", "important", "rule"], style: { color: "#ff9a66" } },
    { types: ["string", "char", "attr-value", "template-string", "inserted"], style: { color: "#b5d98a" } },
    { types: ["number", "boolean", "constant", "unit"], style: { color: "#f2c46d" } },
    { types: ["function", "class-name", "maybe-class-name"], style: { color: "#8fc8ff" } },
    { types: ["tag", "selector", "property"], style: { color: "#f59ab8" } },
    { types: ["attr-name", "builtin", "parameter"], style: { color: "#e6c3ff" } },
    { types: ["operator", "entity", "url"], style: { color: "#d8d2c4" } },
    { types: ["regex", "variable"], style: { color: "#7fd6c2" } },
    { types: ["deleted"], style: { color: "#ff8a8a" } },
  ],
};

const LANG_LABEL: Record<CodeLanguage, string> = { tsx: "JavaScript / TypeScript", css: "CSS", markup: "HTML" };

interface Props {
  code: string;
  language: CodeLanguage;
  /** Accessible name and visible caption for the block. */
  label: string;
  showLineNumbers?: boolean;
}

/**
 * Renders code as React text nodes (never as HTML). Long lines scroll
 * horizontally; the scroll region is focusable for keyboard users.
 */
export function CodeBlock({ code, language, label, showLineNumbers = true }: Props) {
  return (
    <figure className="code-surface overflow-hidden rounded-lg border border-[#3a3d42] bg-code-bg text-code-ink">
      <figcaption className="flex items-center justify-between border-b border-[#3a3d42] px-4 py-2 text-xs font-semibold text-[#b9bec6]">
        <span>{label}</span>
        <span>{LANG_LABEL[language]}</span>
      </figcaption>
      <Highlight code={code} language={language} theme={labTheme}>
        {({ tokens, getLineProps, getTokenProps }) => (
          <pre
            tabIndex={0}
            aria-label={`${label} (scrollable)`}
            className="overflow-x-auto py-3 font-mono text-[0.86rem] leading-[1.65] sm:text-[0.9rem]"
          >
            <code className="block min-w-max">
              {tokens.map((line, i) => {
                const lineProps = getLineProps({ line });
                return (
                  <span key={i} style={lineProps.style} className="flex px-4">
                    {showLineNumbers ? (
                      <span aria-hidden="true" className="mr-4 inline-block w-6 shrink-0 text-right text-[#8a9099] select-none">
                        {i + 1}
                      </span>
                    ) : null}
                    <span className="whitespace-pre">
                      {line.map((token, j) => {
                        // Colours come from the theme as inline styles. Prism's class
                        // names ("token tag", "block", ...) are deliberately dropped:
                        // they collide with app classes such as the .tag badge.
                        const { style, children } = getTokenProps({ token });
                        return (
                          <span key={j} style={style}>
                            {children}
                          </span>
                        );
                      })}
                      {line.length === 1 && line[0]?.empty ? "\n" : null}
                    </span>
                  </span>
                );
              })}
            </code>
          </pre>
        )}
      </Highlight>
    </figure>
  );
}

/** Monospace block for exact console output (no highlighting). */
export function OutputBlock({ text, label }: { text: string; label: string }) {
  return (
    <figure className="code-surface overflow-hidden rounded-lg border border-[#3a3d42] bg-code-bg text-code-ink">
      <figcaption className="border-b border-[#3a3d42] px-4 py-2 text-xs font-semibold text-[#b9bec6]">
        {label}
      </figcaption>
      <pre tabIndex={0} aria-label={`${label} (scrollable)`} className="overflow-x-auto px-4 py-3 font-mono text-[0.9rem] leading-[1.65] whitespace-pre">
        {text}
      </pre>
    </figure>
  );
}
