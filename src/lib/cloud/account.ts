"use client";

/**
 * Account and sync status, readable by any component without loading the
 * Firebase SDK. The sync layer (sync.ts) writes to it.
 */
import { useSyncExternalStore } from "react";
import { isFirebaseConfigured } from "./config";

export interface AccountUser {
  uid: string;
  email: string | null;
  name: string | null;
}

export type SyncPhase = "off" | "checking" | "signed-out" | "migrating" | "synced" | "error";

export interface AccountStatus {
  configured: boolean;
  phase: SyncPhase;
  user: AccountUser | null;
  /** Plain-language message about the last sync event (shown once). */
  notice: string | null;
  error: string | null;
}

let status: AccountStatus = {
  configured: isFirebaseConfigured,
  phase: isFirebaseConfigured ? "checking" : "off",
  user: null,
  notice: null,
  error: null,
};
const SERVER: AccountStatus = status;
const listeners = new Set<() => void>();

export function setAccountStatus(patch: Partial<AccountStatus>) {
  status = { ...status, ...patch };
  for (const l of listeners) l();
}

export function useAccount(): AccountStatus {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => status,
    () => SERVER,
  );
}
