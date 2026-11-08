"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent } from "react";
import { QUESTION_BY_ID } from "@/lib/bank";
import { actions, useHydrated, useLabState } from "@/lib/store";
import { outcomeOf, type SessionAnswer } from "@/lib/session";
import { QuestionRunner } from "../QuestionRunner";
import { EmptyState, Switch } from "../ui";

function segmentTone(answer: SessionAnswer | undefined): { cls: string; label: string } {
  const o = outcomeOf(answer);
  if (answer?.kind === "skipped") return { cls: "bg-paper-2 border-dashed border-ink-3", label: "skipped" };
  if (o === "correct" || o === "got-it") return { cls: "bg-good border-good", label: o === "correct" ? "correct" : "got it" };
  if (o === "incorrect" || o === "missed") return { cls: "bg-bad border-bad", label: o === "incorrect" ? "incorrect" : "missed" };
  if (answer?.kind === "self") return { cls: "bg-ink-3 border-ink-3", label: "revealed, not yet marked" };
  return { cls: "bg-card border-line", label: "not answered" };
}

function isTypingTarget(el: EventTarget | null): boolean {
  return el instanceof HTMLElement && (el.isContentEditable || ["TEXTAREA", "SELECT"].includes(el.tagName) || (el.tagName === "INPUT" && !["radio", "checkbox"].includes((el as HTMLInputElement).type)));
}

export function SessionView() {
  const hydrated = useHydrated();
  const { activeSession: session, bookmarks, reviewQueue } = useLabState();
  const router = useRouter();

  const index = session?.currentIndex ?? 0;
  const total = session?.questionIds.length ?? 0;
  const qid = session?.questionIds[index];
  const question = qid ? QUESTION_BY_ID.get(qid) : undefined;
  const answer = qid ? session?.answers[qid] : undefined;
  const answered = answer !== undefined && answer.kind !== "skipped";
  const isLast = index === total - 1;

  const finish = () => {
    actions.finishSession();
    router.push("/results");
  };
  const next = () => (isLast ? finish() : actions.goTo(index + 1));

  const onNavKey = useEffectEvent((e: KeyboardEvent) => {
    if (!session || e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
    if ((e.key === "ArrowRight" || e.key.toLowerCase() === "n") && answered) {
      e.preventDefault();
      next();
    } else if ((e.key === "ArrowLeft" || e.key.toLowerCase() === "p") && index > 0) {
      e.preventDefault();
      actions.goTo(index - 1);
    } else if (e.key.toLowerCase() === "b" && qid) {
      e.preventDefault();
      actions.toggleBookmark(qid);
    }
  });
  useEffect(() => {
    const l = (e: KeyboardEvent) => onNavKey(e);
    window.addEventListener("keydown", l);
    return () => window.removeEventListener("keydown", l);
  }, []);

  if (!hydrated) {
    return <div aria-busy="true" className="card h-96 animate-pulse" />;
  }
  if (!session || !question || !qid) {
    return (
      <EmptyState title="No session in progress">
        <p className="text-ink-2">Start a Quick 10 or build a custom session to begin practising.</p>
        <div className="flex flex-wrap gap-3">
          <Link href="/practice" className="btn btn-primary">
            Start practising
          </Link>
          <Link href="/results" className="btn">
            Last results
          </Link>
        </div>
      </EmptyState>
    );
  }

  const answeredCount = session.questionIds.filter((id) => {
    const a = session.answers[id];
    return a && a.kind !== "skipped";
  }).length;
  const bookmarked = bookmarks.includes(qid);
  const queued = reviewQueue.includes(qid);

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_16rem]">
      <div className="min-w-0">
        {/* Phones: where you are in the session, before the question (the full panel is below). */}
        <div className="mb-6 flex items-center gap-3 rounded-md border border-line bg-card px-3 py-2 lg:hidden">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{session.title}</p>
            <p className="text-xs text-ink-3 tabular-nums">
              {answeredCount} of {total} answered
            </p>
            <div
              role="meter"
              aria-label="Session progress"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={answeredCount}
              aria-valuetext={`${answeredCount} of ${total} answered`}
              className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-paper-2"
            >
              <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${(answeredCount / total) * 100}%` }} />
            </div>
          </div>
          <button
            type="button"
            aria-pressed={bookmarked}
            aria-label={bookmarked ? "Bookmarked" : "Bookmark this question"}
            className="btn btn-ghost btn-sm min-w-11 px-2 text-lg"
            onClick={() => actions.toggleBookmark(qid)}
          >
            <span aria-hidden="true">{bookmarked ? "★" : "☆"}</span>
          </button>
        </div>
        <QuestionRunner
          key={qid}
          question={question}
          answer={answer}
          timerEnabled={session.timerEnabled}
          positionLabel={`Question ${index + 1} of ${total}`}
          onAnswer={(a) => actions.answer(qid, a)}
          onVerdict={(v) => actions.setVerdict(qid, v)}
        />

        <nav aria-label="Question navigation" className="mt-10 flex flex-wrap items-center gap-3 border-t border-line pt-6">
          <button type="button" className="btn" onClick={() => actions.goTo(index - 1)} disabled={index === 0}>
            Previous
          </button>
          {!answered ? (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                actions.answer(qid, { kind: "skipped" });
                next();
              }}
            >
              Skip
            </button>
          ) : null}
          <button type="button" className="btn btn-primary ml-auto" onClick={next} disabled={!answered}>
            {isLast ? "Finish session" : "Next question"}
          </button>
        </nav>
      </div>

      <aside aria-label="Session" className="flex flex-col gap-6 lg:sticky lg:top-24 lg:self-start">
        <div className="card flex flex-col gap-4 p-5">
          <div>
            <h2 className="mt-1 text-lg font-bold">{session.title}</h2>
            <p className="text-sm text-ink-3">
              {answeredCount} of {total} answered
            </p>
          </div>
          <ol className="flex flex-wrap gap-1.5" aria-label="Jump to question">
            {session.questionIds.map((id, i) => {
              const tone = segmentTone(session.answers[id]);
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => actions.goTo(i)}
                    aria-current={i === index ? "step" : undefined}
                    aria-label={`Question ${i + 1}, ${tone.label}`}
                    className={`grid size-7 place-items-center rounded border text-xs font-semibold tabular-nums ${tone.cls} ${
                      i === index ? "ring-2 ring-accent ring-offset-2 ring-offset-card" : ""
                    } ${tone.cls.includes("bg-good") || tone.cls.includes("bg-bad") || tone.cls.includes("bg-ink-3") ? "text-paper" : ""}`}
                  >
                    {i + 1}
                  </button>
                </li>
              );
            })}
          </ol>
          <div className="flex flex-col gap-2">
            <button type="button" aria-pressed={bookmarked} className="btn btn-sm justify-start" onClick={() => actions.toggleBookmark(qid)}>
              <span aria-hidden="true">{bookmarked ? "★" : "☆"}</span> {bookmarked ? "Bookmarked" : "Bookmark"}
            </button>
            <button type="button" aria-pressed={queued} className="btn btn-sm justify-start" onClick={() => actions.toggleReview(qid)}>
              <span aria-hidden="true">{queued ? "●" : "○"}</span> {queued ? "In review queue" : "Add to review queue"}
            </button>
            <Switch label="Timer" checked={session.timerEnabled} onChange={(on) => actions.setSessionTimer(on)} />
          </div>
          <button type="button" className="btn btn-sm" onClick={finish}>
            End session &amp; see results
          </button>
        </div>
        <details className="card p-5 text-sm">
          <summary className="font-semibold">Keyboard shortcuts</summary>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-ink-2">
            <dt><kbd className="tag font-mono">A–D</kbd></dt><dd>Choose an option</dd>
            <dt><kbd className="tag font-mono">H</kbd></dt><dd>Show next hint</dd>
            <dt><kbd className="tag font-mono">→ or N</kbd></dt><dd>Next question</dd>
            <dt><kbd className="tag font-mono">← or P</kbd></dt><dd>Previous question</dd>
            <dt><kbd className="tag font-mono">B</kbd></dt><dd>Toggle bookmark</dd>
            <dt><kbd className="tag font-mono">⌘↵</kbd></dt><dd>Reveal from the answer box</dd>
          </dl>
        </details>
      </aside>
    </div>
  );
}
