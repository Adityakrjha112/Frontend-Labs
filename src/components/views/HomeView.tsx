"use client";

import Link from "next/link";
import { QUESTIONS } from "@/lib/bank";
import { getLoadStatus, useHydrated, useLabState } from "@/lib/store";
import { quickTen } from "@/lib/session";
import { useStartSession } from "@/lib/useStartSession";
import { PositionCard } from "../roadmap/Overview";
import { RelatedQuestions } from "../roadmap/TopicBody";
import { BoxModel } from "../roadmap/BoxModel";
import { useRoadmapState } from "@/roadmap/store";
import { currentTopic } from "@/roadmap/state";

export function HomeView() {
  const hydrated = useHydrated();
  const lab = useLabState();
  const roadmap = useRoadmapState();
  const start = useStartSession();
  const cur = hydrated ? currentTopic(roadmap) : null;

  return (
    <div className="rm flex flex-col gap-14">
      {hydrated && getLoadStatus() === "recovered" ? (
        <p role="status" className="rounded-md border border-bad bg-bad-soft p-4 text-sm">
          Saved practice progress in this browser could not be read and was reset. A backup copy of the unreadable data was kept.
        </p>
      ) : null}

      <section aria-labelledby="home-h" className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <div className="flex flex-col gap-6">
          <h1 id="home-h" className="max-w-[15ch] text-5xl sm:text-6xl">
            Learn front‑end from the platform out.
          </h1>
          <p className="max-w-[52ch] text-lg text-ink-2">
            A 26-week roadmap where every month builds on the one inside it, linked to {QUESTIONS.length} interview questions with hints and worked
            explanations.
          </p>
          <div className="flex flex-wrap gap-3">
            {hydrated && lab.activeSession ? (
              <Link href="/session" className="btn btn-primary">
                Resume {lab.activeSession.title}
              </Link>
            ) : cur ? (
              <Link href={`/roadmap/${cur.id}`} className="btn btn-primary">
                Continue week {cur.week}
              </Link>
            ) : (
              <Link href="/roadmap" className="btn btn-primary">
                Open the roadmap
              </Link>
            )}
            <button
              type="button"
              className="btn"
              onClick={() => start("Quick 10", "quick", quickTen(QUESTIONS, new Set(Object.keys(lab.progress))).map((q) => q.id))}
            >
              Practise 10 questions
            </button>
          </div>
        </div>
        <BoxModel />
      </section>

      <section aria-labelledby="home-now-h" className="grid gap-4">
        <h2 id="home-now-h" className="text-3xl">
          This week
        </h2>
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <PositionCard />
          {cur ? <RelatedQuestions topic={cur} compact /> : <div className="card p-5 text-ink-3">Loading your week.</div>}
        </div>
      </section>
    </div>
  );
}
