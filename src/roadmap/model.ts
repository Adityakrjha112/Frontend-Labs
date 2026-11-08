/**
 * Typed roadmap content plus the derived structure the original tracker
 * built at boot. Item IDs (`w6-t1`, `w6-iq`, `m1-ms1`, `m1-cp`) are kept
 * identical to the original so existing saved progress keeps resolving.
 */
import raw from "./content.json";

export type Link = [title: string, url: string];

export interface StudyTopicContent {
  id: string;
  week: number;
  title: string;
  time: string;
  gap?: boolean;
  purpose: string;
  prereq: string;
  skip: string;
  concepts: string;
  project: string;
  exercise: string;
  hint: string;
  questions: string[];
  resources: Link[];
  resourceNote?: string;
  tasks: string[];
}

export interface CapstoneTopicContent {
  id: string;
  week: number;
  title: string;
  capstoneWeek: true;
  plan: string;
  tasks: string[];
}

export type TopicContent = StudyTopicContent | CapstoneTopicContent;

export interface MonthContent {
  id: string;
  n: number;
  weeks: string;
  title: string;
  theme: string;
  capstone?: boolean;
  intro: string;
  topics: TopicContent[];
  milestone: string[];
  checkpoint: string;
}

export interface RoadmapContent {
  title: string;
  asOf: string;
  months: MonthContent[];
  capstone: {
    features: [string, string][];
    apiIntro: string;
    endpoints: string[];
    acceptance: [string, string, string][];
    docs: string;
    caseStudy: string;
  };
  guide: {
    assessmentLead: string;
    assessment: [string, string, string, string][];
    assumptions: string;
    hints: [string, string][];
    rhythm: [string, string, string][];
    skipChecks: string;
    hintsRule: string;
    debugging: string[];
    artifacts: [string, string][];
    tradeoff: string;
    checkpoints: [string, string, string, string][];
    checkpointRule: string;
    behind: string;
    workWithMe: string;
    resources: [string, string, string][];
  };
}

export const ROADMAP = raw as unknown as RoadmapContent;

export type ItemKind = "task" | "milestone" | "checkpoint";

export interface ChecklistItem {
  id: string;
  label: string;
  kind: ItemKind;
  topicId: string | null;
  monthId: string;
}

export interface Topic {
  content: TopicContent;
  id: string;
  week: number;
  title: string;
  monthId: string;
  items: ChecklistItem[];
  searchText: string;
}

export interface Month {
  content: MonthContent;
  id: string;
  n: number;
  theme: string;
  topics: Topic[];
  milestoneItems: ChecklistItem[];
  checkpointItem: ChecklistItem;
  /** Every checklist item in the month: topic tasks, milestone, checkpoint. */
  items: ChecklistItem[];
  searchText: string;
}

export const isStudyTopic = (t: TopicContent): t is StudyTopicContent => !("capstoneWeek" in t);

/** Strips inline markdown for search, matching the original `plain()`. */
export const plain = (s: string | undefined): string =>
  String(s ?? "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[`*]/g, "");

export const MONTHS: readonly Month[] = ROADMAP.months.map((m) => {
  const topics: Topic[] = m.topics.map((t) => {
    const items: ChecklistItem[] = t.tasks.map((label, i) => ({
      id: `${t.id}-t${i + 1}`,
      label,
      kind: "task",
      topicId: t.id,
      monthId: m.id,
    }));
    if (isStudyTopic(t)) {
      items.push({ id: `${t.id}-iq`, label: "Interview questions answered out loud", kind: "task", topicId: t.id, monthId: m.id });
    }
    const parts = isStudyTopic(t)
      ? [t.title, `week ${t.week}`, t.purpose, t.prereq, t.skip, t.concepts, t.project, t.exercise, t.hint, ...t.questions, ...t.tasks, ...t.resources.map((r) => r[0]), t.resourceNote]
      : [t.title, `week ${t.week}`, t.plan, ...t.tasks];
    return {
      content: t,
      id: t.id,
      week: t.week,
      title: t.title,
      monthId: m.id,
      items,
      searchText: plain(parts.filter(Boolean).join(" ")).toLowerCase(),
    };
  });
  const milestoneItems: ChecklistItem[] = m.milestone.map((label, i) => ({
    id: `${m.id}-ms${i + 1}`,
    label,
    kind: "milestone",
    topicId: null,
    monthId: m.id,
  }));
  const checkpointItem: ChecklistItem = {
    id: `${m.id}-cp`,
    label: m.capstone ? "Final review passed" : `Review checkpoint ${m.n} passed`,
    kind: "checkpoint",
    topicId: null,
    monthId: m.id,
  };
  return {
    content: m,
    id: m.id,
    n: m.n,
    theme: m.theme,
    topics,
    milestoneItems,
    checkpointItem,
    items: [...topics.flatMap((t) => t.items), ...milestoneItems, checkpointItem],
    searchText: plain([m.title, m.intro, ...m.milestone, m.checkpoint].join(" ")).toLowerCase(),
  };
});

export const TOPICS: readonly Topic[] = MONTHS.flatMap((m) => m.topics);
export const TOPIC_BY_ID: ReadonlyMap<string, Topic> = new Map(TOPICS.map((t) => [t.id, t]));
export const MONTH_BY_ID: ReadonlyMap<string, Month> = new Map(MONTHS.map((m) => [m.id, m]));
export const ALL_ITEMS: readonly ChecklistItem[] = MONTHS.flatMap((m) => m.items);
export const ITEM_BY_ID: ReadonlyMap<string, ChecklistItem> = new Map(ALL_ITEMS.map((i) => [i.id, i]));

export function monthOf(topic: Topic): Month {
  return MONTH_BY_ID.get(topic.monthId)!;
}
