"use client";

import { useEffect, useId, useRef, useState } from "react";
import { setAccountStatus, useAccount } from "@/lib/cloud/account";

const loadSync = () => import("@/lib/cloud/sync");

/** The header owns the only sign-in dialog; other places ask it to open. */
const OPEN_SIGN_IN = "frontend-lab:open-sign-in";
export const openSignIn = () => window.dispatchEvent(new Event(OPEN_SIGN_IN));

async function signOutWithNotice() {
  await (await loadSync()).signOut();
  setAccountStatus({ notice: "Signed out. Your progress is saved in your account; sign in again to see it here.", error: null });
}

type Mode = "sign-in" | "create" | "reset";

function SignInDialog({ dialogRef }: { dialogRef: React.RefObject<HTMLDialogElement | null> }) {
  const ids = useId();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const run = async (fn: () => Promise<void>, done?: string) => {
    setBusy(true);
    setError("");
    setInfo("");
    try {
      await fn();
      if (done) setInfo(done);
      else dialogRef.current?.close();
    } catch (e) {
      setError((await loadSync()).authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const title = mode === "create" ? "Create an account" : mode === "reset" ? "Reset your password" : "Sign in";

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={`${ids}-h`}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-lg border border-line bg-card p-0 text-ink shadow-xl backdrop:bg-black/50"
      onClose={() => {
        setError("");
        setInfo("");
        setPassword("");
      }}
    >
      <div className="grid gap-5 p-6">
        <div className="flex items-start justify-between gap-4">
          <h2 id={`${ids}-h`} className="text-2xl">
            {title}
          </h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => dialogRef.current?.close()}>
            Close
          </button>
        </div>
        <p className="text-sm text-ink-2">
          Signing in saves your roadmap and practice progress to your account, so it follows you across devices. Anything already saved in this browser is
          merged into your account. Nothing is overwritten.
        </p>

        {mode !== "reset" ? (
          <>
            <button type="button" className="btn" disabled={busy} onClick={() => run(async () => (await loadSync()).signInWithGoogle())}>
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
                <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
                <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
              </svg>
              Continue with Google
            </button>
            <p className="flex items-center gap-3 text-xs text-ink-3" aria-hidden="true">
              <span className="h-px flex-1 bg-line" />
              or use email
              <span className="h-px flex-1 bg-line" />
            </p>
          </>
        ) : null}

        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (mode === "reset") {
              void run(async () => (await loadSync()).resetPassword(email), `If an account uses ${email}, a reset link is on its way.`);
            } else if (mode === "create") {
              void run(async () => (await loadSync()).createAccount(email, password));
            } else {
              void run(async () => (await loadSync()).signInWithEmail(email, password));
            }
          }}
        >
          <div className="grid gap-1">
            <label htmlFor={`${ids}-email`} className="text-sm font-semibold">
              Email
            </label>
            <input
              id={`${ids}-email`}
              type="email"
              autoComplete="email"
              required
              className="field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          {mode !== "reset" ? (
            <div className="grid gap-1">
              <label htmlFor={`${ids}-pw`} className="text-sm font-semibold">
                Password
              </label>
              <input
                id={`${ids}-pw`}
                type="password"
                autoComplete={mode === "create" ? "new-password" : "current-password"}
                required
                minLength={6}
                aria-describedby={mode === "create" ? `${ids}-pw-hint` : undefined}
                className="field"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {mode === "create" ? (
                <p id={`${ids}-pw-hint`} className="text-xs text-ink-3">
                  At least 6 characters.
                </p>
              ) : null}
            </div>
          ) : null}
          <p role="alert" className="text-sm text-bad empty:hidden">
            {error}
          </p>
          <p role="status" className="text-sm text-good empty:hidden">
            {info}
          </p>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Working…" : mode === "create" ? "Create account" : mode === "reset" ? "Send reset link" : "Sign in"}
          </button>
        </form>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {mode !== "sign-in" ? (
            <button type="button" className="min-h-11 text-accent underline" onClick={() => setMode("sign-in")}>
              Sign in instead
            </button>
          ) : (
            <button type="button" className="min-h-11 text-accent underline" onClick={() => setMode("create")}>
              Create an account
            </button>
          )}
          {mode !== "reset" ? (
            <button type="button" className="min-h-11 text-accent underline" onClick={() => setMode("reset")}>
              Forgot your password?
            </button>
          ) : null}
        </div>
      </div>
    </dialog>
  );
}

/** Header account control: sign-in button, or the signed-in account menu. */
export function AccountMenu() {
  const account = useAccount();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const menuRef = useRef<HTMLDetailsElement>(null);

  // Close the dialog once sign-in succeeds.
  useEffect(() => {
    if (account.user) dialogRef.current?.close();
  }, [account.user]);

  useEffect(() => {
    const open = () => dialogRef.current?.showModal();
    window.addEventListener(OPEN_SIGN_IN, open);
    return () => window.removeEventListener(OPEN_SIGN_IN, open);
  }, []);

  if (!account.configured) return null;

  // The dialog stays mounted while signed in so other components can always open it.
  const dialog = <SignInDialog dialogRef={dialogRef} />;

  if (!account.user) {
    return (
      <>
        <button
          type="button"
          className="btn btn-sm"
          disabled={account.phase === "checking"}
          aria-busy={account.phase === "checking" || undefined}
          onClick={() => dialogRef.current?.showModal()}
        >
          {account.phase === "checking" ? "Checking sign-in…" : "Sign in"}
        </button>
        {dialog}
      </>
    );
  }

  const label = account.user.name ?? account.user.email ?? "Account";
  const syncText =
    account.phase === "migrating" ? "Merging this browser's progress…" : account.phase === "error" ? "Sync problem" : "Saved to your account";

  return (
    <details ref={menuRef} className="relative">
      <summary className="btn btn-sm list-none gap-2 [&::-webkit-details-marker]:hidden">
        <span className="sr-only">Account: </span>
        <span aria-hidden="true" className="grid size-6 place-items-center rounded-full bg-[var(--bm-content)] text-xs font-bold text-ink">
          {label.slice(0, 1).toUpperCase()}
        </span>
        <span className="max-w-32 truncate max-sm:sr-only">{label}</span>
      </summary>
      <div className="absolute right-0 z-50 mt-2 grid w-72 gap-3 rounded-lg border border-line bg-card p-4 text-sm shadow-xl">
        <div>
          <p className="font-semibold">{account.user.name ?? "Signed in"}</p>
          {account.user.email ? <p className="truncate text-ink-3">{account.user.email}</p> : null}
        </div>
        <p className={account.phase === "error" ? "text-bad" : "text-ink-2"}>{syncText}</p>
        <button
          type="button"
          className="btn btn-sm"
          onClick={async () => {
            if (menuRef.current) menuRef.current.open = false;
            await signOutWithNotice();
          }}
        >
          Sign out
        </button>
      </div>
    </details>
  );
}

/** Sign-in / sign-out buttons for pages like Settings (uses the header's dialog). */
export function AccountActions() {
  const account = useAccount();
  if (!account.configured) return null;
  if (!account.user) {
    return (
      <button type="button" className="btn btn-primary" disabled={account.phase === "checking"} onClick={openSignIn}>
        Sign in or create an account
      </button>
    );
  }
  return (
    <button type="button" className="btn" onClick={() => void signOutWithNotice()}>
      Sign out
    </button>
  );
}

/** One-line banner for merge results and sync errors. */
export function SyncBanner() {
  const { notice, error } = useAccount();
  if (!notice && !error) return null;
  return (
    <div className="border-b border-line bg-card">
      <div
        role={error ? "alert" : "status"}
        className={`mx-auto flex max-w-6xl items-start justify-between gap-4 px-4 py-3 text-sm sm:px-6 ${error ? "text-bad" : "text-ink"}`}
      >
        <p>{error ?? notice}</p>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAccountStatus({ notice: null, error: null })}>
          Dismiss
        </button>
      </div>
    </div>
  );
}
