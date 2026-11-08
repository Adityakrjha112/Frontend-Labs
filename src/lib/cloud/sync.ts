"use client";

/**
 * Firebase Authentication + Realtime Database sync.
 *
 * Signed out: both stores use localStorage (unchanged behaviour).
 * Signed in:  local data is merged into users/{uid}/… (never overwritten),
 *             local copies are cleared once the merge is safely written, and
 *             both stores read and write the database with live updates.
 *
 * Loaded lazily from AppShell, and only when Firebase is configured.
 */
import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  type Auth,
} from "firebase/auth";
import { connectDatabaseEmulator, get, getDatabase, onValue, ref, set, update, type Database, type Unsubscribe } from "firebase/database";
import { KNOWN_IDS } from "../bank";
import { practiceBackend } from "../store";
import { STORAGE_KEY as PRACTICE_KEY, type PersistedState } from "../storage";
import { roadmapBackend } from "@/roadmap/store";
import { STORAGE_KEY as ROADMAP_KEY, type RoadmapState } from "@/roadmap/state";
import { emulators, firebaseConfig, userPath } from "./config";
import { setAccountStatus } from "./account";
import { migrateLocalToCloud, type LocalSnapshot, type MigrationAdapter } from "./migrate";

let app: FirebaseApp;
let auth: Auth;
let db: Database;
let started = false;
let detach: Unsubscribe[] = [];

/** Fails instead of hanging when the database is missing or unreachable. */
const CLOUD_TIMEOUT_MS = 15_000;
function withTimeout<T>(p: Promise<T>, what: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(
      () => reject(new Error(`${what} timed out. Check that the Realtime Database exists and NEXT_PUBLIC_FIREBASE_DATABASE_URL is correct.`)),
      CLOUD_TIMEOUT_MS,
    );
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

/** RTDB rejects `undefined`; JSON round-trip drops it (and keeps nulls as deletes). */
const toDb = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function localStore(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function adapterFor(uid: string): MigrationAdapter {
  const KEYS = { practice: PRACTICE_KEY, roadmap: ROADMAP_KEY } as const;
  return {
    readLocal: () => {
      const ls = localStore();
      return { practice: ls?.getItem(PRACTICE_KEY) ?? null, roadmap: ls?.getItem(ROADMAP_KEY) ?? null };
    },
    clearLocal: (keys, expected) => {
      const ls = localStore();
      if (!ls) return true;
      const now: LocalSnapshot = { practice: ls.getItem(PRACTICE_KEY), roadmap: ls.getItem(ROADMAP_KEY) };
      if (now.practice !== expected.practice || now.roadmap !== expected.roadmap) return false;
      for (const k of keys) ls.removeItem(KEYS[k]);
      return true;
    },
    readCloud: async () => {
      const [p, r, m] = await withTimeout(
        Promise.all([
          get(ref(db, userPath(uid, "practice"))),
          get(ref(db, userPath(uid, "roadmap"))),
          get(ref(db, `users/${uid}/meta/merged`)),
        ]),
        "Reading your account data",
      );
      return { practice: p.val(), roadmap: r.val(), merged: m.val() };
    },
    // One multi-path update: the merged data and its fingerprint are saved together or not at all.
    writeCloud: async (data, fp) => {
      await withTimeout(
        update(ref(db, `users/${uid}`), {
          practice: toDb(data.practice),
          roadmap: toDb(data.roadmap),
          [`meta/merged/${fp}`]: new Date().toISOString(),
        }),
        "Saving your merged progress",
      );
    },
  };
}

function reportWriteError(e: unknown) {
  setAccountStatus({ phase: "error", error: `Your latest change could not be saved to your account (${(e as Error).message}). It will be retried when you're back online.` });
}

async function connect(uid: string) {
  setAccountStatus({ phase: "migrating", error: null });
  const result = await migrateLocalToCloud(adapterFor(uid), KNOWN_IDS);

  const practiceRef = ref(db, userPath(uid, "practice"));
  const roadmapRef = ref(db, userPath(uid, "roadmap"));
  practiceBackend.useCloud(result.practice, (s: PersistedState) => {
    set(practiceRef, toDb(s)).catch(reportWriteError);
  });
  roadmapBackend.useCloud(result.roadmap, (s: RoadmapState) => {
    set(roadmapRef, toDb(s)).catch(reportWriteError);
  });
  detach = [
    onValue(practiceRef, (snap) => practiceBackend.receiveRemote(snap.val())),
    onValue(roadmapRef, (snap) => roadmapBackend.receiveRemote(snap.val())),
  ];

  const { questions, tasks, notes } = result.fromDevice;
  const parts = [
    questions ? `${questions} answered question${questions === 1 ? "" : "s"}` : "",
    tasks ? `${tasks} roadmap task${tasks === 1 ? "" : "s"}` : "",
    notes ? `${notes} note${notes === 1 ? "" : "s"}` : "",
  ].filter(Boolean);
  setAccountStatus({
    phase: "synced",
    notice: result.migrated
      ? `Progress from this browser${parts.length ? ` (${parts.join(", ")})` : ""} was merged into your account.`
      : null,
  });
}

/** Starts listening for auth changes. Safe to call more than once. */
export function startSync() {
  if (started) return;
  started = true;
  app = getApps()[0] ?? initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getDatabase(app);
  if (emulators.auth) connectAuthEmulator(auth, `http://${emulators.auth}`, { disableWarnings: true });
  if (emulators.database) {
    const [host, port] = emulators.database.split(":");
    connectDatabaseEmulator(db, host!, Number(port));
  }

  onAuthStateChanged(auth, async (user) => {
    detach.forEach((off) => off());
    detach = [];
    if (!user) {
      practiceBackend.useLocal();
      roadmapBackend.useLocal();
      setAccountStatus({ phase: "signed-out", user: null });
      return;
    }
    setAccountStatus({ user: { uid: user.uid, email: user.email, name: user.displayName } });
    try {
      await connect(user.uid);
    } catch (e) {
      // Stay on local storage so nothing is lost; the user can retry by signing in again.
      practiceBackend.useLocal();
      roadmapBackend.useLocal();
      setAccountStatus({ phase: "error", error: `Couldn't sync with your account: ${(e as Error).message} Your progress is still saved in this browser.` });
    }
  });
}

/* ------------------------------------------------------------------ */
/* Sign-in actions (called from the UI)                                */
/* ------------------------------------------------------------------ */

const MESSAGES: Record<string, string> = {
  "auth/invalid-credential": "That email and password don't match an account.",
  "auth/invalid-email": "Enter a valid email address.",
  // Same message for both, so the form doesn't reveal which emails have accounts.
  "auth/user-not-found": "That email and password don't match an account.",
  "auth/wrong-password": "That email and password don't match an account.",
  "auth/email-already-in-use": "An account already uses that email. Sign in instead.",
  "auth/weak-password": "Use a password with at least 6 characters.",
  "auth/too-many-requests": "Too many attempts. Wait a few minutes and try again.",
  "auth/popup-closed-by-user": "The Google window was closed before signing in.",
  "auth/popup-blocked": "Your browser blocked the Google window. Allow pop-ups for this site and try again.",
  "auth/network-request-failed": "Couldn't reach the sign-in service. Check your connection.",
  "auth/operation-not-allowed": "This sign-in method isn't enabled yet. Enable it in Firebase console → Authentication → Sign-in method.",
  "auth/password-login-disabled": "Email and password sign-in isn't enabled yet. Enable it in Firebase console → Authentication → Sign-in method.",
  "auth/unauthorized-domain": "This website's domain isn't authorised for sign-in. Add it in Firebase console → Authentication → Settings → Authorized domains.",
};

export function authErrorMessage(e: unknown): string {
  const code = (e as { code?: string }).code ?? "";
  return MESSAGES[code] ?? "Sign-in failed. Try again.";
}

export async function signInWithGoogle() {
  startSync();
  await signInWithPopup(auth, new GoogleAuthProvider());
}

export async function signInWithEmail(email: string, password: string) {
  startSync();
  await signInWithEmailAndPassword(auth, email, password);
}

export async function createAccount(email: string, password: string) {
  startSync();
  await createUserWithEmailAndPassword(auth, email, password);
}

export async function resetPassword(email: string) {
  startSync();
  await sendPasswordResetEmail(auth, email);
}

export async function signOut() {
  startSync();
  await fbSignOut(auth);
}
