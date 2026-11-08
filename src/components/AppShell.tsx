"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";
import { useEffect } from "react";
import { useHydrated, useLabState } from "@/lib/store";
import { roadmapActions } from "@/roadmap/store";
import { RoadmapToasts } from "./roadmap/bits";
import { AccountMenu, SyncBanner } from "./AccountMenu";
import { isFirebaseConfigured } from "@/lib/cloud/config";
import { useAccount } from "@/lib/cloud/account";

const NAV = [
  { href: "/roadmap", label: "Roadmap", match: ["/roadmap"] },
  { href: "/docs", label: "Documentation", short: "Docs", match: ["/docs"] },
  { href: "/practice", label: "Practice", match: ["/practice", "/session", "/results", "/library"] },
  { href: "/progress", label: "Progress", match: ["/progress"] },
] as const;

const isCurrent = (pathname: string, match: readonly string[]) =>
  match.some((m) => pathname === m || pathname.startsWith(`${m}/`));

/** Wordmark: a tiny box-model diagram (margin, border, padding, content). */
export function BoxMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true" className="shrink-0">
      <rect x="0.5" y="0.5" width="27" height="27" rx="3" fill="var(--bm-margin)" stroke="var(--ink)" strokeWidth="1" />
      <rect x="5" y="5" width="18" height="18" rx="2" fill="var(--bm-border)" />
      <rect x="8.5" y="8.5" width="11" height="11" rx="1.5" fill="var(--bm-padding)" />
      <rect x="11.5" y="11.5" width="5" height="5" rx="1" fill="var(--bm-content)" stroke="var(--ink)" strokeWidth="1" />
    </svg>
  );
}

function Logo() {
  return (
    <Link href="/" className="flex min-h-11 items-center gap-2 rounded-md text-ink no-underline sm:gap-2.5">
      <BoxMark />
      <span className="font-display text-base font-extrabold tracking-tight whitespace-nowrap max-[359px]:sr-only sm:text-lg">Frontend Lab</span>
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const account = useAccount();
  const state = useLabState();
  const hydrated = useHydrated();
  const active = hydrated && state.activeSession;

  // One visit per app load, like opening the original roadmap page. Wait until the
  // sign-in state is known, so a signed-in visit goes to the account instead of
  // being written locally and then merged on every page load.
  const authKnown = account.phase !== "checking" && account.phase !== "migrating";
  useEffect(() => {
    if (authKnown) roadmapActions.recordVisitOnce();
  }, [authKnown]);

  // Firebase is only loaded when it's configured; otherwise the app stays local-only.
  useEffect(() => {
    if (isFirebaseConfigured) void import("@/lib/cloud/sync").then((m) => m.startSync());
  }, []);

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only-focusable fixed top-2 left-2 z-50 rounded-md bg-ink px-3 py-2 text-paper"
      >
        Skip to content
      </a>
      {/* Phones: two compact rows that scroll away, so reading space isn't lost. Wider screens: one sticky bar. */}
      <header className="z-40 border-b border-line bg-card sm:sticky sm:top-0">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-2 px-4 pt-1 sm:flex-nowrap sm:gap-x-6 sm:px-6 sm:pt-0">
          <Logo />
          {/* Panel tabs, in the manner of the DevTools tab strip. Four equal tabs on phones. */}
          <nav aria-label="Primary" className="order-3 -mx-4 w-[calc(100%+2rem)] sm:order-none sm:mx-0 sm:w-auto sm:self-stretch">
            <ul className="grid h-full grid-cols-4 sm:flex">
              {NAV.map((item) => {
                const current = isCurrent(pathname, item.match);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={current ? "page" : undefined}
                      className={`flex h-full min-h-11 items-center justify-center border-b-[3px] px-1 text-[0.9rem] font-semibold whitespace-nowrap no-underline transition-colors sm:px-3 sm:py-4 sm:text-[0.95rem] ${
                        current ? "border-accent text-ink" : "border-transparent text-ink-3 hover:border-line hover:text-ink"
                      }`}
                    >
                      {"short" in item ? (
                        <>
                          <span className="sm:hidden">{item.short}</span>
                          <span className="max-sm:hidden">{item.label}</span>
                        </>
                      ) : (
                        item.label
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="ml-auto flex items-center gap-1 py-1.5 sm:gap-1.5 sm:py-2">
            {active && pathname !== "/session" ? (
              <Link href="/session" className="btn btn-sm btn-primary max-sm:hidden">
                Resume session
              </Link>
            ) : null}
            <AccountMenu />
            <ThemeToggle />
            <Link
              href="/settings"
              aria-label="Settings"
              aria-current={pathname === "/settings" ? "page" : undefined}
              className={`btn btn-ghost btn-sm min-w-11 px-2 ${pathname === "/settings" ? "bg-paper-2" : ""}`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
              </svg>
            </Link>
          </div>
        </div>
      </header>
      <SyncBanner />
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 outline-none sm:px-6 sm:py-10">
        {children}
      </main>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-sm text-ink-3 sm:px-6">
          <p>A 26-week front-end roadmap and 500 interview questions.</p>
          <p>
            {account.user && account.phase !== "error"
              ? "Your progress is saved to your account."
              : "Your progress stays in this browser. Back up roadmap data from Progress, under Data."}
          </p>
        </div>
      </footer>
      <RoadmapToasts />
    </div>
  );
}
