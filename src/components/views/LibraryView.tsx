"use client";

import { useDeferredValue, useId, useMemo, useState } from "react";
import { QUESTIONS } from "@/lib/bank";
import { actions, useHydrated, useLabState } from "@/lib/store";
import { EMPTY_FILTERS, filterQuestions, type QuestionFilters } from "@/lib/session";
import { useStartSession } from "@/lib/useStartSession";
import { FilterPanel } from "../Filters";
import { QuestionMeta } from "../ui";

type View = "all" | "bookmarks" | "review";
const PAGE = 25;
const OUTCOME_LABEL = { correct: "Last answer correct", incorrect: "Last answer incorrect", "got-it": "Last marked got it", missed: "Last marked missed" } as const;

export function LibraryView() {
  const hydrated = useHydrated();
  const state = useLabState();
  const start = useStartSession();
  const [filters, setFilters] = useState<QuestionFilters>(EMPTY_FILTERS);
  const [view, setView] = useState<View>("all");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const deferredQuery = useDeferredValue(query);
  const ids = useId();

  const list = useMemo(() => {
    let qs = filterQuestions(QUESTIONS, filters);
    if (view === "bookmarks") qs = qs.filter((q) => state.bookmarks.includes(q.id));
    if (view === "review") qs = qs.filter((q) => state.reviewQueue.includes(q.id));
    const needle = deferredQuery.trim().toLowerCase();
    if (needle) {
      qs = qs.filter((q) =>
        [q.id, q.question, q.topic, q.subtopic].some((field) => field.toLowerCase().includes(needle)),
      );
    }
    return qs;
  }, [filters, view, deferredQuery, state.bookmarks, state.reviewQueue]);

  const tabs: { id: View; label: string; count?: number }[] = [
    { id: "all", label: "All questions" },
    { id: "bookmarks", label: "Bookmarks", count: hydrated ? state.bookmarks.length : undefined },
    { id: "review", label: "Review queue", count: hydrated ? state.reviewQueue.length : undefined },
  ];

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-4xl font-bold sm:text-5xl">Browse the bank</h1>
        <p className="max-w-[60ch] text-ink-2">Search, filter and save questions, or practise any of them on its own.</p>
      </header>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <details className="card p-5 lg:hidden">
          <summary className="font-display font-semibold">Filters</summary>
          <div className="mt-5">
            <FilterPanel questions={QUESTIONS} filters={filters} onChange={(f) => { setFilters(f); setLimit(PAGE); }} />
          </div>
        </details>
        <div className="hidden lg:block">
          <FilterPanel questions={QUESTIONS} filters={filters} onChange={(f) => { setFilters(f); setLimit(PAGE); }} />
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Show">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={view === t.id}
                className="chip"
                onClick={() => {
                  setView(t.id);
                  setLimit(PAGE);
                }}
              >
                {t.label}
                {t.count !== undefined ? <span className="text-xs tabular-nums opacity-70">{t.count}</span> : null}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex flex-1 flex-col gap-1.5">
              <label htmlFor={`${ids}-search`} className="text-sm font-medium">
                Search questions
              </label>
              <input
                id={`${ids}-search`}
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setLimit(PAGE);
                }}
                placeholder="e.g. closure, useEffect, JS-039"
                className="field"
              />
            </div>
            <button
              type="button"
              className="btn btn-primary"
              disabled={list.length === 0}
              onClick={() => start(view === "all" ? "Library selection" : view === "bookmarks" ? "Bookmarked questions" : "Review queue", view === "review" ? "review" : view === "bookmarks" ? "bookmarks" : "custom", list.slice(0, 50).map((q) => q.id))}
            >
              Practise {Math.min(list.length, 50)}
              {list.length > 50 ? " of these" : ""}
            </button>
          </div>

          <p aria-live="polite" className="text-sm text-ink-3">
            {list.length} question{list.length === 1 ? "" : "s"}
          </p>

          {list.length === 0 ? (
            <div className="card p-8 text-ink-2">
              {view === "bookmarks"
                ? "No bookmarks here yet. Use ☆ on any question to save it."
                : view === "review"
                  ? "Your review queue is empty. Missed questions land here automatically."
                  : "No questions match. Try a different search or fewer filters."}
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {list.slice(0, limit).map((q) => {
                const bookmarked = state.bookmarks.includes(q.id);
                const queued = state.reviewQueue.includes(q.id);
                const rec = hydrated ? state.progress[q.id] : undefined;
                return (
                  <li key={q.id} className="card flex flex-col gap-3 p-4 sm:p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <QuestionMeta q={q} compact />
                      {rec ? (
                        <span className={`text-sm font-semibold ${rec.lastOutcome === "correct" || rec.lastOutcome === "got-it" ? "text-good" : "text-bad"}`}>
                          {OUTCOME_LABEL[rec.lastOutcome]}
                        </span>
                      ) : null}
                    </div>
                    <p className="font-medium whitespace-pre-wrap">{q.question}</p>
                    <p className="text-sm text-ink-3">
                      {q.topic}: {q.subtopic}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className="btn btn-sm" onClick={() => start(`Question ${q.id}`, "single", [q.id])}>
                        Practise<span className="sr-only"> {q.id}</span>
                      </button>
                      <button type="button" aria-pressed={bookmarked} className="btn btn-sm btn-ghost" onClick={() => actions.toggleBookmark(q.id)}>
                        <span aria-hidden="true">{bookmarked ? "★" : "☆"}</span> {bookmarked ? "Bookmarked" : "Bookmark"}
                        <span className="sr-only"> {q.id}</span>
                      </button>
                      <button type="button" aria-pressed={queued} className="btn btn-sm btn-ghost" onClick={() => actions.toggleReview(q.id)}>
                        <span aria-hidden="true">{queued ? "●" : "○"}</span> {queued ? "In review" : "Add to review"}
                        <span className="sr-only"> {q.id}</span>
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {list.length > limit ? (
            <button type="button" className="btn self-center" onClick={() => setLimit((l) => l + PAGE)}>
              Show more ({list.length - limit} left)
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
