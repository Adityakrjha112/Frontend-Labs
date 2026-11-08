"use client";

import { useId, useRef, useState } from "react";
import { Md } from "@/roadmap/Md";
import { ITEM_BY_ID, MONTHS, TOPIC_BY_ID } from "@/roadmap/model";
import {
  addDays,
  currentStreak,
  currentTopic,
  DAILY_GOAL_MIN,
  dayOf,
  describeDay,
  heatRange,
  HEAT_WEEKS,
  isDone,
  isStudyDay,
  KINDS,
  levelFor,
  longestStreak,
  minutesError,
  minutesOn,
  parseKey,
  pct,
  studyDayCount,
  todayGoals,
  type Kind,
} from "@/roadmap/state";
import { roadmapActions, useRoadmapState, useToday } from "@/roadmap/store";
import { Bar, CheckRow } from "./bits";

const fmtDate = (k: string, opts?: Intl.DateTimeFormatOptions) =>
  parseKey(k).toLocaleDateString(undefined, opts ?? { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const fmtTime = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
};

/** Today: daily goals, study log form and today's entries (original "Today" section). */
export function TodayPanel() {
  const state = useRoadmapState();
  const today = useToday();
  const ids = useId();
  const mins = minutesOn(state, today);
  const day = dayOf(state, today);
  const goals = todayGoals(state, today);
  const study = isStudyDay(state, today);
  const actions = day ? day.logs.length + day.tasks.length : 0;

  const [minutes, setMinutes] = useState("30");
  const [kind, setKind] = useState<Kind>("Learn");
  const [topic, setTopic] = useState<string | null>(null); // null = follow the current week
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const minRef = useRef<HTMLInputElement>(null);
  const topicValue = topic ?? currentTopic(state)?.id ?? "";

  return (
    <div className="rm-today-grid grid gap-4 lg:grid-cols-2">
      <div className="card grid content-start gap-3 p-5">
        <h3 className="text-lg font-bold">Daily goals</h3>
        <div className="grid gap-1.5 px-2 py-2.5">
          <div className="rm-row text-[0.92rem]">
            <span>
              Study about {DAILY_GOAL_MIN} minutes <span className="rm-muted">(10 h/week)</span>
            </span>
            <span className="rm-mono">
              {mins}/{DAILY_GOAL_MIN} min
            </span>
          </div>
          <Bar value={Math.min(100, pct(mins, DAILY_GOAL_MIN))} good={mins >= DAILY_GOAL_MIN} label="Minutes studied today" />
        </div>
        <ul className="rm-check-list">
          {goals.length === 0 ? <li className="rm-muted">No open tasks left. Review the final checklist in Month 6.</li> : null}
          {goals.map((it) => (
            <CheckRow key={it.id} item={it} idPrefix="goal-" withContext />
          ))}
        </ul>
      </div>

      <div className="card grid content-start gap-3 p-5">
        <h3 className="text-lg font-bold">Log study activity</h3>
        <div className={`rm-day-status ${study ? "counted" : ""}`} role="status">
          <span className="rm-dot" aria-hidden="true" />
          <span>
            {study
              ? `Today counts as a study day (${actions} ${actions === 1 ? "action" : "actions"}, counted once).`
              : "Not a study day yet. Opening the site doesn't count; log activity or tick off a task."}
          </span>
        </div>
        <form
          className="grid gap-2.5"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            const err = minutesError(minutes);
            if (err) {
              setError(err);
              minRef.current?.focus();
              return;
            }
            setError("");
            roadmapActions.addLog({ minutes: Number(minutes), kind, topic: topicValue, note: note.trim().slice(0, 200) });
            setNote("");
          }}
        >
          <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-2.5 max-[420px]:grid-cols-1">
            <div className="grid gap-1">
              <label htmlFor={`${ids}-min`} className="text-sm font-medium">
                Minutes
              </label>
              <input
                ref={minRef}
                id={`${ids}-min`}
                type="number"
                min={1}
                max={600}
                step={1}
                inputMode="numeric"
                required
                className="field"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                aria-invalid={error ? true : undefined}
                aria-describedby={`${ids}-err`}
              />
            </div>
            <div className="grid gap-1">
              <label htmlFor={`${ids}-kind`} className="text-sm font-medium">
                Activity
              </label>
              <select id={`${ids}-kind`} className="field" value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
                {KINDS.map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-1">
            <label htmlFor={`${ids}-topic`} className="text-sm font-medium">
              Week
            </label>
            <select id={`${ids}-topic`} className="field" value={topicValue} onChange={(e) => setTopic(e.target.value)}>
              <option value="">General (no specific week)</option>
              {MONTHS.map((m) => (
                <optgroup key={m.id} label={`Month ${m.n}: ${m.theme}`}>
                  {m.topics.map((t) => (
                    <option key={t.id} value={t.id}>
                      Week {t.week}: {t.title}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="grid gap-1">
            <label htmlFor={`${ids}-note`} className="text-sm font-medium">
              What did you do? <span className="rm-muted">(optional)</span>
            </label>
            <input
              id={`${ids}-note`}
              type="text"
              maxLength={200}
              autoComplete="off"
              className="field"
              placeholder="e.g. Read the APG combobox pattern"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <p id={`${ids}-err`} className="text-sm text-bad" aria-live="polite">
            {error}
          </p>
          <div>
            <button className="btn btn-primary" type="submit">
              Log study activity
            </button>
          </div>
        </form>
        <div>
          <h4 className="rm-h4 mb-1.5">Logged today</h4>
          <ul className="rm-log-list">
            {!day?.logs.length ? (
              <li className="rm-muted" style={{ border: 0, padding: 0 }}>
                Nothing logged yet today.
              </li>
            ) : null}
            {(day?.logs ?? [])
              .slice()
              .reverse()
              .map((l) => {
                const t = TOPIC_BY_ID.get(l.topic);
                return (
                  <li key={l.id}>
                    <span className="min-w-0 [overflow-wrap:anywhere]">
                      <strong className="rm-mono">{l.minutes} min</strong> {l.kind}
                      {t ? `, week ${t.week}` : ""}
                      {l.note ? `: ${l.note}` : ""} <span className="rm-muted">at {fmtTime(l.at)}</span>
                    </span>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      aria-label={`Remove ${l.minutes} minute ${l.kind} entry`}
                      onClick={() => roadmapActions.removeLog(today, l.id)}
                    >
                      Remove
                    </button>
                  </li>
                );
              })}
          </ul>
        </div>
      </div>
    </div>
  );
}

/** Streak stats, keyboard-navigable heatmap and day detail (original "Activity" section). */
export function ActivityPanel() {
  const state = useRoadmapState();
  const today = useToday();
  const { start } = heatRange(today);
  const [selected, setSelected] = useState<string | null>(null);
  const sel = selected && selected >= start && selected <= today ? selected : today;
  const gridRef = useRef<HTMLDivElement>(null);

  const cs = currentStreak(state, today);
  const ls = longestStreak(state);
  const visitDays = Object.keys(state.visits).length;
  const visitTotal = Object.values(state.visits).reduce((a, b) => a + b, 0);

  const select = (k: string, focus: boolean) => {
    if (k < start || k > today) return;
    setSelected(k);
    if (focus) requestAnimationFrame(() => gridRef.current?.querySelector<HTMLElement>(`[data-day="${k}"]`)?.focus());
  };

  const onKey = (e: React.KeyboardEvent) => {
    const cell = (e.target as HTMLElement).closest<HTMLElement>("[data-day]");
    if (!cell?.dataset.day) return;
    const map: Record<string, number> = { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -7, ArrowRight: 7 };
    let k: string | null = null;
    if (map[e.key] !== undefined) k = addDays(cell.dataset.day, map[e.key]!);
    else if (e.key === "Home") k = start;
    else if (e.key === "End") k = today;
    else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      select(cell.dataset.day, true);
      return;
    }
    if (k === null) return;
    e.preventDefault();
    if (k < start) k = start;
    if (k > today) k = today;
    select(k, true);
  };

  const monthLabels: { col: number; label: string }[] = [];
  let lastMonth = -1;
  for (let c = 0; c < HEAT_WEEKS; c++) {
    const d = parseKey(addDays(start, c * 7));
    if (d.getMonth() !== lastMonth) {
      if (c < HEAT_WEEKS - 1 || lastMonth === -1) monthLabels.push({ col: c + 1, label: d.toLocaleDateString(undefined, { month: "short" }) });
      lastMonth = d.getMonth();
    }
  }

  const d = dayOf(state, sel);
  const v = state.visits[sel] ?? 0;
  const study = isStudyDay(state, sel);

  return (
    <div className="grid gap-4">
      <div className="rm-stats four">
        <div className="rm-stat">
          <span className="label">Current streak</span>
          <span className="value">{cs}</span>
          <span className="sub">
            {cs === 1 ? "day" : "days"}
            {cs && !isStudyDay(state, today) ? ". Log today to keep it" : ""}
          </span>
        </div>
        <div className="rm-stat">
          <span className="label">Longest streak</span>
          <span className="value">{ls}</span>
          <span className="sub">{ls === 1 ? "day" : "days"}</span>
        </div>
        <div className="rm-stat">
          <span className="label">Study days</span>
          <span className="value">{studyDayCount(state)}</span>
          <span className="sub">logged activity or ticked a task</span>
        </div>
        <div className="rm-stat">
          <span className="label">Days visited</span>
          <span className="value">{visitDays}</span>
          <span className="sub">
            {visitTotal} {visitTotal === 1 ? "visit" : "visits"}, not counted as study
          </span>
        </div>
      </div>

      <div className="rm-activity-wrap grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
        <div className="card p-5">
          <div className="rm-heat-scroll">
            <div className="rm-heat">
              <div className="rm-heat-months" aria-hidden="true">
                {monthLabels.map((m) => (
                  <span key={m.col} style={{ gridColumn: String(m.col) }}>
                    {m.label}
                  </span>
                ))}
              </div>
              <div className="rm-heat-body">
                <div className="rm-heat-days" aria-hidden="true">
                  {["Mon", "", "Wed", "", "Fri", "", "Sun"].map((x, i) => (
                    <span key={i}>{x}</span>
                  ))}
                </div>
                <div
                  ref={gridRef}
                  className="rm-heat-grid"
                  role="grid"
                  aria-label={`Study activity, last ${HEAT_WEEKS} weeks. Arrow keys move by day and week.`}
                  onKeyDown={onKey}
                >
                  {Array.from({ length: 7 }, (_, r) => (
                    <div role="row" key={r}>
                      {Array.from({ length: HEAT_WEEKS }, (_, c) => {
                        const k = addDays(start, c * 7 + r);
                        const pos = { gridRow: String(r + 1), gridColumn: String(c + 1) };
                        if (k > today) {
                          return (
                            <div key={k} role="gridcell" className="rm-cell future" style={pos} aria-disabled="true" aria-label={`${fmtDate(k)}: future`} />
                          );
                        }
                        const isSel = k === sel;
                        const cls = [
                          "rm-cell",
                          !isStudyDay(state, k) && state.visits[k] ? "visited" : "",
                          k === today ? "today" : "",
                          isSel ? "selected" : "",
                        ].join(" ");
                        return (
                          <div
                            key={k}
                            role="gridcell"
                            data-day={k}
                            data-level={levelFor(state, k)}
                            className={cls}
                            style={pos}
                            tabIndex={isSel ? 0 : -1}
                            aria-selected={isSel || undefined}
                            aria-label={`${fmtDate(k)}${k === today ? " (today)" : ""}: ${describeDay(state, k)}`}
                            onClick={() => select(k, true)}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="rm-legend" aria-hidden="true">
            <span>Less</span>
            <span className="sw">
              {[0, 1, 2, 3, 4].map((l) => (
                <span key={l} className="rm-cell" data-level={l} />
              ))}
            </span>
            <span>More study minutes</span>
            <span className="sw">
              <span className="rm-cell visited" /> Visited, no study
            </span>
          </div>
          <p className="rm-muted mt-1.5 text-[0.8rem]">Use the arrow keys inside the calendar to move between days.</p>
        </div>

        <div className="card grid gap-2 p-5 text-[0.9rem]" aria-live="polite">
          <h3 className="text-base font-bold">{fmtDate(sel)}</h3>
          <p>
            <span className={`rm-pill ${study ? "completed" : "not-started"}`}>
              <span className="rm-dot" aria-hidden="true" />
              {study ? "Study day" : "Not a study day"}
            </span>
          </p>
          <p className="rm-muted">
            {v} {v === 1 ? "visit" : "visits"}
            {study ? "" : v ? " (visits alone never count as study)" : ""}
          </p>
          {d?.logs.length ? (
            <div>
              <h4 className="rm-h4">Logged: {minutesOn(state, sel)} min</h4>
              <ul className="rm-list">
                {d.logs.map((l) => {
                  const t = TOPIC_BY_ID.get(l.topic);
                  return (
                    <li key={l.id}>
                      {l.minutes} min {l.kind}
                      {t ? `, week ${t.week}` : ""}
                      {l.note ? `: ${l.note}` : ""}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
          {d?.tasks.length ? (
            <div>
              <h4 className="rm-h4">Tasks completed</h4>
              <ul className="rm-list">
                {d.tasks.map((id) => {
                  const it = ITEM_BY_ID.get(id)!;
                  const t = it.topicId ? TOPIC_BY_ID.get(it.topicId) : null;
                  return (
                    <li key={id}>
                      <Md>{it.label}</Md>
                      {t ? <span className="rm-muted"> (W{t.week})</span> : null}
                      {!isDone(state, id) ? <span className="rm-muted"> (since unticked)</span> : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
          {!study && sel === today ? <p>Log study activity or tick off a task to make today count.</p> : null}
        </div>
      </div>
    </div>
  );
}
