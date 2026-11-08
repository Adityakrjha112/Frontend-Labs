"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Md } from "@/roadmap/Md";
import { isStudyTopic, type Topic } from "@/roadmap/model";
import { doneCount, MAX_NOTE, STATUSES, STATUS_LABEL, statusOf } from "@/roadmap/state";
import { roadmapActions, useRoadmapState } from "@/roadmap/store";
import { questionIdsForWeek } from "@/roadmap/links";
import { PARTIAL_COVERAGE, UNMAPPED_WEEKS } from "@/roadmap/question-map";
import { questionsFor } from "@/lib/bank";
import { selectQuestions } from "@/lib/session";
import { techMeta } from "@/lib/taxonomy";
import { useStartSession } from "@/lib/useStartSession";
import { CheckRow } from "./bits";
import { TutorPrompt } from "./TutorPrompt";

const fmtTime = (d: Date) => d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

function Notes({ topic }: { topic: Topic }) {
  const state = useRoadmapState();
  const saved = state.notes[topic.id] ?? "";
  const [draft, setDraft] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const timer = useRef<number | undefined>(undefined);
  const value = draft ?? saved;
  const id = `note-${topic.id}`;

  const flush = (text: string) => {
    window.clearTimeout(timer.current);
    timer.current = undefined;
    const ok = roadmapActions.setNote(topic.id, text);
    setStatus(ok ? `Saved ${fmtTime(new Date())}` : roadmapActions.storageOK() ? "Not saved" : "Not saved: storage blocked");
    setDraft(null);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <div className="rm-subcard">
      <div className="rm-row items-center">
        <label htmlFor={id} className="rm-h4">
          Notes
        </label>
        <span className="rm-meta" aria-live="polite">
          {status}
        </span>
      </div>
      <textarea
        id={id}
        className="field min-h-24 resize-y text-[0.93rem] leading-normal"
        maxLength={MAX_NOTE}
        placeholder="Your notes, links, answers, and bugs found. Saved automatically."
        value={value}
        onChange={(e) => {
          const text = e.target.value;
          setDraft(text);
          setStatus("Saving…");
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => flush(text), 500);
        }}
        onBlur={() => {
          if (timer.current !== undefined && draft !== null) flush(draft);
        }}
      />
    </div>
  );
}

/** Practice questions mapped to this week through src/roadmap/question-map.ts. */
export function RelatedQuestions({ topic, compact = false }: { topic: Topic; compact?: boolean }) {
  const start = useStartSession();
  const ids = questionIdsForWeek(topic.id);
  const questions = questionsFor(ids);
  const headingId = useId();

  if (ids.length === 0) {
    return (
      <div className="rm-subcard">
        <h3 id={headingId} className="rm-h4">
          Practice questions
        </h3>
        <p className="text-sm text-ink-2">
          No workbook questions are mapped to this week. {UNMAPPED_WEEKS[topic.id] ?? ""}
        </p>
      </div>
    );
  }
  const title = `Week ${topic.week}: ${topic.title}`;
  return (
    <div className="rm-subcard">
      <div className="rm-row items-center">
        <h3 id={headingId} className="rm-h4">
          {ids.length} practice questions
        </h3>
      </div>
      {PARTIAL_COVERAGE[topic.id] ? <p className="text-xs text-ink-3">Partial coverage: {PARTIAL_COVERAGE[topic.id]}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-sm btn-primary" onClick={() => start(title, "roadmap", ids)}>
          Practise all {ids.length}
        </button>
        {ids.length > 10 ? (
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => start(`${title}, 10 random`, "roadmap", selectQuestions(questions, 10).map((q) => q.id))}
          >
            Practise 10 at random
          </button>
        ) : null}
      </div>
      {!compact ? (
        <details className="rm-hint-box">
          <summary>Show the {ids.length} mapped questions</summary>
          <ul className="mt-3 flex flex-col gap-2">
            {questions.map((q) => (
              <li key={q.id} className="flex items-start justify-between gap-3 text-sm">
                <span className="min-w-0">
                  <span className="text-xs text-ink-3">
                    <span className="font-mono font-semibold text-ink-2">{q.id}</span> {techMeta(q.technology).short}, {q.type}
                  </span>
                  <span className="block">{q.question}</span>
                </span>
                <button type="button" className="btn btn-sm btn-ghost shrink-0" onClick={() => start(`Question ${q.id}`, "single", [q.id])}>
                  Practise<span className="sr-only"> {q.id}</span>
                </button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

/**
 * Week body: status, facts, tasks, notes and mapped practice questions.
 * Mirrors the original renderTopic() layout.
 */
export function TopicBody({ topic, showPageLink = false }: { topic: Topic; showPageLink?: boolean }) {
  const state = useRoadmapState();
  const st = statusOf(state, topic.id);
  const done = doneCount(state, topic.items);
  const t = topic.content;

  return (
    <div className="rm-topic-body">
      <div className="rm-status-row">
        <span className="rm-meta" aria-hidden="true">
          Status
        </span>
        <fieldset className="rm-segmented">
          <legend className="sr-only">Status for week {topic.week}</legend>
          {STATUSES.map((s) => (
            <label key={s}>
              <input
                type="radio"
                name={`status-${topic.id}`}
                value={s}
                checked={st === s}
                onChange={() => roadmapActions.setStatus(topic.id, s)}
              />{" "}
              {STATUS_LABEL[s]}
            </label>
          ))}
        </fieldset>
        {isStudyTopic(t) ? <span className="rm-meta">Time: {t.time}</span> : null}
        {showPageLink ? (
          <Link href={`/roadmap/${topic.id}`} className="ml-auto inline-flex min-h-11 items-center text-sm font-medium">
            Open the week {topic.week} page
          </Link>
        ) : null}
      </div>

      <dl className="rm-facts">
        {isStudyTopic(t) ? (
          <>
            <dt>Purpose</dt>
            <dd><Md>{t.purpose}</Md></dd>
            <dt>Prerequisites</dt>
            <dd><Md>{t.prereq}</Md></dd>
            <dt>Skip check</dt>
            <dd><Md>{t.skip}</Md></dd>
            <dt>Key concepts</dt>
            <dd><Md>{t.concepts}</Md></dd>
            <dt>Time</dt>
            <dd><Md>{t.time}</Md></dd>
            <dt>Project</dt>
            <dd><Md>{t.project}</Md></dd>
            <dt>Advanced exercise</dt>
            <dd>
              <Md>{t.exercise}</Md>
              <details className="rm-hint-box">
                <summary>Show hint</summary>
                <p>
                  <strong>Hint:</strong> <Md>{t.hint}</Md>
                </p>
              </details>
            </dd>
            <dt>Interview questions</dt>
            <dd>
              <ol>
                {t.questions.map((q, i) => (
                  <li key={i}><Md>{q}</Md></li>
                ))}
              </ol>
            </dd>
            <dt id={showPageLink ? undefined : "resources"} className="scroll-mt-24">
              Resources
            </dt>
            <dd>
              <ul>
                {t.resourceNote ? <li><Md>{t.resourceNote}</Md></li> : null}
                {t.resources.map(([title, url]) => (
                  <li key={url}>
                    <a href={url} target="_blank" rel="noopener noreferrer">
                      {title}
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  </li>
                ))}
              </ul>
            </dd>
          </>
        ) : (
          <>
            <dt>Plan</dt>
            <dd><Md>{t.plan}</Md></dd>
          </>
        )}
      </dl>

      <div className="rm-split">
        <div className="rm-subcard">
          <div className="rm-row items-center">
            <h3 className="rm-h4">Tasks</h3>
            <span className="rm-count">
              {done} of {topic.items.length} done
            </span>
          </div>
          <ul className="rm-check-list">
            {topic.items.map((it) => (
              <CheckRow key={it.id} item={it} idPrefix={showPageLink ? "cb-" : "page-cb-"} />
            ))}
          </ul>
          {done === topic.items.length && st !== "completed" ? (
            <div className="rm-all-done">
              <span>All tasks for week {topic.week} are done.</span>
              <button type="button" className="btn btn-sm" onClick={() => roadmapActions.completeWeek(topic.id)}>
                Mark week {topic.week} completed
              </button>
            </div>
          ) : null}
        </div>
        <Notes topic={topic} />
      </div>

      <TutorPrompt topic={topic} />

      <RelatedQuestions topic={topic} compact={showPageLink} />
    </div>
  );
}
