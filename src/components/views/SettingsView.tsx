"use client";

import { useRef, useState } from "react";
import { QUESTIONS } from "@/lib/bank";
import { actions, useHydrated, useLabState } from "@/lib/store";
import { useAccount } from "@/lib/cloud/account";
import { AccountActions } from "../AccountMenu";

export function SettingsView() {
  const hydrated = useHydrated();
  const state = useLabState();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [message, setMessage] = useState("");
  const answered = Object.keys(state.progress).length;
  const account = useAccount();
  const signedIn = !!account.user && account.phase !== "error";
  const where = signedIn ? "your account" : "this browser";

  return (
    <div className="flex max-w-3xl flex-col gap-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-4xl font-bold sm:text-5xl">Preferences &amp; data</h1>
      </header>

      <section aria-labelledby="prefs-h" className="card flex flex-col gap-4 p-6">
        <h2 id="prefs-h" className="text-2xl font-bold">
          Practice
        </h2>
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={state.preferences.timer}
            onChange={(e) => actions.setTimerPreference(e.target.checked)}
            className="size-4 accent-[var(--accent)]"
          />
          Show a timer on each question by default
        </label>
        <p className="text-sm text-ink-3">
          The timer is only a guide. It shows a soft target (1, 2 or 3 minutes by difficulty) and never auto-submits.
        </p>
      </section>

      <section aria-labelledby="account-h" className="card flex flex-col gap-4 p-6">
        <h2 id="account-h" className="text-2xl font-bold">
          Account and sync
        </h2>
        {!account.configured ? (
          <p className="text-ink-2">
            Sign-in isn&apos;t set up for this copy of the app, so your progress is saved in this browser only. To enable accounts, add your Firebase
            project settings as described in the README.
          </p>
        ) : signedIn ? (
          <p className="text-ink-2">
            Signed in as <strong>{account.user!.email ?? account.user!.name}</strong>. Your roadmap and practice progress is saved to your account and
            stays in sync across your devices.
          </p>
        ) : (
          <p className="text-ink-2">
            You&apos;re not signed in, so your progress is saved in this browser only. Sign in to keep it in your account across devices. Progress
            already saved here is merged into your account, never overwritten.
          </p>
        )}
        {account.configured ? (
          <div>
            <AccountActions />
          </div>
        ) : null}
      </section>

      <section aria-labelledby="data-h" className="card flex flex-col gap-4 p-6">
        <h2 id="data-h" className="text-2xl font-bold">
          Your data
        </h2>
        <p className="text-ink-2">
          {signedIn
            ? "Progress, bookmarks, review queue and streak are saved to your account in Firebase."
            : "Progress, bookmarks, review queue and streak are stored only in this browser’s localStorage. Nothing is sent to a server."}
        </p>
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          {[
            ["Answered", hydrated ? answered : "…"],
            ["Bookmarks", hydrated ? state.bookmarks.length : "…"],
            ["In review", hydrated ? state.reviewQueue.length : "…"],
            ["Active days", hydrated ? state.activityDays.length : "…"],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg bg-paper-2 p-3">
              <dt className="text-xs text-ink-3">{k}</dt>
              <dd className="text-lg">{v}</dd>
            </div>
          ))}
        </dl>
        <div>
          <button type="button" className="btn border-bad text-bad" onClick={() => dialogRef.current?.showModal()}>
            Reset all data…
          </button>
        </div>
        <p role="status" className="text-sm text-good empty:hidden">
          {message}
        </p>
      </section>

      <section aria-labelledby="about-h" className="flex flex-col gap-2 text-sm text-ink-2">
        <h2 id="about-h" className="text-xl font-bold text-ink">
          About the questions
        </h2>
        <p>
          {QUESTIONS.length} questions imported from the frontend interview question bank workbook. Questions, answers and
          explanations are shown exactly as written; code is displayed but never executed.
        </p>
      </section>

      <dialog
        ref={dialogRef}
        aria-labelledby="reset-title"
        aria-describedby="reset-desc"
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-lg border border-line bg-card p-0 text-ink shadow-xl backdrop:bg-black/50"
      >
        <form method="dialog" className="flex flex-col gap-4 p-6">
          <h2 id="reset-title" className="text-2xl font-bold">
            Reset all data?
          </h2>
          <p id="reset-desc" className="text-ink-2">
            This permanently deletes your practice progress, streak, bookmarks, review queue and any session in progress from {where}. It
            cannot be undone.
          </p>
          <div className="flex flex-wrap justify-end gap-3">
            {/* Cancel comes first so it receives initial focus. */}
            <button value="cancel" className="btn" autoFocus>
              Cancel
            </button>
            <button
              value="reset"
              className="btn border-bad bg-bad text-paper"
              onClick={() => {
                actions.resetAll();
                setMessage("All data has been reset.");
              }}
            >
              Yes, reset everything
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
