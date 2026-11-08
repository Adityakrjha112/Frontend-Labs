"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { QUESTIONS } from "@/lib/bank";
import { actions, useHydrated, useLabState } from "@/lib/store";
import { EMPTY_FILTERS, filterQuestions, quickTen, selectQuestions, type QuestionFilters } from "@/lib/session";
import { useStartSession } from "@/lib/useStartSession";
import { FilterPanel } from "../Filters";

const PRESETS = [5, 10, 20, 30] as const;

function describe(f: QuestionFilters): string {
  const parts = [
    f.technologies.length ? `${f.technologies.length} tech` : null,
    f.topics.length ? `${f.topics.length} topic${f.topics.length > 1 ? "s" : ""}` : null,
    f.difficulties.length ? f.difficulties.join("/") : null,
    f.types.length ? `${f.types.length} type${f.types.length > 1 ? "s" : ""}` : null,
  ].filter(Boolean);
  return parts.length ? `Custom: ${parts.join(", ")}` : "Custom: mixed";
}

export function PracticeView() {
  const hydrated = useHydrated();
  const state = useLabState();
  const start = useStartSession();
  const [filters, setFilters] = useState<QuestionFilters>(EMPTY_FILTERS);
  const [count, setCount] = useState(10);
  const [unseenFirst, setUnseenFirst] = useState(true);
  const ids = useId();

  const matches = useMemo(() => filterQuestions(QUESTIONS, filters), [filters]);
  const seen = useMemo(() => new Set(Object.keys(state.progress)), [state.progress]);
  const unseenMatches = matches.filter((q) => !seen.has(q.id)).length;
  const effective = Math.min(Math.max(1, count || 1), matches.length);
  const countInvalid = !Number.isInteger(count) || count < 1;

  const begin = () => {
    const picked = selectQuestions(matches, effective, { seen: unseenFirst ? seen : undefined });
    start(describe(filters), "custom", picked.map((q) => q.id));
  };

  return (
    <div className="flex flex-col gap-10 pb-20 lg:pb-0">
      <header className="flex flex-col gap-2">
        <h1 className="text-4xl font-bold sm:text-5xl">Set up a session</h1>
        <p className="text-ink-2">
          Or{" "}
          <Link href="/library" className="font-medium text-accent underline">
            browse the question library
          </Link>
          , or practise a week from the{" "}
          <Link href="/roadmap" className="font-medium text-accent underline">
            roadmap
          </Link>
          .
        </p>
        {hydrated && state.activeSession ? (
          <div>
            <Link href="/session" className="btn btn-primary">
              Resume {state.activeSession.title}
            </Link>
          </div>
        ) : null}
      </header>

      <section aria-label="Quick starts" className="grid gap-4 md:grid-cols-3">
        <div className="card flex flex-col gap-3 border-l-[6px] border-l-[var(--bm-content)] p-4 sm:p-6">
          <h2 className="text-2xl font-bold">10 at random</h2>
          <p className="text-sm text-ink-2">Ten random questions across everything, favouring ones you haven’t seen.</p>
          <button
            type="button"
            className="btn btn-primary mt-auto self-start"
            onClick={() => start("Quick 10", "quick", quickTen(QUESTIONS, seen).map((q) => q.id))}
          >
            Practise 10 questions
          </button>
        </div>
        <div className="card flex flex-col gap-3 p-4 sm:p-6">
          <h2 className="text-2xl font-bold">Review queue</h2>
          <p className="text-sm text-ink-2">
            {hydrated ? `${state.reviewQueue.length} question${state.reviewQueue.length === 1 ? "" : "s"}` : "…"} you missed or
            flagged. Answer them right to clear them.
          </p>
          <button
            type="button"
            className="btn mt-auto self-start"
            disabled={!hydrated || state.reviewQueue.length === 0}
            onClick={() => start("Review queue", "review", state.reviewQueue)}
          >
            Review now
          </button>
        </div>
        <div className="card flex flex-col gap-3 p-4 sm:p-6">
          <h2 className="text-2xl font-bold">Bookmarks</h2>
          <p className="text-sm text-ink-2">
            {hydrated ? `${state.bookmarks.length} saved question${state.bookmarks.length === 1 ? "" : "s"}` : "…"}.
          </p>
          <button
            type="button"
            className="btn mt-auto self-start"
            disabled={!hydrated || state.bookmarks.length === 0}
            onClick={() => start("Bookmarked questions", "bookmarks", state.bookmarks)}
          >
            Practise bookmarks
          </button>
        </div>
      </section>

      <section aria-labelledby={`${ids}-builder`} className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id={`${ids}-builder`} className="text-2xl font-bold">
              Custom session
            </h2>
            <button type="button" className="min-h-11 text-sm text-ink-3 underline hover:text-ink" onClick={() => setFilters(EMPTY_FILTERS)}>
              Reset filters
            </button>
          </div>
          <FilterPanel questions={QUESTIONS} filters={filters} onChange={setFilters} />
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <form
            className="card flex flex-col gap-5 p-4 sm:p-6"
            onSubmit={(e) => {
              e.preventDefault();
              if (matches.length > 0 && !countInvalid) begin();
            }}
          >
            <p aria-live="polite" className="flex flex-col">
              <span className="font-display text-5xl font-bold tabular-nums">{matches.length}</span>
              <span className="text-sm text-ink-3">
                matching question{matches.length === 1 ? "" : "s"}
                {hydrated && matches.length > 0 ? `, ${unseenMatches} unseen` : ""}
              </span>
            </p>

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 font-display font-semibold">How many?</legend>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <button key={p} type="button" aria-pressed={count === p} className="chip tabular-nums" onClick={() => setCount(p)}>
                    {p}
                  </button>
                ))}
                <button
                  type="button"
                  aria-pressed={count === matches.length && !PRESETS.includes(count as never)}
                  className="chip"
                  onClick={() => setCount(Math.max(1, matches.length))}
                >
                  All
                </button>
              </div>
              <label htmlFor={`${ids}-count`} className="mt-1 text-sm text-ink-2">
                Or enter a number
              </label>
              <input
                id={`${ids}-count`}
                type="number"
                inputMode="numeric"
                min={1}
                max={QUESTIONS.length}
                value={Number.isNaN(count) ? "" : count}
                onChange={(e) => setCount(e.target.valueAsNumber)}
                aria-invalid={countInvalid}
                aria-describedby={`${ids}-count-note`}
                className="field tabular-nums"
              />
              <p id={`${ids}-count-note`} className="text-xs text-ink-3">
                {countInvalid
                  ? "Enter a whole number of at least 1."
                  : matches.length > 0 && count > matches.length
                    ? `Only ${matches.length} match, so the session will include all of them.`
                    : " "}
              </p>
            </fieldset>

            <label className="flex items-center gap-3 text-sm">
              <input type="checkbox" checked={unseenFirst} onChange={(e) => setUnseenFirst(e.target.checked)} className="size-4 accent-[var(--accent)]" />
              Prefer questions I haven’t seen
            </label>
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={state.preferences.timer}
                onChange={(e) => actions.setTimerPreference(e.target.checked)}
                className="size-4 accent-[var(--accent)]"
              />
              Show a timer on each question
            </label>

            <button type="submit" className="btn btn-primary" disabled={matches.length === 0 || countInvalid}>
              {matches.length === 0 ? "No questions match" : `Start ${effective} question${effective === 1 ? "" : "s"}`}
            </button>
            {matches.length === 0 ? (
              <p role="status" className="text-sm text-bad">
                No questions match these filters. Remove a filter to widen the pool.
              </p>
            ) : null}
          </form>
        </aside>
      </section>

      {/* Phones: the match count and Start stay in reach while choosing filters. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <p className="text-sm text-ink-2">
            <span className="font-display text-xl font-bold text-ink tabular-nums">{matches.length}</span> matching
          </p>
          <button type="button" className="btn btn-primary" disabled={matches.length === 0 || countInvalid} onClick={begin}>
            {matches.length === 0 ? "No questions match" : `Start ${effective}`}
          </button>
        </div>
      </div>
    </div>
  );
}
