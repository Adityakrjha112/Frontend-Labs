"use client";

import { useId } from "react";
import { DIFFICULTIES, QUESTION_TYPES, type Question } from "@/lib/types";
import { TECHNOLOGY_META } from "@/lib/taxonomy";
import { TOPICS_BY_TECH } from "@/lib/bank";
import { filterQuestions, type QuestionFilters } from "@/lib/session";

interface ChipGroupProps<T extends string> {
  legend: string;
  options: readonly { value: T; label: string; count?: number }[];
  selected: readonly T[];
  onChange: (next: T[]) => void;
  hint?: string;
}

export function ChipGroup<T extends string>({ legend, options, selected, onChange, hint }: ChipGroupProps<T>) {
  const id = useId();
  return (
    <fieldset className="flex flex-col gap-2.5" aria-describedby={hint ? `${id}-hint` : undefined}>
      <legend className="mb-2.5 flex w-full items-baseline justify-between gap-3">
        <span className="font-display text-base font-semibold">{legend}</span>
        {selected.length > 0 ? (
          <button type="button" className="text-xs font-medium text-ink-3 underline hover:text-ink" onClick={() => onChange([])}>
            Clear<span className="sr-only"> {legend}</span>
          </button>
        ) : (
          <span className="text-xs text-ink-3">Any</span>
        )}
      </legend>
      {hint ? (
        <p id={`${id}-hint`} className="-mt-1 text-xs text-ink-3">
          {hint}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const checked = selected.includes(o.value);
          return (
            <label key={o.value} className="relative">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={checked}
                onChange={() => onChange(checked ? selected.filter((s) => s !== o.value) : [...selected, o.value])}
              />
              <span className="chip">
                {o.label}
                {o.count !== undefined ? (
                  <span className="text-xs tabular-nums opacity-70" aria-label={`${o.count} questions`}>
                    {o.count}
                  </span>
                ) : null}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function countBy<K extends string>(qs: readonly Question[], key: (q: Question) => K): Map<K, number> {
  const m = new Map<K, number>();
  for (const q of qs) m.set(key(q), (m.get(key(q)) ?? 0) + 1);
  return m;
}

/**
 * Faceted filter panel. Counts for each facet reflect the other active
 * filters, so users can see what a choice will yield before picking it.
 */
export function FilterPanel({
  questions,
  filters,
  onChange,
}: {
  questions: readonly Question[];
  filters: QuestionFilters;
  onChange: (f: QuestionFilters) => void;
}) {
  const without = (k: keyof QuestionFilters) => filterQuestions(questions, { ...filters, [k]: [] });
  const techCounts = countBy(without("technologies"), (q) => q.technology);
  const topicCounts = countBy(without("topics"), (q) => q.topic);
  const diffCounts = countBy(without("difficulties"), (q) => q.difficulty);
  const typeCounts = countBy(without("types"), (q) => q.type);

  const topicSource = filters.technologies.length > 0 ? filters.technologies : [];
  const topics = topicSource.flatMap((t) => TOPICS_BY_TECH.get(t) ?? []);
  const uniqueTopics = [...new Set([...topics, ...filters.topics])];

  return (
    <div className="flex flex-col gap-7">
      <ChipGroup
        legend="Technology"
        options={TECHNOLOGY_META.map((t) => ({ value: t.label, label: t.short, count: techCounts.get(t.label) ?? 0 }))}
        selected={filters.technologies}
        onChange={(technologies) => {
          const allowed = new Set(technologies.flatMap((t) => TOPICS_BY_TECH.get(t) ?? []));
          onChange({
            ...filters,
            technologies,
            topics: technologies.length === 0 ? [] : filters.topics.filter((t) => allowed.has(t)),
          });
        }}
      />
      {uniqueTopics.length > 0 ? (
        <ChipGroup
          legend="Topic"
          options={uniqueTopics.map((t) => ({ value: t, label: t, count: topicCounts.get(t) ?? 0 }))}
          selected={filters.topics}
          onChange={(topics) => onChange({ ...filters, topics })}
        />
      ) : (
        <div>
          <p className="font-display text-base font-semibold">Topic</p>
          <p className="mt-1 text-sm text-ink-3">Pick a technology to narrow by topic.</p>
        </div>
      )}
      <ChipGroup
        legend="Difficulty"
        options={DIFFICULTIES.map((d) => ({ value: d, label: d, count: diffCounts.get(d) ?? 0 }))}
        selected={filters.difficulties}
        onChange={(difficulties) => onChange({ ...filters, difficulties })}
      />
      <ChipGroup
        legend="Question type"
        options={QUESTION_TYPES.map((t) => ({ value: t, label: t, count: typeCounts.get(t) ?? 0 }))}
        selected={filters.types}
        onChange={(types) => onChange({ ...filters, types })}
        hint="MCQ is auto-graded. Every other type is self-reviewed against the reference answer."
      />
    </div>
  );
}
