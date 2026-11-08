"use client";

import { useDeferredValue, useEffect, useEffectEvent, useRef, useState } from "react";
import { Md } from "@/roadmap/Md";
import { MONTHS, ROADMAP, TOPICS, type Month } from "@/roadmap/model";
import {
  currentTopic,
  doneCount,
  FILTERS,
  matchTopic,
  pct,
  STATUS_LABEL,
  statusOf,
  type Filter,
  type RoadmapState,
} from "@/roadmap/state";
import { roadmapActions, useRoadmapState } from "@/roadmap/store";
import { useHydrated } from "@/lib/store";
import { Bar, CheckRow, Chevron, StatusPill, StorageBanner } from "./bits";
import { MonthProgress, PositionCard, RoadmapStats } from "./Overview";
import { TopicBody } from "./TopicBody";
import { CapstoneDetails } from "./docs";

const FILTER_LABEL: Record<Filter, string> = { all: "All", ...STATUS_LABEL };

/** Default open state: the current month and current week (original applyOpenPrefs). */
function defaultOpen(state: RoadmapState, id: string): boolean {
  const cur = currentTopic(state);
  if (!cur) return false;
  return id === cur.id || id === cur.monthId;
}

function MonthSection({ m, query, filter, filtering }: { m: Month; query: string; filter: Filter; filtering: boolean }) {
  const state = useRoadmapState();
  const cur = currentTopic(state);
  const visibleTopics = m.topics.filter((t) => matchTopic(state, t, query, filter));
  const monthText = filter === "all" && !!query.trim() && m.searchText.includes(query.trim().toLowerCase());
  const visible = visibleTopics.length > 0 || monthText || !filtering;
  if (!visible) return null;

  const isOpen = (id: string) => (filtering ? true : (state.prefs.open[id] ?? defaultOpen(state, id)));
  const onToggle = (id: string) => (e: React.SyntheticEvent<HTMLDetailsElement>) => {
    const open = e.currentTarget.open;
    if (open !== isOpen(id)) roadmapActions.setOpen({ [id]: open });
  };

  const wDone = m.topics.filter((t) => statusOf(state, t.id) === "completed").length;
  const iDone = doneCount(state, m.items);
  const p = pct(iDone, m.items.length);
  const c = m.content;

  return (
    <details className="rm-month scroll-mt-24" id={`month-${m.id}`} open={isOpen(m.id)} onToggle={onToggle(m.id)}>
      <summary>
        <span className="rm-month-num">
          Month {m.n}, weeks {c.weeks}
        </span>
        <span className="grid min-w-0 gap-0.5">
          <span className="text-[1.08rem] font-semibold">{c.title}</span>
          <span className="rm-meta">
            {wDone} of {m.topics.length} weeks completed
          </span>
        </span>
        <span className="rm-month-side">
          <span className="flex items-center gap-2">
            <span className="rm-meta rm-mono">{p}%</span>
            <Chevron />
          </span>
          <Bar value={p} />
          <span className="rm-meta rm-mono">
            {iDone}/{m.items.length} tasks
          </span>
        </span>
      </summary>
      <div className="rm-month-body">
        <p className="rm-muted max-w-[72ch]">
          <Md>{c.intro}</Md>
        </p>
        {c.capstone ? <CapstoneDetails collapsible /> : null}
        <div className="grid gap-2">
          {(filtering ? visibleTopics : m.topics).map((t) => {
            const st = statusOf(state, t.id);
            const done = doneCount(state, t.items);
            const here = cur?.id === t.id;
            return (
              <details
                key={t.id}
                className={`rm-topic scroll-mt-24 ${here ? "is-current" : ""}`}
                id={`topic-${t.id}`}
                data-status={st}
                open={isOpen(t.id)}
                onToggle={onToggle(t.id)}
              >
                <summary>
                  <span className="rm-wk">W{t.week}</span>
                  <span className="rm-topic-title">
                    {t.title}
                    {"gap" in t.content && t.content.gap ? <span className="rm-gap-tag">Gap focus</span> : null}
                    {here ? <span className="rm-here-tag">You are here</span> : null}
                  </span>
                  <span className="rm-topic-meta">
                    <StatusPill status={st} />
                    <span className="rm-count" aria-label={`${done} of ${t.items.length} tasks done`}>
                      {done}/{t.items.length}
                    </span>
                    <Chevron />
                  </span>
                </summary>
                <TopicBody topic={t} showPageLink />
              </details>
            );
          })}
        </div>
        <div className="rm-milestone">
          {m.milestoneItems.length ? (
            <>
              <h3 className="rm-h4">Milestone {m.n} acceptance criteria</h3>
              <ul className="rm-check-list">
                {m.milestoneItems.map((it) => (
                  <CheckRow key={it.id} item={it} idPrefix="cb-" />
                ))}
              </ul>
            </>
          ) : null}
          <h3 className="rm-h4">{c.capstone ? "Final review" : `Review checkpoint ${m.n}`}</h3>
          <p>
            <Md>{c.checkpoint}</Md>
          </p>
          <ul className="rm-check-list">
            <CheckRow item={m.checkpointItem} idPrefix="cb-" />
          </ul>
        </div>
      </div>
    </details>
  );
}

export function RoadmapView() {
  const hydrated = useHydrated();
  const state = useRoadmapState();
  const [rawQuery, setRawQuery] = useState("");
  const query = useDeferredValue(rawQuery);
  const searchRef = useRef<HTMLInputElement>(null);
  const filter = state.prefs.filter;
  const filtering = !!query.trim() || filter !== "all";
  const cur = currentTopic(state);

  const shown = TOPICS.filter((t) => matchTopic(state, t, query, filter)).length;
  const anyVisible = MONTHS.some(
    (m) =>
      !filtering ||
      m.topics.some((t) => matchTopic(state, t, query, filter)) ||
      (filter === "all" && !!query.trim() && m.searchText.includes(query.trim().toLowerCase())),
  );

  const clearFilters = () => {
    setRawQuery("");
    roadmapActions.setFilter("all");
  };

  const openMonth = (id: string) => {
    if (filtering) clearFilters();
    roadmapActions.setOpen({ [id]: true });
    requestAnimationFrame(() => {
      const el = document.getElementById(`month-${id}`);
      el?.scrollIntoView({ block: "start" });
      el?.querySelector("summary")?.focus({ preventScroll: true });
    });
  };

  // Deep links like /roadmap#topic-w6 or #month-m2 open the target.
  useEffect(() => {
    if (!hydrated) return;
    const hash = decodeURIComponent(window.location.hash.slice(1));
    const m = /^(topic|month)-(\w+)$/.exec(hash);
    if (!m) return;
    const id = m[2]!;
    const topic = TOPICS.find((t) => t.id === id);
    roadmapActions.setOpen(topic ? { [topic.monthId]: true, [id]: true } : { [id]: true });
    requestAnimationFrame(() => document.getElementById(hash)?.scrollIntoView({ block: "start" }));
  }, [hydrated]);

  // "/" focuses search, as in the original.
  const onSlash = useEffectEvent((e: KeyboardEvent) => {
    if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target as HTMLElement;
    if (["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName) || t.isContentEditable || document.querySelector("dialog[open]")) return;
    e.preventDefault();
    searchRef.current?.focus();
  });
  useEffect(() => {
    const l = (e: KeyboardEvent) => onSlash(e);
    document.addEventListener("keydown", l);
    return () => document.removeEventListener("keydown", l);
  }, []);

  const setAll = (open: boolean) => {
    const patch: Record<string, boolean> = {};
    for (const m of MONTHS) {
      patch[m.id] = open;
      for (const t of m.topics) patch[t.id] = open;
    }
    roadmapActions.setOpen(patch);
  };

  return (
    <div className="rm grid grid-cols-1 gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside aria-label="Months" className="hidden lg:sticky lg:top-24 lg:grid lg:gap-3 lg:self-start">
        <h2 className="rm-h4">Months</h2>
        <ul className="grid gap-1">
          {MONTHS.map((m) => {
            const p = pct(doneCount(state, m.items), m.items.length);
            const isCur = hydrated && cur?.monthId === m.id;
            return (
              <li key={m.id}>
                <a
                  href={`#month-${m.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    openMonth(m.id);
                  }}
                  className={`grid gap-1 rounded-lg px-2.5 py-2 text-sm no-underline ${isCur ? "bg-accent-soft" : "hover:bg-paper-2"}`}
                  style={{ color: "var(--ink)" }}
                  aria-current={isCur ? "step" : undefined}
                >
                  <span className="rm-row">
                    <span>
                      Month {m.n}: {m.theme}
                    </span>
                    <span className="rm-mono rm-muted">{p}%</span>
                  </span>
                  <Bar value={p} />
                </a>
              </li>
            );
          })}
        </ul>
      </aside>

      <div className="flex min-w-0 flex-col gap-8">
        <StorageBanner />
        <header className="flex flex-col gap-2">
          <h1 className="text-4xl font-bold sm:text-5xl">{ROADMAP.title}</h1>
          <p className="text-ink-2">
            26 weeks at about 10 hours a week.{" "}
            {hydrated ? (cur ? `You're on week ${cur.week}.` : "All 26 weeks completed.") : ""}
          </p>
        </header>

        <section aria-labelledby="rm-overview-h" className="grid gap-4">
          <h2 id="rm-overview-h" className="sr-only">
            Overview
          </h2>
          <div className="rm-overview-grid grid-cols-1 grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <PositionCard />
            <RoadmapStats />
          </div>
          {/* The sidebar shows month progress on wide screens; these cards replace it below that. */}
          <div className="lg:hidden">
            <h3 className="rm-h4 mb-2">Progress by month</h3>
            <MonthProgress onOpen={openMonth} />
          </div>
        </section>

        <section aria-labelledby="rm-list-h" className="grid gap-3.5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="rm-list-h" className="text-2xl font-bold">
              Weeks
            </h2>
            <p className="text-sm text-ink-3">Months and weeks are in dependency order.</p>
          </div>
          <div className="rm-toolbar" role="search">
            <div className="rm-search">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <label className="sr-only" htmlFor="rm-search">
                Search topics, exercises, questions, and notes
              </label>
              <input
                ref={searchRef}
                id="rm-search"
                type="search"
                className="field"
                placeholder="Search topics, exercises, questions, notes"
                autoComplete="off"
                value={rawQuery}
                onChange={(e) => setRawQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape" && rawQuery) {
                    e.stopPropagation();
                    setRawQuery("");
                  }
                }}
              />
              <kbd aria-hidden="true">/</kbd>
            </div>
            <fieldset className="rm-segmented">
              <legend className="sr-only">Filter by status</legend>
              {FILTERS.map((f) => (
                <label key={f}>
                  <input type="radio" name="rm-filter" value={f} checked={filter === f} onChange={() => roadmapActions.setFilter(f)} />{" "}
                  {FILTER_LABEL[f]}
                </label>
              ))}
            </fieldset>
            <div className="flex gap-1.5">
              <button type="button" className="btn btn-sm" onClick={() => setAll(true)}>
                Expand all
              </button>
              <button type="button" className="btn btn-sm" onClick={() => setAll(false)}>
                Collapse all
              </button>
            </div>
          </div>
          <p className="text-sm text-ink-3" role="status" aria-live="polite">
            {!filtering
              ? `${TOPICS.length} weeks across ${MONTHS.length} months.`
              : `${shown} of ${TOPICS.length} weeks match${query.trim() ? ` “${query.trim()}”` : ""}${filter !== "all" ? ` with status ${STATUS_LABEL[filter]}` : ""}.`}
          </p>
          <div className="grid gap-4.5">
            {MONTHS.map((m) => (
              <MonthSection key={m.id} m={m} query={query} filter={filter} filtering={filtering} />
            ))}
          </div>
          {!anyVisible ? (
            <div className="card grid justify-items-center gap-2.5 p-8 text-center text-ink-3">
              <p>No weeks match your search and filter.</p>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  clearFilters();
                  searchRef.current?.focus();
                }}
              >
                Clear search and filter
              </button>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
