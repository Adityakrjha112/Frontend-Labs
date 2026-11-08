import type { Question } from "@/lib/types";
import { techMeta } from "@/lib/taxonomy";

/** Workbook text rendered as plain text with preserved line breaks. */
export function PlainText({ text, className = "" }: { text: string; className?: string }) {
  return <p className={`prose-lab ${className}`}>{text}</p>;
}

const DIFF_DOTS = { Beginner: 1, Intermediate: 2, Advanced: 3 } as const;

export function DifficultyMark({ difficulty }: { difficulty: Question["difficulty"] }) {
  const n = DIFF_DOTS[difficulty];
  return (
    <span className="tag gap-1.5">
      <span aria-hidden="true" className="flex gap-0.5">
        {[1, 2, 3].map((i) => (
          <span key={i} className={`size-1.5 rounded-full ${i <= n ? "bg-accent" : "bg-line"}`} />
        ))}
      </span>
      {difficulty}
    </span>
  );
}

export function QuestionMeta({ q, compact = false }: { q: Question; compact?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="tag tag-id">{q.id}</span>
      <span className="tag">{techMeta(q.technology).short}</span>
      <DifficultyMark difficulty={q.difficulty} />
      <span className="tag">{q.type}</span>
      {!compact ? (
        <span className="tag max-w-full truncate" title={`${q.topic}: ${q.subtopic}`}>
          {q.topic}: {q.subtopic}
        </span>
      ) : null}
    </div>
  );
}

/** Horizontal meter. The numeric value is always also given as text. */
export function Meter({ value, label, tone = "ink" }: { value: number | null; label: string; tone?: "ink" | "accent" | "good" }) {
  const pctValue = value === null ? 0 : Math.round(value * 100);
  const color = tone === "accent" ? "bg-accent" : tone === "good" ? "bg-good" : "bg-ink";
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pctValue}
      aria-valuetext={value === null ? "No data yet" : `${pctValue}%`}
      className="h-2 w-full overflow-hidden rounded-full bg-paper-2"
    >
      <div className={`h-full rounded-full ${color} transition-[width] duration-500 ease-out`} style={{ width: `${pctValue}%` }} />
    </div>
  );
}

/**
 * A "Computed panel" row: the property name on the left, its value on the
 * right, and an optional note underneath. Must be placed inside a <dl>.
 */
export function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="kv">
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
      {detail ? <dd>{detail}</dd> : null}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-start gap-3 p-8">
      <h2 className="text-2xl font-bold">{title}</h2>
      {children}
    </div>
  );
}

export function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-accent underline decoration-2 hover:decoration-4">
      {children}
      <span aria-hidden="true"> ↗</span>
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

/**
 * Accessible on/off switch: a native checkbox with role="switch" for
 * keyboard and screen readers, and a drawn track and thumb. The state is
 * also written as text, so it never relies on position or colour alone.
 */
export function Switch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-md px-1 text-sm">
      <span className="font-medium">{label}</span>
      <span className="flex items-center gap-2">
        <span aria-hidden="true" className="w-6 text-right text-xs font-semibold text-ink-3">
          {checked ? "On" : "Off"}
        </span>
        <input
          type="checkbox"
          role="switch"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          className={`relative inline-block h-6 w-11 shrink-0 rounded-full border transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent ${
            checked ? "border-accent bg-accent" : "border-ink-3 bg-paper-2"
          }`}
        >
          <span
            className={`absolute top-1/2 left-[3px] size-4 -translate-y-1/2 rounded-full transition-transform ${
              checked ? "translate-x-5 bg-accent-ink" : "translate-x-0 bg-ink-3"
            }`}
          />
        </span>
      </span>
    </label>
  );
}
