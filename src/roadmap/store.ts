"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  addLog as addLogIn,
  completeWeek as completeWeekIn,
  defaultState,
  keyOf,
  loadState,
  recordVisit,
  removeLog as removeLogIn,
  saveState,
  setNote as setNoteIn,
  setPrefs,
  setStatus as setStatusIn,
  setTask as setTaskIn,
  STATUS_LABEL,
  STORAGE_KEY,
  BACKUP_KEY,
  sanitize,
  type Banner,
  type Change,
  type LogEntry,
  type RoadmapState,
  type Status,
  type StorageLike,
  type Theme,
  type Filter,
} from "./state";
import { TOPIC_BY_ID } from "./model";

const SERVER_STATE = defaultState();
let state: RoadmapState = SERVER_STATE;
let loaded = false;
let storageOK = true;
let banner: Banner | null = null;
let toasts: { id: number; text: string }[] = [];
let toastSeq = 0;
const listeners = new Set<() => void>();

/** When set, the user is signed in and changes go to their cloud data. */
let cloudWrite: ((s: RoadmapState) => void) | null = null;

function storage(): StorageLike | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

function emit() {
  for (const l of listeners) l();
}

function ensureLoaded() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  const r = loadState(storage());
  state = r.state;
  storageOK = r.storageOK;
  banner = r.banner;
  window.addEventListener("storage", (e) => {
    if (cloudWrite) return; // signed in: the database keeps tabs in sync
    if (e.key !== STORAGE_KEY) return;
    if (e.newValue === null) state = defaultState();
    else {
      try {
        state = sanitize(JSON.parse(e.newValue)).state;
      } catch {
        return;
      }
    }
    emit();
  });
}

function persist(): boolean {
  if (cloudWrite) {
    cloudWrite(state);
    return true;
  }
  if (!storageOK) return false;
  const ok = saveState(storage(), state);
  if (!ok) {
    banner = {
      text: "Your latest change could not be saved because browser storage is full or blocked. Export your data from the Data menu to keep a copy.",
      error: true,
    };
  }
  return ok;
}

function commit(next: RoadmapState, notices: string[] = []) {
  ensureLoaded();
  state = next;
  persist();
  notices.forEach(toast);
  emit();
}

const apply = (c: Change) => commit(c.state, c.notices);

function toast(text: string) {
  const id = ++toastSeq;
  toasts = [...toasts, { id, text }];
  emit();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    emit();
  }, 3800);
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useRoadmapState(): RoadmapState {
  return useSyncExternalStore(
    subscribe,
    () => {
      ensureLoaded();
      return state;
    },
    () => SERVER_STATE,
  );
}

const EMPTY: never[] = [];
export function useToasts() {
  return useSyncExternalStore(subscribe, () => toasts, () => EMPTY);
}

export function useBanner(): Banner | null {
  return useSyncExternalStore(
    subscribe,
    () => {
      ensureLoaded();
      return banner;
    },
    () => null,
  );
}

/** Today's local date key; updates when the date rolls over while open. */
export function useToday(): string {
  const [today, setToday] = useState(() => keyOf(new Date()));
  useEffect(() => {
    const t = window.setInterval(() => setToday(keyOf(new Date())), 30_000);
    return () => window.clearInterval(t);
  }, []);
  return today;
}

let visited = false;

/** Switches where roadmap data lives (see practiceBackend in lib/store.ts). */
export const roadmapBackend = {
  useCloud(initial: RoadmapState, write: (s: RoadmapState) => void) {
    ensureLoaded();
    cloudWrite = write;
    state = initial;
    banner = null;
    emit();
  },
  receiveRemote(raw: unknown) {
    state = raw ? sanitize(raw).state : defaultState();
    emit();
  },
  useLocal() {
    cloudWrite = null;
    const r = loadState(storage());
    state = r.state;
    storageOK = r.storageOK;
    banner = r.banner;
    loaded = true;
    emit();
  },
  isCloud: () => cloudWrite !== null,
};

export const roadmapActions = {
  /** Records one visit per app load, like the original page did on open. */
  recordVisitOnce() {
    if (visited) return;
    visited = true;
    ensureLoaded();
    commit(recordVisit(state));
  },
  setTask(itemId: string, checked: boolean) {
    ensureLoaded();
    apply(setTaskIn(state, itemId, checked));
  },
  setStatus(topicId: string, status: Status, announce = true) {
    ensureLoaded();
    const t = TOPIC_BY_ID.get(topicId);
    commit(setStatusIn(state, topicId, status), announce && t ? [`Week ${t.week}: ${STATUS_LABEL[status]}.`] : []);
  },
  startWeek(topicId: string) {
    ensureLoaded();
    const t = TOPIC_BY_ID.get(topicId);
    commit(setStatusIn(state, topicId, "in-progress"), t ? [`Week ${t.week} started.`] : []);
  },
  completeWeek(topicId: string) {
    ensureLoaded();
    apply(completeWeekIn(state, topicId));
  },
  addLog(entry: Omit<LogEntry, "id" | "at">) {
    ensureLoaded();
    apply(addLogIn(state, entry));
  },
  removeLog(day: string, id: string) {
    ensureLoaded();
    apply(removeLogIn(state, day, id));
  },
  /** Saves a note; returns whether it was persisted. */
  setNote(topicId: string, text: string): boolean {
    ensureLoaded();
    state = setNoteIn(state, topicId, text);
    const ok = persist();
    emit();
    return ok;
  },
  setFilter(filter: Filter) {
    ensureLoaded();
    commit(setPrefs(state, { filter }));
  },
  setOpen(open: Record<string, boolean>) {
    ensureLoaded();
    commit(setPrefs(state, { open }));
  },
  setTheme(theme: Theme) {
    ensureLoaded();
    commit(setPrefs(state, { theme }));
  },
  replace(next: RoadmapState, notice?: string) {
    commit(next, notice ? [notice] : []);
  },
  reset() {
    try {
      storage()?.removeItem(BACKUP_KEY);
    } catch {
      /* ignore */
    }
    commit(defaultState(), ["All data reset."]);
  },
  dismissBanner() {
    banner = null;
    emit();
  },
  toast,
  storageOK: () => {
    ensureLoaded();
    return cloudWrite !== null || storageOK;
  },
};
