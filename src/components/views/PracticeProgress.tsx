"use client";

import Link from "next/link";
import { QUESTIONS } from "@/lib/bank";
import { DIFFICULTIES } from "@/lib/types";
import { TECHNOLOGY_META } from "@/lib/taxonomy";
import { actions, getLoadStatus, useHydrated, useLabState } from "@/lib/store";
import { computeStreak } from "@/lib/storage";
import { bucketize, overall, pct, ratio, type Bucket } from "@/lib/stats";
import { useStartSession } from "@/lib/useStartSession";
import { Meter, StatCard } from "../ui";

function BreakdownRow({ label, b }: { label: string; b: Bucket }) {
  const progress = ratio(b.attempted, b.total);
  const accuracy = ratio(b.gradedCorrect, b.gradedAttempted);
  const recall = ratio(b.selfGotIt, b.selfAttempted);
  return (
    <li className="grid grid-cols-2 gap-x-4 gap-y-2 p-4 sm:grid-cols-[minmax(9rem,1.4fr)_2fr_5.5rem_5.5rem] sm:items-center">
      <span className="col-span-2 font-semibold sm:col-span-1">{label}</span>
      <span className="col-span-2 flex items-center gap-3 sm:col-span-1">
        <Meter value={progress} label={`${label} progress`} />
        <span className="w-16 shrink-0 text-right text-sm text-ink-3 tabular-nums">
          {b.attempted}/{b.total}
        </span>
      </span>
      <span className="text-sm sm:text-right">
        <span className="text-ink-3 sm:sr-only">MCQ accuracy </span>
        <span className="font-semibold tabular-nums">{pct(accuracy)}</span>
      </span>
      <span className="text-right text-sm">
        <span className="text-ink-3 sm:sr-only">Self-rated </span>
        <span className="font-semibold tabular-nums">{pct(recall)}</span>
      </span>
    </li>
  );
}

function BreakdownHeader({ first }: { first: string }) {
  return (
    <div aria-hidden="true" className="hidden border-b border-line px-4 py-2 sm:grid sm:grid-cols-[minmax(9rem,1.4fr)_2fr_5.5rem_5.5rem]">
      <span className="eyebrow">{first}</span>
      <span className="eyebrow">Attempted</span>
      <span className="eyebrow text-right">MCQ correct</span>
      <span className="eyebrow text-right">Self-rated</span>
    </div>
  );
}

/** Practice statistics (formerly the dashboard body); shown on /progress. */
export function PracticeProgress() {
  const hydrated = useHydrated();
  const state = useLabState();
  const start = useStartSession();
  const all = overall(QUESTIONS, state.progress);
  const streak = computeStreak(state.activityDays, new Date());
  const byTech = bucketize(QUESTIONS, state.progress, (q) => q.technology, TECHNOLOGY_META.map((t) => t.label));
  const byDiff = bucketize(QUESTIONS, state.progress, (q) => q.difficulty, DIFFICULTIES);
  const recovered = hydrated && getLoadStatus() === "recovered";
  const fresh = hydrated && all.attempted === 0;

  return (
    <div className="flex flex-col gap-10">
      {recovered ? (
        <p role="status" className="rounded-lg border border-bad bg-bad-soft p-4 text-sm">
          Saved progress in this browser could not be read and was reset. A backup copy of the unreadable data was kept.
        </p>
      ) : null}


      <section aria-labelledby="overview-h" className="flex flex-col gap-4">
        <h2 id="overview-h" className="text-2xl font-bold">
          Practice
        </h2>
        {fresh ? <p className="text-ink-2">No answers yet. Your stats appear here after your first question.</p> : null}
        <dl className="grid gap-x-10 sm:grid-cols-2">
          <StatCard
            accent
            label="Progress"
            value={hydrated ? pct(ratio(all.attempted, all.total)) : "—"}
            detail={hydrated ? `${all.attempted} of ${all.total} questions attempted` : "Loading…"}
          />
          <StatCard
            label="Multiple-choice accuracy"
            value={hydrated ? pct(ratio(all.gradedCorrect, all.gradedAttempted)) : "—"}
            detail={hydrated ? `Latest answer correct on ${all.gradedCorrect} of ${all.gradedAttempted}` : "Loading…"}
          />
          <StatCard
            label="Self-rated got it"
            value={hydrated ? pct(ratio(all.selfGotIt, all.selfAttempted)) : "—"}
            detail="Self-reviewed questions, not auto-graded"
          />
          <StatCard
            label="Practice streak"
            value={
              hydrated ? (
                <>
                  {streak.current}
                  <span className="ml-1 font-sans text-base font-normal text-ink-3">{streak.current === 1 ? "day" : "days"}</span>
                </>
              ) : (
                "—"
              )
            }
            detail={hydrated ? (streak.activeToday ? `Practised today. Best: ${streak.longest}` : streak.current > 0 ? "Practise today to keep it going" : `Best ${streak.longest}`) : "Loading…"}
          />
        </dl>
      </section>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[2fr_1fr]">
        <section aria-labelledby="tech-h" className="flex flex-col gap-4">
          <h2 id="tech-h" className="text-2xl font-bold">
            By technology
          </h2>
          <div className="card overflow-hidden">
            <BreakdownHeader first="Technology" />
            <ul className="divide-y divide-line">
              {byTech.map((b) => (
                <BreakdownRow key={b.key} label={TECHNOLOGY_META.find((t) => t.label === b.key)?.short ?? b.key} b={b} />
              ))}
            </ul>
          </div>
        </section>

        <div className="flex flex-col gap-8">
          <section aria-labelledby="diff-h" className="flex flex-col gap-4">
            <h2 id="diff-h" className="text-2xl font-bold">
              By difficulty
            </h2>
            <ul className="flex flex-col gap-3">
              {byDiff.map((b) => (
                <li key={b.key} className="card flex flex-col gap-3 p-4">
                  <div className="flex items-baseline justify-between">
                    <span className="font-semibold">{b.key}</span>
                    <span className="text-sm text-ink-3 tabular-nums">
                      {b.attempted}/{b.total}
                    </span>
                  </div>
                  <Meter value={ratio(b.attempted, b.total)} label={`${b.key} progress`} tone="accent" />
                  <p className="flex justify-between text-sm text-ink-2">
                    <span>
                      MCQ <span className="font-semibold tabular-nums">{pct(ratio(b.gradedCorrect, b.gradedAttempted))}</span>
                    </span>
                    <span>
                      Self-rated <span className="font-semibold tabular-nums">{pct(ratio(b.selfGotIt, b.selfAttempted))}</span>
                    </span>
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="queues-h" className="card flex flex-col gap-4 p-5">
            <h2 id="queues-h" className="text-xl font-bold">
              Your lists
            </h2>
            <div className="flex items-center justify-between gap-3">
              <span>
                Review queue <span className="text-sm text-ink-3 tabular-nums">({state.reviewQueue.length})</span>
              </span>
              <button
                type="button"
                className="btn btn-sm"
                disabled={state.reviewQueue.length === 0}
                onClick={() => start("Review queue", "review", state.reviewQueue)}
              >
                Review
              </button>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>
                Bookmarks <span className="text-sm text-ink-3 tabular-nums">({state.bookmarks.length})</span>
              </span>
              <button
                type="button"
                className="btn btn-sm"
                disabled={state.bookmarks.length === 0}
                onClick={() => start("Bookmarked questions", "bookmarks", state.bookmarks)}
              >
                Practise
              </button>
            </div>
            {hydrated && state.lastSession ? (
              <Link href="/results" className="text-sm font-medium text-accent underline">
                See last session’s results
              </Link>
            ) : null}
            {hydrated && state.activeSession ? (
              <button type="button" className="self-start text-sm text-ink-3 underline" onClick={() => actions.abandonSession()}>
                Discard the session in progress
              </button>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
