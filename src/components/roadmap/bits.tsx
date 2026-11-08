"use client";

import { Md } from "@/roadmap/Md";
import { MONTH_BY_ID, TOPIC_BY_ID, type ChecklistItem } from "@/roadmap/model";
import { STATUS_LABEL, isDone, type Status } from "@/roadmap/state";
import { roadmapActions, useBanner, useRoadmapState, useToasts } from "@/roadmap/store";

export function Chevron() {
  return (
    <svg className="rm-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

export function StatusPill({ status }: { status: Status }) {
  return (
    <span className={`rm-pill ${status}`}>
      <span className="rm-dot" aria-hidden="true" />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function Bar({ value, good = false, label }: { value: number; good?: boolean; label?: string }) {
  return (
    <span
      className={`rm-bar ${good ? "good" : ""}`}
      style={{ display: "block" }}
      role={label ? "meter" : undefined}
      aria-label={label}
      aria-valuemin={label ? 0 : undefined}
      aria-valuemax={label ? 100 : undefined}
      aria-valuenow={label ? value : undefined}
      aria-hidden={label ? undefined : true}
    >
      <span style={{ width: `${Math.min(100, value)}%` }} />
    </span>
  );
}

/** A checklist row; checking it records progress exactly like the original. */
export function CheckRow({ item, idPrefix, withContext = false }: { item: ChecklistItem; idPrefix: string; withContext?: boolean }) {
  const state = useRoadmapState();
  const done = isDone(state, item.id);
  const id = `${idPrefix}${item.id}`;
  const topic = item.topicId ? TOPIC_BY_ID.get(item.topicId) : null;
  return (
    <li className={`rm-check ${done ? "done" : ""}`}>
      <input type="checkbox" id={id} checked={done} onChange={(e) => roadmapActions.setTask(item.id, e.target.checked)} />
      <label htmlFor={id}>
        <Md>{item.label}</Md>
        {withContext ? (
          <span className="ctx">
            {topic ? `Week ${topic.week}: ${topic.title}` : `Month ${MONTH_BY_ID.get(item.monthId)!.n} milestone`}
          </span>
        ) : null}
      </label>
    </li>
  );
}

export function RoadmapToasts() {
  const toasts = useToasts();
  return (
    <div className="rm-toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="rm-toast">
          {t.text}
        </div>
      ))}
    </div>
  );
}

export function StorageBanner() {
  const banner = useBanner();
  if (!banner) return null;
  return (
    <div className={`rm-banner ${banner.error ? "error" : ""}`} role="alert">
      <p className="text-sm">{banner.text}</p>
      <button type="button" className="btn btn-sm" onClick={() => roadmapActions.dismissBanner()}>
        Dismiss
      </button>
    </div>
  );
}
