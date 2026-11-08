"use client";

import { PracticeProgress } from "./PracticeProgress";
import { ActivityPanel, TodayPanel } from "../roadmap/Activity";
import { DataPanel } from "../roadmap/DataPanel";
import { MonthProgress, RoadmapStats } from "../roadmap/Overview";
import { StorageBanner } from "../roadmap/bits";
import { useHydrated } from "@/lib/store";
import { useToday } from "@/roadmap/store";
import { parseKey } from "@/roadmap/state";

const SECTIONS = [
  { id: "practice", label: "Practice" },
  { id: "roadmap", label: "Roadmap" },
  { id: "today", label: "Today" },
  { id: "activity", label: "Activity" },
  { id: "data", label: "Data" },
] as const;

export function ProgressView() {
  const hydrated = useHydrated();
  const today = useToday();

  return (
    <div className="rm flex flex-col gap-12">
      <header className="flex flex-col gap-3">
        <h1 className="text-4xl sm:text-5xl">Your progress</h1>
        <nav aria-label="Progress sections">
          <ul className="flex flex-wrap gap-2">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="chip no-underline" style={{ color: "var(--ink)" }}>
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <StorageBanner />

      <section id="practice" className="scroll-mt-24">
        <PracticeProgress />
      </section>

      <section id="roadmap" aria-labelledby="pg-roadmap-h" className="grid scroll-mt-24 gap-4">
        <h2 id="pg-roadmap-h" className="text-2xl font-bold">
          Roadmap
        </h2>
        <RoadmapStats four />
        <MonthProgress />
      </section>

      <section id="today" aria-labelledby="pg-today-h" className="grid scroll-mt-24 gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="pg-today-h" className="text-2xl font-bold">
            Today
          </h2>
          <p className="text-sm text-ink-3">{hydrated ? parseKey(today).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : " "}</p>
        </div>
        <TodayPanel />
      </section>

      <section id="activity" aria-labelledby="pg-activity-h" className="grid scroll-mt-24 gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="pg-activity-h" className="text-2xl font-bold">
            Study activity
          </h2>
          <p className="text-sm text-ink-3">
            A study day counts when you log activity or tick off a roadmap task. Opening the site is tracked separately as a visit. Answering practice
            questions has its own streak above.
          </p>
        </div>
        {hydrated ? <ActivityPanel /> : <div aria-busy="true" className="card h-64 animate-pulse" />}
      </section>

      <section id="data" aria-labelledby="pg-data-h" className="card grid min-w-0 scroll-mt-24 gap-4 p-4 sm:p-6">
        <h2 id="pg-data-h" className="text-2xl font-bold">
          Roadmap data
        </h2>
        <DataPanel />
      </section>
    </div>
  );
}
