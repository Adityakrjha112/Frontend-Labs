/**
 * Versioned, defensive persistence for user progress.
 *
 * Everything read from storage is treated as untrusted: unknown versions,
 * invalid JSON and malformed entries are recovered from without crashing.
 */
import { MCQ_OPTION_IDS, type McqOptionId } from "./types";
import { isMiss, type Outcome, type Session, type SessionAnswer, type SessionOrigin } from "./session";

export const STORAGE_KEY = "frontend-lab:state";
export const BACKUP_KEY = "frontend-lab:state:corrupt-backup";
export const STATE_VERSION = 1;

export interface QuestionRecord {
  attempts: number;
  /** Correct MCQ answers or "got it" self-reviews. */
  successes: number;
  lastOutcome: Outcome;
  lastAttemptAt: string;
}

export interface PersistedState {
  version: typeof STATE_VERSION;
  progress: Record<string, QuestionRecord>;
  bookmarks: string[];
  reviewQueue: string[];
  /** Local calendar days (YYYY-MM-DD) with at least one answer. */
  activityDays: string[];
  activeSession: Session | null;
  lastSession: Session | null;
  preferences: { timer: boolean };
}

export function defaultState(): PersistedState {
  return {
    version: STATE_VERSION,
    progress: {},
    bookmarks: [],
    reviewQueue: [],
    activityDays: [],
    activeSession: null,
    lastSession: null,
    preferences: { timer: false },
  };
}

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/* ------------------------------------------------------------------ */
/* Sanitisers                                                          */
/* ------------------------------------------------------------------ */

const OUTCOMES: readonly Outcome[] = ["correct", "incorrect", "got-it", "missed"];
const ORIGINS: readonly SessionOrigin[] = ["quick", "custom", "review", "bookmarks", "retry", "single", "roadmap"];
const DAY = /^\d{4}-\d{2}-\d{2}$/;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isCount = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0;
const isDateString = (v: unknown): v is string => typeof v === "string" && !Number.isNaN(Date.parse(v));

function idList(v: unknown, known?: ReadonlySet<string>): string[] {
  if (!Array.isArray(v)) return [];
  const out = v.filter((x): x is string => typeof x === "string" && (!known || known.has(x)));
  return [...new Set(out)];
}

function sanitizeRecord(v: unknown): QuestionRecord | null {
  if (!isObj(v)) return null;
  const { attempts, successes, lastOutcome, lastAttemptAt } = v;
  if (!isCount(attempts) || !isCount(successes) || successes > attempts || attempts === 0) return null;
  if (!OUTCOMES.includes(lastOutcome as Outcome) || !isDateString(lastAttemptAt)) return null;
  return { attempts, successes, lastOutcome: lastOutcome as Outcome, lastAttemptAt };
}

function sanitizeAnswer(v: unknown): SessionAnswer | null {
  if (!isObj(v)) return null;
  if (v.kind === "skipped") return { kind: "skipped" };
  const hintsUsed = isCount(v.hintsUsed) ? Math.min(v.hintsUsed, 2) : 0;
  const seconds = isCount(v.seconds) ? v.seconds : 0;
  if (v.kind === "mcq") {
    if (!MCQ_OPTION_IDS.includes(v.selected as McqOptionId) || typeof v.correct !== "boolean") return null;
    return { kind: "mcq", selected: v.selected as McqOptionId, correct: v.correct, hintsUsed, seconds };
  }
  if (v.kind === "self") {
    if (typeof v.draft !== "string") return null;
    const verdict = v.verdict === "got-it" || v.verdict === "missed" ? v.verdict : null;
    return { kind: "self", draft: v.draft.slice(0, 20000), verdict, hintsUsed, seconds };
  }
  return null;
}

export function sanitizeSession(v: unknown, known?: ReadonlySet<string>): Session | null {
  if (!isObj(v)) return null;
  if (typeof v.id !== "string" || typeof v.title !== "string") return null;
  if (!ORIGINS.includes(v.origin as SessionOrigin) || !isDateString(v.createdAt)) return null;
  const questionIds = idList(v.questionIds, known);
  if (questionIds.length === 0) return null;
  const answers: Record<string, SessionAnswer> = {};
  if (isObj(v.answers)) {
    for (const id of questionIds) {
      const a = sanitizeAnswer(v.answers[id]);
      if (a) answers[id] = a;
    }
  }
  const idx = isCount(v.currentIndex) ? Math.min(v.currentIndex, questionIds.length - 1) : 0;
  return {
    id: v.id,
    title: v.title.slice(0, 200),
    origin: v.origin as SessionOrigin,
    questionIds,
    createdAt: v.createdAt,
    currentIndex: idx,
    answers,
    timerEnabled: v.timerEnabled === true,
    completedAt: isDateString(v.completedAt) ? v.completedAt : null,
  };
}

/**
 * Validates an arbitrary parsed value into a PersistedState, dropping
 * anything malformed. `known` restricts question IDs to the current bank.
 */
export function sanitizeState(raw: unknown, known?: ReadonlySet<string>): PersistedState {
  const base = defaultState();
  if (!isObj(raw)) return base;
  const progress: Record<string, QuestionRecord> = {};
  if (isObj(raw.progress)) {
    for (const [id, rec] of Object.entries(raw.progress)) {
      if (known && !known.has(id)) continue;
      const clean = sanitizeRecord(rec);
      if (clean) progress[id] = clean;
    }
  }
  const prefs = isObj(raw.preferences) ? raw.preferences : {};
  return {
    version: STATE_VERSION,
    progress,
    bookmarks: idList(raw.bookmarks, known),
    reviewQueue: idList(raw.reviewQueue, known),
    activityDays: Array.isArray(raw.activityDays)
      ? [...new Set(raw.activityDays.filter((d): d is string => typeof d === "string" && DAY.test(d)))].sort()
      : [],
    activeSession: sanitizeSession(raw.activeSession, known),
    lastSession: sanitizeSession(raw.lastSession, known),
    preferences: { timer: prefs.timer === true },
  };
}

/**
 * Upgrades older payloads. Add a step here when STATE_VERSION changes;
 * each step receives version N and returns version N + 1.
 */
const MIGRATIONS: Record<number, (s: Record<string, unknown>) => Record<string, unknown>> = {};

export type LoadStatus = "empty" | "ok" | "recovered";

export interface LoadResult {
  state: PersistedState;
  status: LoadStatus;
}

export function loadState(storage: StorageLike | null, known?: ReadonlySet<string>): LoadResult {
  if (!storage) return { state: defaultState(), status: "empty" };
  let text: string | null;
  try {
    text = storage.getItem(STORAGE_KEY);
  } catch {
    return { state: defaultState(), status: "empty" };
  }
  if (text === null) return { state: defaultState(), status: "empty" };

  const recover = (): LoadResult => {
    try {
      storage.setItem(BACKUP_KEY, text!);
    } catch {
      /* best effort */
    }
    return { state: defaultState(), status: "recovered" };
  };

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return recover();
  }
  if (!isObj(parsed) || typeof parsed.version !== "number") return recover();

  let payload = parsed;
  let version = parsed.version;
  if (version > STATE_VERSION) return recover(); // written by a newer app; do not guess.
  while (version < STATE_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) return recover();
    payload = step(payload);
    version++;
  }
  return { state: sanitizeState(payload, known), status: "ok" };
}

export function saveState(storage: StorageLike | null, state: PersistedState): boolean {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false; // quota exceeded or storage blocked
  }
}

export function resetState(storage: StorageLike | null): PersistedState {
  if (storage) {
    try {
      storage.removeItem(STORAGE_KEY);
      storage.removeItem(BACKUP_KEY);
    } catch {
      /* ignore */
    }
  }
  return defaultState();
}

/* ------------------------------------------------------------------ */
/* Dates & streaks                                                     */
/* ------------------------------------------------------------------ */

/** Local calendar day key, e.g. 2026-11-08. */
export function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function keyToUtc(key: string): number {
  const [y, m, d] = key.split("-").map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
}

const DAY_MS = 86_400_000;

export interface StreakInfo {
  current: number;
  longest: number;
  activeToday: boolean;
}

/**
 * Consecutive practice days. A streak stays alive through today if the last
 * activity was yesterday (the user can still practise today).
 */
export function computeStreak(days: readonly string[], today: Date): StreakInfo {
  const set = [...new Set(days.filter((d) => DAY.test(d)))].map(keyToUtc).sort((a, b) => a - b);
  let longest = 0;
  let run = 0;
  for (let i = 0; i < set.length; i++) {
    run = i > 0 && set[i]! - set[i - 1]! === DAY_MS ? run + 1 : 1;
    longest = Math.max(longest, run);
  }
  const todayUtc = keyToUtc(dayKey(today));
  const has = new Set(set);
  const activeToday = has.has(todayUtc);
  let cursor = activeToday ? todayUtc : todayUtc - DAY_MS;
  let current = 0;
  while (has.has(cursor)) {
    current++;
    cursor -= DAY_MS;
  }
  return { current, longest, activeToday };
}

/* ------------------------------------------------------------------ */
/* State transitions                                                   */
/* ------------------------------------------------------------------ */

export function recordOutcome(state: PersistedState, questionId: string, outcome: Outcome, now: Date): PersistedState {
  const prev = state.progress[questionId];
  const success = outcome === "correct" || outcome === "got-it";
  const record: QuestionRecord = {
    attempts: (prev?.attempts ?? 0) + 1,
    successes: (prev?.successes ?? 0) + (success ? 1 : 0),
    lastOutcome: outcome,
    lastAttemptAt: now.toISOString(),
  };
  const day = dayKey(now);
  const inQueue = state.reviewQueue.includes(questionId);
  let reviewQueue = state.reviewQueue;
  if (isMiss(outcome) && !inQueue) reviewQueue = [...reviewQueue, questionId];
  if (success && inQueue) reviewQueue = reviewQueue.filter((id) => id !== questionId);
  return {
    ...state,
    progress: { ...state.progress, [questionId]: record },
    reviewQueue,
    activityDays: state.activityDays.includes(day) ? state.activityDays : [...state.activityDays, day].sort(),
  };
}

function toggle(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

export const toggleBookmark = (s: PersistedState, id: string): PersistedState => ({
  ...s,
  bookmarks: toggle(s.bookmarks, id),
});

export const toggleReview = (s: PersistedState, id: string): PersistedState => ({
  ...s,
  reviewQueue: toggle(s.reviewQueue, id),
});
