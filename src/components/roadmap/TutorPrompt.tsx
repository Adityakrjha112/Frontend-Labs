"use client";

import { useId, useMemo, useRef, useState } from "react";
import type { Topic } from "@/roadmap/model";
import { questionIdsForWeek } from "@/roadmap/links";
import { buildTutorPrompt, pickBankQuestions } from "@/roadmap/tutor-prompt";
import { statusOf } from "@/roadmap/state";
import { useRoadmapState } from "@/roadmap/store";
import { questionsFor } from "@/lib/bank";

type CopyState = { text: string; ok: boolean } | null;

/**
 * A ready-to-paste prompt for studying this week with an AI assistant in
 * voice mode. Built from the week's roadmap content and mapped questions.
 */
export function TutorPrompt({ topic, compact = false }: { topic: Topic; compact?: boolean }) {
  const state = useRoadmapState();
  const ids = useId();
  const [withProgress, setWithProgress] = useState(true);
  const [msg, setMsg] = useState<CopyState>(null);
  const previewRef = useRef<HTMLTextAreaElement>(null);
  const detailsRef = useRef<HTMLDetailsElement>(null);

  const done = useMemo(() => new Set(Object.keys(state.tasks)), [state.tasks]);
  const status = statusOf(state, topic.id);
  const prompt = useMemo(
    () =>
      buildTutorPrompt(
        topic,
        pickBankQuestions(questionsFor(questionIdsForWeek(topic.id))),
        withProgress ? { status, doneItemIds: done } : undefined,
      ),
    [topic, withProgress, status, done],
  );
  const words = prompt.split(/\s+/).length;

  const copy = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("no clipboard");
      await navigator.clipboard.writeText(prompt);
      setMsg({ ok: true, text: `Copied (${words.toLocaleString()} words). Paste it into your AI chat, then turn on voice mode.` });
    } catch {
      if (detailsRef.current) detailsRef.current.open = true;
      requestAnimationFrame(() => {
        previewRef.current?.focus();
        previewRef.current?.select();
      });
      setMsg({ ok: false, text: "Copying was blocked by the browser. The prompt is selected below; press Ctrl+C (or Cmd+C) to copy it." });
    }
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([prompt], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `week-${topic.week}-ai-tutor-prompt.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const heading = `Study week ${topic.week} with an AI tutor`;

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <button type="button" className="btn btn-sm" onClick={copy}>
          Copy AI tutor prompt
        </button>
        <span className="text-sm text-ink-3" aria-live="polite">
          {msg?.ok ? "Copied. Paste it into your AI chat and turn on voice mode." : msg ? msg.text : "For a voice session on this week."}
        </span>
        {msg && !msg.ok ? (
          <textarea ref={previewRef} readOnly aria-label="AI tutor prompt" className="field mt-2 min-h-40 text-sm" value={prompt} />
        ) : null}
      </div>
    );
  }

  return (
    <section aria-labelledby={`${ids}-h`} className="rm-subcard">
      <h3 id={`${ids}-h`} className="rm-h4">
        {heading}
      </h3>
      <p className="max-w-[70ch] text-sm text-ink-2">
        Copy this prompt, paste it into a chat with your AI assistant, then turn on voice mode. It covers this week&apos;s concepts, project, exercise and
        interview questions, and the tutor will talk you through them one question at a time.
      </p>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={withProgress} onChange={(e) => setWithProgress(e.target.checked)} className="size-4 accent-[var(--accent)]" />
        Include my progress this week (status and finished tasks)
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-sm btn-primary" onClick={copy}>
          Copy prompt
        </button>
        <button type="button" className="btn btn-sm" onClick={download}>
          Download as text
        </button>
      </div>
      <p className={`text-sm ${msg ? (msg.ok ? "text-good" : "text-bad") : ""}`} aria-live="polite">
        {msg?.text}
      </p>
      <details ref={detailsRef} className="rm-hint-box">
        <summary>Preview the prompt ({words.toLocaleString()} words)</summary>
        <textarea
          ref={previewRef}
          readOnly
          aria-label={`AI tutor prompt for week ${topic.week}`}
          className="field mt-3 min-h-80 resize-y text-sm leading-relaxed"
          value={prompt}
        />
      </details>
    </section>
  );
}
