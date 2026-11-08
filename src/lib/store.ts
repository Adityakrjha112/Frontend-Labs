"use client";

import { useSyncExternalStore } from "react";
import { KNOWN_IDS, QUESTION_BY_ID } from "./bank";
import {
  defaultState,
  loadState,
  recordOutcome,
  sanitizeState,
  resetState,
  saveState,
  STORAGE_KEY,
  toggleBookmark as toggleBookmarkIn,
  toggleReview as toggleReviewIn,
  type LoadStatus,
  type PersistedState,
  type StorageLike,
} from "./storage";
import { outcomeOf, type Session, type SessionAnswer, type SelfVerdict } from "./session";

const SERVER_STATE = defaultState();
let state: PersistedState = SERVER_STATE;
let status: LoadStatus = "empty";
let loaded = false;
const listeners = new Set<() => void>();

/** When set, the user is signed in and changes are written to their cloud data instead of localStorage. */
let cloudWrite: ((s: PersistedState) => void) | null = null;

function storage(): StorageLike | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

function ensureLoaded() {
  if (loaded || typeof window === "undefined") return;
  const result = loadState(storage(), KNOWN_IDS);
  state = result.state;
  status = result.status;
  loaded = true;
  window.addEventListener("storage", (e) => {
    if (cloudWrite) return; // signed in: the database keeps tabs in sync
    if (e.key !== STORAGE_KEY && e.key !== null) return;
    state = loadState(storage(), KNOWN_IDS).state;
    emit();
  });
}

function emit() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): PersistedState {
  ensureLoaded();
  return state;
}

function update(fn: (s: PersistedState) => PersistedState) {
  ensureLoaded();
  state = fn(state);
  persist();
  emit();
}

function persist() {
  if (cloudWrite) cloudWrite(state);
  else saveState(storage(), state);
}

/**
 * Switches where practice data lives. Used by the sync layer on sign-in and
 * sign-out; components keep using the same hooks and actions.
 */
export const practiceBackend = {
  useCloud(initial: PersistedState, write: (s: PersistedState) => void) {
    ensureLoaded();
    cloudWrite = write;
    state = initial;
    status = "ok";
    emit();
  },
  /** Applies data pushed from the database (another tab or device). */
  receiveRemote(raw: unknown) {
    state = raw ? sanitizeState(raw, KNOWN_IDS) : defaultState();
    emit();
  },
  useLocal() {
    cloudWrite = null;
    const r = loadState(storage(), KNOWN_IDS);
    state = r.state;
    status = r.status;
    loaded = true;
    emit();
  },
  isCloud: () => cloudWrite !== null,
};

const noopSubscribe = () => () => {};

/** True once rendering on the client with persisted data available. */
export function useHydrated(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

export function useLabState(): PersistedState {
  return useSyncExternalStore(subscribe, getSnapshot, () => SERVER_STATE);
}

export function getLoadStatus(): LoadStatus {
  ensureLoaded();
  return status;
}

function patchActive(fn: (s: Session) => Session) {
  update((s) => (s.activeSession ? { ...s, activeSession: fn(s.activeSession) } : s));
}

export const actions = {
  startSession(session: Session) {
    update((s) => ({ ...s, activeSession: session }));
  },
  goTo(index: number) {
    patchActive((s) => ({ ...s, currentIndex: Math.max(0, Math.min(index, s.questionIds.length - 1)) }));
  },
  /**
   * Stores an answer for the active session. Progress is recorded once per
   * question per session, when the outcome first becomes known.
   */
  answer(questionId: string, answer: SessionAnswer) {
    update((s) => {
      const session = s.activeSession;
      if (!session || !session.questionIds.includes(questionId) || !QUESTION_BY_ID.has(questionId)) return s;
      const before = outcomeOf(session.answers[questionId]);
      const after = outcomeOf(answer);
      let next: PersistedState = {
        ...s,
        activeSession: { ...session, answers: { ...session.answers, [questionId]: answer } },
      };
      if (before === null && after !== null) next = recordOutcome(next, questionId, after, new Date());
      return next;
    });
  },
  setVerdict(questionId: string, verdict: SelfVerdict) {
    const current = state.activeSession?.answers[questionId];
    if (current?.kind !== "self" || current.verdict !== null) return;
    actions.answer(questionId, { ...current, verdict });
  },
  setSessionTimer(enabled: boolean) {
    patchActive((s) => ({ ...s, timerEnabled: enabled }));
  },
  finishSession() {
    update((s) =>
      s.activeSession
        ? { ...s, lastSession: { ...s.activeSession, completedAt: new Date().toISOString() }, activeSession: null }
        : s,
    );
  },
  abandonSession() {
    update((s) => ({ ...s, activeSession: null }));
  },
  toggleBookmark(id: string) {
    update((s) => toggleBookmarkIn(s, id));
  },
  toggleReview(id: string) {
    update((s) => toggleReviewIn(s, id));
  },
  setTimerPreference(timer: boolean) {
    update((s) => ({ ...s, preferences: { ...s.preferences, timer } }));
  },
  resetAll() {
    ensureLoaded();
    if (cloudWrite) {
      state = defaultState();
      cloudWrite(state);
    } else {
      state = resetState(storage());
    }
    status = "empty";
    emit();
  },
};
