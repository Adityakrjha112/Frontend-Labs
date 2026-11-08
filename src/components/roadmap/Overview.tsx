"use client";

import Link from "next/link";
import { Md } from "@/roadmap/Md";
import { ALL_ITEMS, MONTHS, TOPICS, isStudyTopic, monthOf } from "@/roadmap/model";
import {
  currentStreak,
  currentTopic,
  doneCount,
  isDone,
  longestStreak,
  pct,
  statusOf,
} from "@/roadmap/state";
import { roadmapActions, useRoadmapState, useToday } from "@/roadmap/store";
import { Bar, StatusPill } from "./bits";
import { TutorPrompt } from "./TutorPrompt";

/** "You are here" card (original refreshOverview position card). */
export function PositionCard({ compact = false }: { compact?: boolean }) {
  const state = useRoadmapState();
  const cur = currentTopic(state);
  if (!cur) {
    return (
      <div className="card rm-position p-5">
        <span className="rm-eyebrow">Roadmap complete</span>
        <h3 className="text-xl font-bold">All 26 weeks are completed</h3>
        <p className="rm-muted">Finish the final review checklist and the capstone acceptance criteria in Month 6.</p>
        <div>
          <Link href="/roadmap#month-m6" className="btn btn-primary">
            Open Month 6
          </Link>
        </div>
      </div>
    );
  }
  const st = statusOf(state, cur.id);
  const next = cur.items.find((it) => !isDone(state, it.id));
  const c = cur.content;
  return (
    <div className="card rm-position p-5">
      <span className="rm-eyebrow">
        You are here: week {cur.week} of 26, in month {monthOf(cur).n}
      </span>
      <div className="flex flex-wrap items-center gap-2.5">
        <h3 className="text-xl font-bold">{cur.title}</h3>
        <StatusPill status={st} />
      </div>
      {!compact ? (
        <p className="rm-muted">
          <Md>{isStudyTopic(c) ? c.purpose : c.plan}</Md>
        </p>
      ) : null}
      <div className="rm-next">
        {next ? (
          <>
            <strong>Next task:</strong> <Md>{next.label}</Md>
          </>
        ) : (
          <>
            <strong>All {cur.items.length} tasks done.</strong> Mark the week completed to move on.
          </>
        )}
      </div>
      <Bar value={pct(doneCount(state, cur.items), cur.items.length)} label={`Week ${cur.week} tasks done`} />
      {!compact ? <TutorPrompt topic={cur} compact /> : null}
      <div className="flex flex-wrap gap-2">
        <Link href={`/roadmap/${cur.id}`} className="btn btn-primary">
          Open week {cur.week}
        </Link>
        {st === "not-started" ? (
          <button type="button" className="btn" onClick={() => roadmapActions.startWeek(cur.id)}>
            Start this week
          </button>
        ) : (
          <button type="button" className="btn" onClick={() => roadmapActions.completeWeek(cur.id)}>
            Mark week completed
          </button>
        )}
      </div>
    </div>
  );
}

/** The four overview stats from the original. */
export function RoadmapStats({ four = false }: { four?: boolean }) {
  const state = useRoadmapState();
  const today = useToday();
  const doneItems = doneCount(state, ALL_ITEMS);
  const total = ALL_ITEMS.length;
  const weeksDone = TOPICS.filter((t) => statusOf(state, t.id) === "completed").length;
  const inProg = TOPICS.filter((t) => statusOf(state, t.id) === "in-progress").length;
  const p = pct(doneItems, total);
  return (
    <div className={`rm-stats ${four ? "four" : ""}`}>
      <div className="rm-stat">
        <span className="label">Overall progress</span>
        <span className="value">{p}%</span>
        <Bar value={p} />
        <span className="sub">
          {doneItems} of {total} checklist items
        </span>
      </div>
      <div className="rm-stat">
        <span className="label">Weeks completed</span>
        <span className="value">
          {weeksDone}
          <span className="rm-muted text-base">/26</span>
        </span>
        <span className="sub">{inProg} in progress</span>
      </div>
      <div className="rm-stat">
        <span className="label">Tasks completed</span>
        <span className="value">{doneItems}</span>
        <span className="sub">{total - doneItems} remaining</span>
      </div>
      <div className="rm-stat">
        <span className="label">Study streak</span>
        <span className="value">
          {currentStreak(state, today)}
          <span className="rm-muted text-base"> d</span>
        </span>
        <span className="sub">Longest: {longestStreak(state)} d</span>
      </div>
    </div>
  );
}

/** Month progress cards; clicking opens and scrolls to the month. */
export function MonthProgress({ onOpen }: { onOpen?: (monthId: string) => void }) {
  const state = useRoadmapState();
  const cur = currentTopic(state);
  return (
    <div className="rm-month-progress">
      {MONTHS.map((m) => {
        const iDone = doneCount(state, m.items);
        const mp = pct(iDone, m.items.length);
        const wDone = m.topics.filter((t) => statusOf(state, t.id) === "completed").length;
        const inner = (
          <>
            <span className="rm-row">
              <strong>Month {m.n}</strong>
              <span className="rm-mono">
                {mp}%<span className="sr-only"> done</span>
              </span>
            </span>
            <Bar value={mp} />
            <span className="rm-meta">
              {m.theme}: {wDone} of {m.topics.length} weeks, {iDone} of {m.items.length} tasks
            </span>
          </>
        );
        const cls = `rm-mp ${cur && cur.monthId === m.id ? "is-current" : ""}`;
        return onOpen ? (
          <button key={m.id} type="button" className={cls} onClick={() => onOpen(m.id)}>
            {inner}
          </button>
        ) : (
          <Link key={m.id} href={`/roadmap#month-${m.id}`} className={cls}>
            {inner}
          </Link>
        );
      })}
    </div>
  );
}
