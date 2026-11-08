/**
 * Roadmap tracker state: a pure port of the original index.html logic.
 *
 * The storage key, schema and field rules are unchanged, so progress saved
 * by the original page (same origin) or exported from it loads as-is.
 */
import { ITEM_BY_ID, MONTH_BY_ID, TOPIC_BY_ID, TOPICS, type ChecklistItem, type Topic } from "./model";

export const APP_ID = "fe-depth-tracker";
export const SCHEMA = 1;
export const STORAGE_KEY = "fe-depth-tracker:v1";
export const BACKUP_KEY = "fe-depth-tracker:unreadable-backup";
export const STATUSES = ["not-started", "in-progress", "completed"] as const;
export type Status = (typeof STATUSES)[number];
export const STATUS_LABEL: Record<Status, string> = {
  "not-started": "Not started",
  "in-progress": "In progress",
  completed: "Completed",
};
export const FILTERS = ["all", ...STATUSES] as const;
export type Filter = (typeof FILTERS)[number];
export const THEMES = ["system", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];
export const KINDS = ["Learn", "Build", "Advanced exercise", "Write", "Review", "Other"] as const;
export type Kind = (typeof KINDS)[number];
export const DAILY_GOAL_MIN = 90;
export const HEAT_WEEKS = 27;
export const MAX_NOTE = 20000;

export interface LogEntry {
  id: string;
  at: string;
  minutes: number;
  kind: Kind;
  topic: string;
  note: string;
}
export interface Day {
  logs: LogEntry[];
  tasks: string[];
}
export interface RoadmapState {
  app: typeof APP_ID;
  schema: typeof SCHEMA;
  topics: Record<string, Status>;
  tasks: Record<string, string>;
  notes: Record<string, string>;
  activity: Record<string, Day>;
  visits: Record<string, number>;
  prefs: { theme: Theme; filter: Filter; open: Record<string, boolean> };
}

export function defaultState(): RoadmapState {
  return {
    app: APP_ID,
    schema: SCHEMA,
    topics: {},
    tasks: {},
    notes: {},
    activity: {},
    visits: {},
    prefs: { theme: "system", filter: "all", open: {} },
  };
}

/* ---------- Local calendar dates ---------- */
const pad = (n: number) => String(n).padStart(2, "0");
export const keyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseKey = (k: string) => {
  const [y, m, d] = k.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
};
export const addDays = (k: string, n: number) => {
  const d = parseKey(k);
  return keyOf(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
};
export const isKey = (k: unknown): k is string =>
  typeof k === "string" && /^\d{4}-\d{2}-\d{2}$/.test(k) && keyOf(parseKey(k)) === k;

const isObj = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/**
 * Copies only valid fields from untrusted data (same rules as the original).
 * Returns the clean state and how many entries were skipped.
 */
export function sanitize(raw: unknown, now: Date = new Date()): { state: RoadmapState; skipped: number } {
  const s = defaultState();
  let skipped = 0;
  if (!isObj(raw)) return { state: s, skipped: 1 };
  const take = (obj: unknown, fn: (k: string, v: unknown) => boolean) => {
    if (obj === undefined) return;
    if (!isObj(obj)) {
      skipped++;
      return;
    }
    for (const k of Object.keys(obj)) if (!fn(k, obj[k])) skipped++;
  };
  const isMonthId = (k: string) => MONTH_BY_ID.has(k);

  take(raw.topics, (k, v) => {
    if (TOPIC_BY_ID.has(k) && STATUSES.includes(v as Status)) {
      if (v !== "not-started") s.topics[k] = v as Status;
      return true;
    }
    return false;
  });
  take(raw.tasks, (k, v) => {
    if (!ITEM_BY_ID.has(k)) return false;
    if (v === true) {
      s.tasks[k] = now.toISOString();
      return true;
    }
    if (typeof v === "string" && !Number.isNaN(Date.parse(v))) {
      s.tasks[k] = v;
      return true;
    }
    return false;
  });
  take(raw.notes, (k, v) => {
    if (TOPIC_BY_ID.has(k) && typeof v === "string") {
      if (v) s.notes[k] = v.slice(0, MAX_NOTE);
      return true;
    }
    return false;
  });
  take(raw.activity, (k, v) => {
    if (!isKey(k) || !isObj(v)) return false;
    const day: Day = { logs: [], tasks: [] };
    if (Array.isArray(v.logs)) {
      for (const l of v.logs as unknown[]) {
        const min = Number(isObj(l) ? l.minutes : NaN);
        if (!isObj(l) || !Number.isFinite(min) || min < 1 || min > 600) {
          skipped++;
          continue;
        }
        day.logs.push({
          id: typeof l.id === "string" && l.id ? l.id.slice(0, 40) : uid(),
          at: typeof l.at === "string" && !Number.isNaN(Date.parse(l.at)) ? l.at : parseKey(k).toISOString(),
          minutes: Math.round(min),
          kind: KINDS.includes(l.kind as Kind) ? (l.kind as Kind) : "Other",
          topic: typeof l.topic === "string" && TOPIC_BY_ID.has(l.topic) ? l.topic : "",
          note: typeof l.note === "string" ? l.note.slice(0, 200) : "",
        });
      }
    } else if (v.logs !== undefined) skipped++;
    if (Array.isArray(v.tasks)) {
      for (const id of v.tasks as unknown[]) {
        if (typeof id === "string" && ITEM_BY_ID.has(id) && !day.tasks.includes(id)) day.tasks.push(id);
        else skipped++;
      }
    } else if (v.tasks !== undefined) skipped++;
    if (day.logs.length || day.tasks.length) s.activity[k] = day;
    return true;
  });
  take(raw.visits, (k, v) => {
    const n = Number(v);
    if (isKey(k) && Number.isInteger(n) && n >= 1 && n <= 1e6) {
      s.visits[k] = n;
      return true;
    }
    return false;
  });
  if (raw.prefs !== undefined) {
    if (!isObj(raw.prefs)) skipped++;
    else {
      const p = raw.prefs;
      if (THEMES.includes(p.theme as Theme)) s.prefs.theme = p.theme as Theme;
      else if (p.theme !== undefined) skipped++;
      if (FILTERS.includes(p.filter as Filter)) s.prefs.filter = p.filter as Filter;
      else if (p.filter !== undefined) skipped++;
      take(p.open, (k, v) => {
        if ((TOPIC_BY_ID.has(k) || isMonthId(k)) && typeof v === "boolean") {
          s.prefs.open[k] = v;
          return true;
        }
        return false;
      });
    }
  }
  return { state: s, skipped };
}

/* ---------- Storage ---------- */
export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export interface Banner {
  text: string;
  error: boolean;
}
export interface LoadResult {
  state: RoadmapState;
  storageOK: boolean;
  banner: Banner | null;
}

export function loadState(storage: StorageLike | null): LoadResult {
  let storageOK = !!storage;
  if (storage) {
    try {
      storage.setItem("__fe_probe__", "1");
      storage.removeItem("__fe_probe__");
    } catch {
      storageOK = false;
    }
  }
  if (!storage || !storageOK) {
    return {
      state: defaultState(),
      storageOK: false,
      banner: {
        text: "This browser is blocking local storage, so progress will be lost when you close the page. Use Data → Copy JSON to keep a copy.",
        error: true,
      },
    };
  }
  let raw: string | null = null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    raw = null;
  }
  if (raw === null) return { state: defaultState(), storageOK, banner: null };
  const recover = (): LoadResult => {
    try {
      storage.setItem(BACKUP_KEY, raw!);
    } catch {
      /* ignore */
    }
    return {
      state: defaultState(),
      storageOK,
      banner: {
        text: `Your saved data could not be read, so the tracker started fresh. A copy of the unreadable data was kept in this browser under the key “${BACKUP_KEY}”.`,
        error: true,
      },
    };
  };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return recover();
  }
  if (!isObj(parsed) || (parsed.app !== undefined && parsed.app !== APP_ID) || (typeof parsed.schema === "number" && parsed.schema > SCHEMA)) {
    return recover();
  }
  const { state, skipped } = sanitize(parsed);
  return {
    state,
    storageOK,
    banner: skipped
      ? {
          text: `${skipped} saved ${skipped === 1 ? "entry was" : "entries were"} invalid and ${skipped === 1 ? "was" : "were"} skipped. Everything else loaded normally.`,
          error: false,
        }
      : null,
  };
}

export function saveState(storage: StorageLike | null, state: RoadmapState): boolean {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

/* ---------- Import / export ---------- */
export function exportJSON(state: RoadmapState, now: Date = new Date()): string {
  return JSON.stringify({ ...state, exportedAt: now.toISOString() }, null, 2);
}

export type ImportCheck =
  | { ok: true; state: RoadmapState; skipped: number }
  | { ok: false; message: string };

/** Validates pasted/uploaded export text with the original messages. */
export function checkImport(text: string): ImportCheck {
  const t = text.trim();
  if (!t) return { ok: false, message: "Choose a file or paste exported JSON first." };
  let parsed: unknown;
  try {
    parsed = JSON.parse(t);
  } catch (e) {
    return { ok: false, message: `That isn't valid JSON (${(e as Error).message}). Check that you pasted the whole export.` };
  }
  const looksRight =
    isObj(parsed) && (parsed.app === APP_ID || (parsed.app === undefined && (isObj(parsed.tasks) || isObj(parsed.topics))));
  if (!looksRight || !isObj(parsed)) return { ok: false, message: `This doesn't look like a roadmap export. Exports start with "app": "${APP_ID}".` };
  if (typeof parsed.schema === "number" && parsed.schema > SCHEMA) {
    return { ok: false, message: "This export comes from a newer version of the tracker and can't be imported here." };
  }
  const { state, skipped } = sanitize(parsed);
  return { ok: true, state, skipped };
}

/* ---------- Queries ---------- */
export const statusOf = (s: RoadmapState, id: string): Status => s.topics[id] ?? "not-started";
export const isDone = (s: RoadmapState, itemId: string) => !!s.tasks[itemId];
export const dayOf = (s: RoadmapState, k: string): Day | undefined => s.activity[k];
export const isStudyDay = (s: RoadmapState, k: string) => {
  const a = s.activity[k];
  return !!a && (a.logs.length > 0 || a.tasks.length > 0);
};
export const minutesOn = (s: RoadmapState, k: string) => (s.activity[k]?.logs ?? []).reduce((n, l) => n + l.minutes, 0);
export const doneCount = (s: RoadmapState, items: readonly ChecklistItem[]) => items.filter((it) => isDone(s, it.id)).length;
export const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

export function currentStreak(s: RoadmapState, today: string): number {
  let k = isStudyDay(s, today) ? today : addDays(today, -1);
  let n = 0;
  while (isStudyDay(s, k)) {
    n++;
    k = addDays(k, -1);
  }
  return n;
}

export function longestStreak(s: RoadmapState): number {
  const ks = Object.keys(s.activity).filter((k) => isStudyDay(s, k)).sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const k of ks) {
    run = prev && addDays(prev, 1) === k ? run + 1 : 1;
    best = Math.max(best, run);
    prev = k;
  }
  return best;
}

export const studyDayCount = (s: RoadmapState) => Object.keys(s.activity).filter((k) => isStudyDay(s, k)).length;
export const currentTopic = (s: RoadmapState): Topic | null => TOPICS.find((t) => statusOf(s, t.id) !== "completed") ?? null;

export function levelFor(s: RoadmapState, k: string): number {
  if (!isStudyDay(s, k)) return 0;
  const m = minutesOn(s, k);
  return m >= 120 ? 4 : m >= 60 ? 3 : m >= 30 ? 2 : 1;
}

export function heatRange(today: string): { start: string; today: string } {
  const dow = (parseKey(today).getDay() + 6) % 7; // Monday = 0
  return { start: addDays(today, -dow - (HEAT_WEEKS - 1) * 7), today };
}

export function describeDay(s: RoadmapState, k: string): string {
  const d = s.activity[k];
  const v = s.visits[k] ?? 0;
  const parts: string[] = [];
  if (isStudyDay(s, k) && d) {
    parts.push("study day");
    if (d.logs.length) parts.push(`${minutesOn(s, k)} minutes logged`);
    if (d.tasks.length) parts.push(`${d.tasks.length} ${d.tasks.length === 1 ? "task" : "tasks"} completed`);
  } else if (v) parts.push("visited, no study");
  else parts.push("no activity");
  return parts.join(", ");
}

/** Topics matching the search query and status filter (original semantics). */
export function matchTopic(s: RoadmapState, t: Topic, query: string, filter: Filter): boolean {
  const q = query.trim().toLowerCase();
  const okStatus = filter === "all" || statusOf(s, t.id) === filter;
  const okText = !q || t.searchText.includes(q) || (s.notes[t.id] ?? "").toLowerCase().includes(q);
  return okStatus && okText;
}

/** Today's goals: tasks ticked today first, then the next 3 open tasks in learning order. */
export function todayGoals(s: RoadmapState, today: string): ChecklistItem[] {
  const goals: ChecklistItem[] = [];
  for (const id of s.activity[today]?.tasks ?? []) {
    const it = ITEM_BY_ID.get(id);
    if (it && isDone(s, id)) goals.push(it);
  }
  const open: ChecklistItem[] = [];
  outer: for (const t of TOPICS) {
    if (statusOf(s, t.id) === "completed") continue;
    for (const it of t.items) {
      if (!isDone(s, it.id)) open.push(it);
      if (open.length >= 3) break outer;
    }
  }
  return [...goals, ...open];
}

/* ---------- Mutations (pure; return new state plus user-facing notices) ---------- */
export interface Change {
  state: RoadmapState;
  notices: string[];
}

const clone = (s: RoadmapState): RoadmapState => structuredClone(s);

function pruneDay(s: RoadmapState, k: string) {
  const a = s.activity[k];
  if (a && !a.logs.length && !a.tasks.length) delete s.activity[k];
}

export function setTask(prev: RoadmapState, itemId: string, checked: boolean, now: Date = new Date()): Change {
  const item = ITEM_BY_ID.get(itemId);
  if (!item) return { state: prev, notices: [] };
  const s = clone(prev);
  const k = keyOf(now);
  const wasStudy = isStudyDay(s, k);
  const notices: string[] = [];
  if (checked) {
    if (!s.tasks[itemId]) s.tasks[itemId] = now.toISOString();
    const d = (s.activity[k] ??= { logs: [], tasks: [] });
    if (!d.tasks.includes(itemId)) d.tasks.push(itemId);
    if (item.topicId && statusOf(s, item.topicId) === "not-started") {
      s.topics[item.topicId] = "in-progress";
      notices.push(`Week ${TOPIC_BY_ID.get(item.topicId)!.week} is now in progress.`);
    }
    if (!wasStudy) notices.push("Task done. Today counts as a study day.");
  } else {
    delete s.tasks[itemId];
    const d = s.activity[k];
    if (d) {
      d.tasks = d.tasks.filter((id) => id !== itemId);
      pruneDay(s, k);
    }
  }
  return { state: s, notices };
}

export function setStatus(prev: RoadmapState, topicId: string, status: Status): RoadmapState {
  if (!TOPIC_BY_ID.has(topicId) || !STATUSES.includes(status)) return prev;
  const s = clone(prev);
  if (status === "not-started") delete s.topics[topicId];
  else s.topics[topicId] = status;
  return s;
}

export function completeWeek(prev: RoadmapState, topicId: string): Change {
  const t = TOPIC_BY_ID.get(topicId);
  if (!t) return { state: prev, notices: [] };
  const s = setStatus(prev, topicId, "completed");
  const next = currentTopic(s);
  return {
    state: s,
    notices: [next ? `Week ${t.week} completed. Up next: week ${next.week}, ${next.title}.` : `Week ${t.week} completed. That's all 26 weeks.`],
  };
}

export function addLog(prev: RoadmapState, entry: Omit<LogEntry, "id" | "at">, now: Date = new Date()): Change {
  const s = clone(prev);
  const k = keyOf(now);
  const wasStudy = isStudyDay(s, k);
  (s.activity[k] ??= { logs: [], tasks: [] }).logs.push({ id: uid(), at: now.toISOString(), ...entry });
  return {
    state: s,
    notices: [wasStudy ? `Logged ${entry.minutes} min.` : `Logged ${entry.minutes} min. Today counts as a study day.`],
  };
}

export function removeLog(prev: RoadmapState, k: string, id: string): Change {
  if (!prev.activity[k]) return { state: prev, notices: [] };
  const s = clone(prev);
  s.activity[k]!.logs = s.activity[k]!.logs.filter((l) => l.id !== id);
  pruneDay(s, k);
  return { state: s, notices: ["Log entry removed."] };
}

export function recordVisit(prev: RoadmapState, now: Date = new Date()): RoadmapState {
  const k = keyOf(now);
  return { ...prev, visits: { ...prev.visits, [k]: (prev.visits[k] ?? 0) + 1 } };
}

export function setNote(prev: RoadmapState, topicId: string, text: string): RoadmapState {
  if (!TOPIC_BY_ID.has(topicId)) return prev;
  const notes = { ...prev.notes };
  const v = text.slice(0, MAX_NOTE);
  if (v) notes[topicId] = v;
  else delete notes[topicId];
  return { ...prev, notes };
}

export function setPrefs(prev: RoadmapState, patch: Partial<RoadmapState["prefs"]>): RoadmapState {
  return { ...prev, prefs: { ...prev.prefs, ...patch, open: { ...prev.prefs.open, ...(patch.open ?? {}) } } };
}

/** Validates a minutes value from the log form; null means valid. */
export function minutesError(value: string): string | null {
  const n = Number(value);
  if (!value || !Number.isFinite(n) || n < 1 || n > 600 || !Number.isInteger(n)) return "Enter whole minutes between 1 and 600.";
  return null;
}
