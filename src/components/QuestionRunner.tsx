"use client";

import { useEffect, useEffectEvent, useId, useRef, useState } from "react";
import {
  answerIsCode,
  draftIsCode,
  isAutoGraded,
  MCQ_OPTION_IDS,
  requiresExpectedOutput,
  type McqOptionId,
  type Question,
} from "@/lib/types";
import { gradeMcq, targetSeconds, type SelfVerdict, type SessionAnswer } from "@/lib/session";
import { TYPE_BLURB } from "@/lib/taxonomy";
import { detectLanguage } from "@/importer/language";
import { CodeBlock, OutputBlock } from "./CodeBlock";
import { ExternalLink, PlainText, QuestionMeta } from "./ui";
import { RoadmapLinks } from "./roadmap/RoadmapLinks";

interface Props {
  question: Question;
  answer: SessionAnswer | undefined;
  timerEnabled: boolean;
  onAnswer: (answer: SessionAnswer) => void;
  onVerdict: (verdict: SelfVerdict) => void;
  /** Index label, e.g. "Question 3 of 10". */
  positionLabel: string;
}

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable || el.tagName === "TEXTAREA" || el.tagName === "SELECT") return true;
  return el.tagName === "INPUT" && !["radio", "checkbox", "button", "submit"].includes((el as HTMLInputElement).type);
}

function formatClock(s: number): string {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function Timer({ seconds, target }: { seconds: number; target: number }) {
  const over = seconds > target;
  return (
    <div className="flex items-center gap-2 text-sm tabular-nums" role="timer" aria-label="Time on this question">
      <span aria-hidden="true" className={`size-2 rounded-full ${over ? "bg-accent" : "bg-good"} motion-safe:animate-pulse`} />
      <span className={`tabular-nums ${over ? "text-accent" : ""}`}>{formatClock(seconds)}</span>
      <span className="text-ink-3">/ {formatClock(target)} target</span>
    </div>
  );
}

export function QuestionRunner({ question: q, answer, timerEnabled, onAnswer, onVerdict, positionLabel }: Props) {
  const answered = answer !== undefined && answer.kind !== "skipped";
  const [hints, setHints] = useState(answer && answer.kind !== "skipped" ? answer.hintsUsed : 0);
  const [selected, setSelected] = useState<McqOptionId | null>(answer?.kind === "mcq" ? answer.selected : null);
  const [draft, setDraft] = useState(answer?.kind === "self" ? answer.draft : "");
  const [seconds, setSeconds] = useState(answer && answer.kind !== "skipped" ? answer.seconds : 0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const feedbackRef = useRef<HTMLHeadingElement>(null);
  const justAnswered = useRef(false);
  const ids = useId();
  const graded = isAutoGraded(q.type);
  const target = targetSeconds(q.difficulty);

  // Move focus to the new question for screen reader and keyboard users.
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [q.id]);

  useEffect(() => {
    if (answered && justAnswered.current) {
      justAnswered.current = false;
      feedbackRef.current?.focus();
    }
  }, [answered]);

  // Optional timer: counts while unanswered and the tab is visible.
  useEffect(() => {
    if (!timerEnabled || answered) return;
    const t = window.setInterval(() => {
      if (document.visibilityState === "visible") setSeconds((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(t);
  }, [timerEnabled, answered]);

  const submitMcq = () => {
    if (!selected || answered) return;
    justAnswered.current = true;
    onAnswer({ kind: "mcq", selected, correct: gradeMcq(q, selected), hintsUsed: hints, seconds });
  };
  const reveal = (verdict: SelfVerdict | null) => {
    if (answered) return;
    justAnswered.current = true;
    onAnswer({ kind: "self", draft, verdict, hintsUsed: hints, seconds });
  };

  // Single-key shortcuts while not typing.
  const onShortcut = useEffectEvent((e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target) || answered) return;
    const key = e.key.toUpperCase();
    if (key === "H") {
      setHints((n) => Math.min(2, n + 1));
      e.preventDefault();
      return;
    }
    if (graded) {
      const idx = ["1", "2", "3", "4"].indexOf(key);
      const letter = idx >= 0 ? MCQ_OPTION_IDS[idx] : MCQ_OPTION_IDS.find((l) => l === key);
      if (letter) {
        setSelected(letter);
        e.preventDefault();
      }
    }
  });
  useEffect(() => {
    const listener = (e: KeyboardEvent) => onShortcut(e);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  return (
    <article aria-labelledby={`${ids}-q`} className="flex flex-col gap-6">
      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <QuestionMeta q={q} />
          {timerEnabled ? <Timer seconds={seconds} target={target} /> : null}
        </div>
        <p className="text-sm text-ink-3">
          <span className="font-semibold text-ink-2">{positionLabel}.</span> {TYPE_BLURB[q.type]}
        </p>
        <h1
          id={`${ids}-q`}
          ref={headingRef}
          tabIndex={-1}
          className="max-w-[60ch] font-display text-2xl leading-snug font-semibold tracking-tight whitespace-pre-wrap outline-none sm:text-[1.75rem]"
        >
          {q.question}
        </h1>
      </header>

      {q.code && q.codeLanguage ? <CodeBlock code={q.code} language={q.codeLanguage} label="Code" /> : null}

      {/* Answer controls */}
      {graded && q.options ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitMcq();
          }}
          className="flex flex-col gap-4"
        >
          <fieldset className="flex flex-col gap-2.5" disabled={answered}>
            <legend className="sr-only">Choose one answer</legend>
            {q.options.map((o) => {
              const isSel = selected === o.id;
              const isRight = answered && o.id === q.correctAnswer;
              const isWrongPick = answered && isSel && !isRight;
              const tone = isRight
                ? "border-good bg-good-soft"
                : isWrongPick
                  ? "border-bad bg-bad-soft"
                  : isSel
                    ? "border-line-strong bg-card"
                    : "border-line bg-card hover:border-ink-3";
              return (
                <label
                  key={o.id}
                  className={`flex items-start gap-3 rounded-lg border p-4 transition-[border-color,background-color,box-shadow] has-[:focus-visible]:outline-[2.5px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent ${tone} ${answered ? "cursor-default" : ""}`}
                >
                  <input
                    type="radio"
                    name={`${ids}-mcq`}
                    value={o.id}
                    checked={isSel}
                    onChange={() => setSelected(o.id)}
                    className="sr-only"
                  />
                  <span
                    aria-hidden="true"
                    className={`grid size-7 shrink-0 place-items-center rounded border text-sm font-bold ${
                      isSel || isRight ? "border-ink bg-ink text-paper" : "border-line"
                    }`}
                  >
                    {o.id}
                  </span>
                  <span className="flex flex-1 flex-col gap-1 pt-0.5">
                    <span className="sr-only">Option {o.id}: </span>
                    <span className="whitespace-pre-wrap">{o.text}</span>
                    {isRight ? <span className="text-sm font-semibold text-good">✓ Correct answer</span> : null}
                    {isWrongPick ? <span className="text-sm font-semibold text-bad">✗ Your answer</span> : null}
                  </span>
                </label>
              );
            })}
          </fieldset>
          {!answered ? (
            <div className="flex flex-wrap items-center gap-3">
              <button type="submit" className="btn btn-primary" disabled={!selected}>
                Submit answer
              </button>
              <span className="text-sm text-ink-3">Keys: A–D or 1–4 to choose.</span>
            </div>
          ) : null}
        </form>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (draft.trim()) reveal(null);
          }}
          className="flex flex-col gap-3"
        >
          <label htmlFor={`${ids}-draft`} className="font-display text-base font-semibold">
            Your answer
          </label>
          <p id={`${ids}-draft-help`} className="-mt-2 text-sm text-ink-3">
            {requiresExpectedOutput(q.type)
              ? "Write the exact output, one line per log."
              : draftIsCode(q.type)
                ? "Write your code. It is not executed; you compare it with the reference."
                : "Write your answer, then reveal the reference to compare."}{" "}
            <span className="hidden sm:inline">⌘/Ctrl + Enter reveals.</span>
          </p>
          <textarea
            id={`${ids}-draft`}
            aria-describedby={`${ids}-draft-help`}
            value={draft}
            readOnly={answered}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && draft.trim()) {
                e.preventDefault();
                reveal(null);
              }
            }}
            rows={draftIsCode(q.type) ? 8 : 5}
            spellCheck={!draftIsCode(q.type)}
            autoCapitalize={draftIsCode(q.type) ? "off" : "sentences"}
            autoCorrect={draftIsCode(q.type) ? "off" : "on"}
            className={`field resize-y ${draftIsCode(q.type) ? "font-mono text-[0.9rem] leading-relaxed" : "leading-relaxed"} ${answered ? "bg-paper-2" : ""}`}
            placeholder={requiresExpectedOutput(q.type) ? "e.g. first line\nsecond line" : ""}
          />
          {!answered ? (
            <div className="flex flex-wrap items-center gap-3">
              <button type="submit" className="btn btn-primary" disabled={!draft.trim()}>
                Reveal reference answer
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => reveal("missed")}>
                Show me the answer
              </button>
            </div>
          ) : null}
        </form>
      )}

      {/* Progressive hints */}
      {!answered || hints > 0 ? (
        <section aria-labelledby={`${ids}-hints`} className="rounded-lg border border-dashed border-line p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id={`${ids}-hints`} className="font-display text-base font-semibold">
              Hints <span className="font-sans text-sm font-normal text-ink-3">({hints} of 2 used)</span>
            </h2>
            {!answered && hints < 2 ? (
              <button type="button" className="btn btn-sm" onClick={() => setHints((n) => Math.min(2, n + 1))}>
                Show hint {hints + 1}
                <kbd className="rounded border border-line px-1 font-mono text-xs text-ink-3">H</kbd>
              </button>
            ) : null}
          </div>
          <ol aria-live="polite" className="mt-1 flex flex-col gap-2 empty:hidden">
            {q.hints.slice(0, hints).map((h, i) => (
              <li key={i} className="animate-rise flex gap-3 text-[0.95rem]">
                <span className="pt-0.5 text-sm font-semibold text-ink-3">Hint {i + 1}</span>
                <PlainText text={h} />
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {answered && answer ? (
        <Reveal q={q} answer={answer} feedbackRef={feedbackRef} onVerdict={onVerdict} />
      ) : null}

      <RoadmapLinks questionId={q.id} />
    </article>
  );
}

function Reveal({
  q,
  answer,
  feedbackRef,
  onVerdict,
}: {
  q: Question;
  answer: Exclude<SessionAnswer, { kind: "skipped" }>;
  feedbackRef: React.RefObject<HTMLHeadingElement | null>;
  onVerdict: (v: SelfVerdict) => void;
}) {
  const correctOption = q.options?.find((o) => o.id === q.correctAnswer);
  const outputType = requiresExpectedOutput(q.type);

  let banner: React.ReactNode;
  if (answer.kind === "mcq") {
    banner = (
      <div className={`rounded-lg border p-5 ${answer.correct ? "border-good bg-good-soft" : "border-bad bg-bad-soft"}`}>
        <h2 ref={feedbackRef} tabIndex={-1} className="text-2xl font-bold outline-none">
          {answer.correct ? "✓ Correct" : `✗ Not quite. The answer is ${q.correctAnswer}`}
        </h2>
        <p className="mt-1 text-sm text-ink-2">Multiple choice is graded automatically.</p>
      </div>
    );
  } else {
    banner = (
      <div className="rounded-lg border border-line-strong bg-card p-5">
        <h2 ref={feedbackRef} tabIndex={-1} className="text-2xl font-bold outline-none">
          {answer.verdict === null ? "Compare, then mark yourself" : answer.verdict === "got-it" ? "✓ You marked: got it" : "✗ You marked: missed"}
        </h2>
        <p className="mt-1 text-sm text-ink-2">
          Self-reviewed. Your answer was not graded automatically. Compare it with the reference below and mark it honestly.
        </p>
        {answer.verdict === null ? (
          <div className="mt-4 flex flex-wrap gap-3" role="group" aria-label="Mark your answer">
            <button type="button" className="btn border-good" onClick={() => onVerdict("got-it")}>
              <span aria-hidden="true" className="text-good">✓</span> Got it
            </button>
            <button type="button" className="btn border-bad" onClick={() => onVerdict("missed")}>
              <span aria-hidden="true" className="text-bad">✗</span> Missed it
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <section aria-label="Answer and explanation" className="animate-rise flex flex-col gap-6">
      {banner}

      <div className={`grid gap-4 ${answer.kind === "self" && answer.draft.trim() ? "lg:grid-cols-2" : ""}`}>
        {answer.kind === "self" && answer.draft.trim() ? (
          <div className="flex min-w-0 flex-col gap-2">
            <h3 className="text-base">Your answer</h3>
            <pre tabIndex={0} aria-label="Your answer (scrollable)" className={`card overflow-x-auto p-4 text-[0.9rem] leading-relaxed ${draftIsCode(q.type) ? "font-mono whitespace-pre" : "font-sans whitespace-pre-wrap"}`}>
              {answer.draft}
            </pre>
          </div>
        ) : null}

        <div className="flex min-w-0 flex-col gap-2">
          <h3 className="text-base">{outputType ? "Correct answer and expected output" : "Correct answer"}</h3>
          {correctOption ? (
            <p className="card flex gap-3 p-4">
              <span className="grid size-7 shrink-0 place-items-center rounded bg-ink text-sm font-bold text-paper">{correctOption.id}</span>
              <span className="pt-0.5 whitespace-pre-wrap">{correctOption.text}</span>
            </p>
          ) : outputType ? (
            <OutputBlock text={q.correctAnswer} label="Console" />
          ) : answerIsCode(q.type) ? (
            <CodeBlock code={q.correctAnswer} language={detectLanguage(q.correctAnswer)} label="Reference solution" />
          ) : (
            <div className="card p-4">
              <PlainText text={q.correctAnswer} />
            </div>
          )}
        </div>
      </div>

      {q.expectedOutput !== null && q.expectedOutput !== q.correctAnswer ? (
        <OutputBlock text={q.expectedOutput} label="Expected output" />
      ) : null}

      <div className="flex flex-col gap-2">
        <h3 className="text-base">Explanation</h3>
        <PlainText text={q.explanation} className="text-[1.02rem] text-ink" />
      </div>

      <p className="text-sm">
        <span className="text-ink-3">Source: </span>
        <ExternalLink href={q.sourceUrl}>{new URL(q.sourceUrl).hostname.replace(/^www\./, "")} documentation</ExternalLink>
      </p>
    </section>
  );
}
