"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { MONTHS } from "@/roadmap/model";
import { currentTopic, doneCount, pct } from "@/roadmap/state";
import { useRoadmapState } from "@/roadmap/store";
import { useHydrated } from "@/lib/store";

/**
 * The roadmap drawn as a DevTools box-model diagram. Month 1 (the platform)
 * is the content box; each later month wraps the one before it, because it
 * builds on it. Layer styles follow DevTools: content, padding, border,
 * margin, then the dashed "position" layer and the outer viewport.
 */
const LAYER: Record<number, CSSProperties> = {
  1: { background: "var(--bm-content)" },
  2: { background: "var(--bm-padding)" },
  3: { background: "var(--bm-border)" },
  4: { background: "var(--bm-margin)" },
  5: { background: "var(--card)", border: "1px dashed var(--ink-3)" },
  6: { background: "var(--paper)", border: "1px solid var(--ink)" },
};

export function BoxModel() {
  const state = useRoadmapState();
  const hydrated = useHydrated();
  const cur = hydrated ? currentTopic(state) : null;

  // Build from the core outward so each month wraps the previous one.
  let inner: ReactNode = null;
  for (const m of MONTHS) {
    const p = hydrated ? pct(doneCount(state, m.items), m.items.length) : 0;
    const here = cur?.monthId === m.id;
    const isCore = m.n === 1;
    inner = (
      <div
        className={`box-layer relative flex flex-col rounded-[4px] ${isCore ? "min-h-28 justify-center p-4 sm:min-h-32" : "p-2 pt-0 sm:p-3 sm:pt-0"} ${
          here ? "outline-2 outline-offset-[-2px] outline-accent" : ""
        }`}
        style={{ ...LAYER[m.n], animationDelay: `${(MONTHS.length - m.n) * 80}ms` }}
      >
        <Link
          href={`/roadmap#month-${m.id}`}
          className={`flex items-baseline justify-between gap-3 rounded-sm text-ink no-underline hover:underline ${
            isCore ? "flex-col items-start" : "min-h-11 items-center py-1.5 text-[0.8rem] sm:min-h-0 sm:text-sm"
          }`}
        >
          <span className={isCore ? "font-display text-xl leading-tight font-extrabold sm:text-2xl" : "font-semibold"}>
            Month {m.n}: {m.theme}
            {here ? <span className="sr-only"> (you are here)</span> : null}
          </span>
          <span className={`tabular-nums ${isCore ? "text-sm font-semibold" : "font-medium"}`}>
            {hydrated ? `${p}% done` : " "}
          </span>
        </Link>
        {inner}
      </div>
    );
  }

  return (
    <nav aria-label="Roadmap months, outermost first" className="box-model">
      {inner}
      <p className="mt-3 text-sm text-ink-3">
        Each month wraps the one inside it. {cur ? `You're in month ${MONTHS.find((m) => m.id === cur.monthId)?.n}, outlined.` : ""}
      </p>
    </nav>
  );
}
