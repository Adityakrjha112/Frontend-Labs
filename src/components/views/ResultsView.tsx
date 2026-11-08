"use client";

import Link from "next/link";
import { QUESTION_BY_ID } from "@/lib/bank";
import { useHydrated, useLabState } from "@/lib/store";
import { outcomeOf, summarizeSession } from "@/lib/session";
import { techMeta } from "@/lib/taxonomy";
import { pct } from "@/lib/stats";
import { useStartSession } from "@/lib/useStartSession";
import { EmptyState, StatCard } from "../ui";

const OUTCOME_TEXT = {
  correct: { label: "Correct", cls: "text-good", mark: "✓" },
  incorrect: { label: "Incorrect", cls: "text-bad", mark: "✗" },
  "got-it": { label: "Got it (self-reviewed)", cls: "text-good", mark: "✓" },
  missed: { label: "Missed (self-reviewed)", cls: "text-bad", mark: "✗" },
} as const;

export function ResultsView() {
  const hydrated = useHydrated();
  const { lastSession: session } = useLabState();
  const start = useStartSession();

  if (!hydrated) return <div aria-busy="true" className="card h-96 animate-pulse" />;
  if (!session) {
    return (
      <EmptyState title="No results yet">
        <p className="text-ink-2">Finish a practice session to see your results here.</p>
        <Link href="/practice" className="btn btn-primary">
          Start practising
        </Link>
      </EmptyState>
    );
  }

  const s = summarizeSession(session, QUESTION_BY_ID);

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-3">
        <p className="text-ink-3">Results for {session.title}</p>
        <h1 className="text-4xl font-bold sm:text-5xl">
          {s.graded.accuracy !== null ? (
            <>
              <span className="text-accent">{pct(s.graded.accuracy)}</span> on graded questions.
            </>
          ) : (
            "Session complete."
          )}
        </h1>
        <p className="max-w-[60ch] text-ink-2">
          Accuracy counts only multiple-choice questions, which the app grades objectively. Every other question was
          self-reviewed, so it is reported separately as completion.
        </p>
      </header>

      <dl className="grid gap-x-10 sm:grid-cols-2">
        <StatCard
          accent
          label="Multiple-choice accuracy"
          value={pct(s.graded.accuracy)}
          detail={s.graded.total > 0 ? `${s.graded.correct} of ${s.graded.answered} answered correctly` : "No MCQ in this session"}
        />
        <StatCard
          label="Self-review completion"
          value={pct(s.selfReviewed.completion)}
          detail={s.selfReviewed.total > 0 ? `${s.selfReviewed.reviewed} of ${s.selfReviewed.total} marked` : "No self-reviewed questions"}
        />
        <StatCard
          label="Self-rated got it"
          value={s.selfReviewed.reviewed > 0 ? `${s.selfReviewed.gotIt}/${s.selfReviewed.reviewed}` : "—"}
          detail="Your own judgement, not graded"
        />
        <StatCard label="Skipped" value={s.skipped} detail={`of ${s.total} questions`} />
      </dl>

      <section aria-labelledby="missed-h" className="card flex flex-col gap-5 p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="missed-h" className="text-2xl font-bold">
              Missed topics
            </h2>
            <p className="text-sm text-ink-3">Incorrect MCQ answers and questions you marked as missed.</p>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            disabled={s.missedIds.length === 0}
            onClick={() => start("Practice missed questions", "retry", s.missedIds)}
          >
            Practice these again ({s.missedIds.length})
          </button>
        </div>
        {s.missedTopics.length === 0 ? (
          <p className="text-ink-2">Nothing missed. Clean run.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {s.missedTopics.map((t) => (
              <li key={`${t.technology}-${t.topic}`} className="chip">
                <span className="text-xs text-ink-3">{techMeta(t.technology).short}</span>
                {t.topic}
                <span className="text-xs font-semibold text-bad tabular-nums">{t.count} missed</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="breakdown-h" className="flex flex-col gap-4">
        <h2 id="breakdown-h" className="text-2xl font-bold">
          Question by question
        </h2>
        <ol className="flex flex-col divide-y divide-line rounded-lg border border-line bg-card">
          {session.questionIds.map((id, i) => {
            const q = QUESTION_BY_ID.get(id);
            if (!q) return null;
            const a = session.answers[id];
            const o = outcomeOf(a);
            const meta = o ? OUTCOME_TEXT[o] : null;
            return (
              <li key={id} className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:gap-4">
                <span className="text-sm text-ink-3 tabular-nums sm:w-28">
                  {i + 1}. <span className="font-mono text-ink-2">{q.id}</span>
                </span>
                <span className="line-clamp-2 flex-1">{q.question}</span>
                <span className={`text-sm font-semibold sm:w-48 sm:text-right ${meta?.cls ?? "text-ink-3"}`}>
                  {meta ? (
                    <>
                      <span aria-hidden="true">{meta.mark} </span>
                      {meta.label}
                    </>
                  ) : a?.kind === "skipped" ? (
                    "Skipped"
                  ) : a?.kind === "self" ? (
                    "Revealed, not marked"
                  ) : (
                    "Not answered"
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link href="/practice" className="btn">
          New session
        </Link>
        <Link href="/progress" className="btn btn-ghost">
          See your progress
        </Link>
      </div>
    </div>
  );
}
