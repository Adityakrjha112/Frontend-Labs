"use client";

import { useRef, useState } from "react";
import { ALL_ITEMS } from "@/roadmap/model";
import { checkImport, doneCount, exportJSON, keyOf, studyDayCount, type RoadmapState } from "@/roadmap/state";
import { roadmapActions, useRoadmapState } from "@/roadmap/store";
import { applyTheme } from "@/lib/theme";
import { useAccount } from "@/lib/cloud/account";

type Msg = { text: string; ok: boolean } | null;

function useConfirm() {
  const ref = useRef<HTMLDialogElement>(null);
  const [cfg, setCfg] = useState({ title: "", text: "", ok: "Confirm" });
  const resolver = useRef<((v: boolean) => void) | null>(null);
  const ask = (title: string, text: string, ok: string) =>
    new Promise<boolean>((resolve) => {
      setCfg({ title, text, ok });
      resolver.current = resolve;
      ref.current?.showModal();
    });
  const dialog = (
    <dialog
      ref={ref}
      aria-labelledby="rm-confirm-h"
      aria-describedby="rm-confirm-text"
      onClose={(e) => {
        resolver.current?.(e.currentTarget.returnValue === "ok");
        resolver.current = null;
        e.currentTarget.returnValue = "cancel";
      }}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-lg border border-line-strong bg-card p-0 text-ink backdrop:bg-black/50"
    >
      <form method="dialog" className="grid gap-4 p-6">
        <h2 id="rm-confirm-h" className="text-2xl font-bold">
          {cfg.title}
        </h2>
        <p id="rm-confirm-text" className="text-ink-2">
          {cfg.text}
        </p>
        <div className="flex flex-wrap justify-end gap-3">
          <button value="cancel" className="btn" autoFocus>
            Cancel
          </button>
          <button value="ok" className="btn border-bad bg-bad text-paper">
            {cfg.ok}
          </button>
        </div>
      </form>
    </dialog>
  );
  return { ask, dialog };
}

/** Roadmap data: export, import and reset (the original Data dialog, inline). */
export function DataPanel() {
  const state = useRoadmapState();
  const { ask, dialog } = useConfirm();
  const account = useAccount();
  const where = account.user && account.phase !== "error" ? "your account" : "this browser";
  const [exportMsg, setExportMsg] = useState<Msg>(null);
  const [importMsg, setImportMsg] = useState<Msg>(null);
  const [text, setText] = useState("");
  const [fallback, setFallback] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const fallbackRef = useRef<HTMLTextAreaElement>(null);

  const notes = Object.keys(state.notes).length;
  const summary = `Saved here: ${doneCount(state, ALL_ITEMS)} completed checklist items, ${Object.keys(state.topics).length} weeks with a status, ${notes} ${notes === 1 ? "note" : "notes"}, ${studyDayCount(state)} study days, ${Object.keys(state.visits).length} days visited. Saved in: ${where}${roadmapActions.storageOK() ? "" : " (storage unavailable; changes are lost on close)"}.`;

  const replace = (next: RoadmapState, notice: string) => {
    roadmapActions.replace(next, notice);
    applyTheme(next.prefs.theme);
  };

  const msgEl = (m: Msg) => (
    <p className={`text-sm ${m ? (m.ok ? "text-good" : "text-bad") : ""}`} aria-live="polite">
      {m?.text}
    </p>
  );

  return (
    <div className="grid gap-5">
      <p className="text-sm text-ink-3">{summary}</p>

      <section aria-labelledby="rm-export-h" className="grid gap-2">
        <h3 id="rm-export-h" className="text-lg font-bold">
          Export
        </h3>
        <p className="text-sm text-ink-3">
          Saves roadmap progress, notes, activity, visits, and preferences as JSON (the same format as the original tracker). If the download doesn&apos;t start,
          use Copy JSON.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              try {
                const url = URL.createObjectURL(new Blob([exportJSON(state)], { type: "application/json" }));
                const a = document.createElement("a");
                a.href = url;
                a.download = `fe-roadmap-backup-${keyOf(new Date())}.json`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                setTimeout(() => URL.revokeObjectURL(url), 2000);
                setExportMsg({ text: "Download started. If no file appeared, this viewer blocks downloads; use Copy JSON instead.", ok: true });
              } catch {
                setExportMsg({ text: "The download failed. Use Copy JSON instead.", ok: false });
              }
            }}
          >
            Download JSON
          </button>
          <button
            type="button"
            className="btn"
            onClick={async () => {
              const json = exportJSON(state);
              try {
                if (!navigator.clipboard?.writeText) throw new Error("no clipboard");
                await navigator.clipboard.writeText(json);
                setExportMsg({ text: "Copied. Paste it into a file or into Import on another device.", ok: true });
              } catch {
                setFallback(json);
                requestAnimationFrame(() => fallbackRef.current?.select());
                setExportMsg({ text: "Copying was blocked. The JSON is selected below; press Ctrl+C (or Cmd+C) to copy it.", ok: false });
              }
            }}
          >
            Copy JSON
          </button>
        </div>
        {fallback !== null ? (
          <textarea ref={fallbackRef} readOnly aria-label="Exported JSON" className="field min-h-30 font-mono text-xs" value={fallback} />
        ) : null}
        {msgEl(exportMsg)}
      </section>

      <section aria-labelledby="rm-import-h" className="grid gap-2 border-t border-line pt-4">
        <h3 id="rm-import-h" className="text-lg font-bold">
          Import
        </h3>
        <p className="text-sm text-ink-3">
          Replaces the roadmap data saved here. Choose a file or paste JSON exported from this app or from the original roadmap page.
        </p>
        <div className="grid gap-1">
          <label htmlFor="rm-import-file" className="text-sm font-medium">
            JSON file
          </label>
          <input
            ref={fileRef}
            id="rm-import-file"
            type="file"
            accept="application/json,.json"
            className="w-full max-w-full min-w-0 text-sm file:mr-3 file:min-h-11 file:rounded-md file:border file:border-line file:bg-card file:px-3 file:font-semibold file:text-ink"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              if (f.size > 5 * 1024 * 1024) {
                setImportMsg({ text: "That file is larger than 5 MB, so it is not a roadmap export.", ok: false });
                return;
              }
              f.text().then(
                (t) => {
                  setText(t);
                  setImportMsg({ text: `Loaded “${f.name}”. Press Import to replace your data with it.`, ok: true });
                },
                () => setImportMsg({ text: "That file could not be read. Try choosing it again.", ok: false }),
              );
            }}
          />
        </div>
        <div className="grid gap-1">
          <label htmlFor="rm-import-text" className="text-sm font-medium">
            Or paste JSON
          </label>
          <textarea
            id="rm-import-text"
            spellCheck={false}
            className="field min-h-30 font-mono text-xs"
            placeholder='{"app":"fe-depth-tracker", ...}'
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
        <div>
          <button
            type="button"
            className="btn"
            onClick={async () => {
              const r = checkImport(text);
              if (!r.ok) {
                setImportMsg({ text: r.message, ok: false });
                return;
              }
              const items = Object.keys(r.state.tasks).length;
              const days = Object.keys(r.state.activity).length;
              const ok = await ask(
                "Replace your roadmap data?",
                `Importing replaces the roadmap data saved in ${where}. The file has ${items} completed checklist items, ${Object.keys(r.state.notes).length} notes, and ${days} study days.${r.skipped ? ` ${r.skipped} invalid ${r.skipped === 1 ? "entry" : "entries"} will be skipped.` : ""} Practice progress is not affected.`,
                "Replace and import",
              );
              if (!ok) {
                setImportMsg({ text: "Import cancelled. Nothing changed.", ok: false });
                return;
              }
              replace(r.state, "Data imported.");
              setText("");
              if (fileRef.current) fileRef.current.value = "";
              setImportMsg({ text: `Imported.${r.skipped ? ` ${r.skipped} invalid ${r.skipped === 1 ? "entry was" : "entries were"} skipped.` : ""}`, ok: true });
            }}
          >
            Import
          </button>
        </div>
        {msgEl(importMsg)}
      </section>

      <section aria-labelledby="rm-reset-h" className="grid gap-2 border-t border-line pt-4">
        <h3 id="rm-reset-h" className="text-lg font-bold">
          Reset roadmap data
        </h3>
        <p className="text-sm text-ink-3">
          Deletes roadmap progress, notes, activity, and visits in {where}. Practice progress is reset separately in Settings.
        </p>
        <div>
          <button
            type="button"
            className="btn border-bad text-bad"
            onClick={async () => {
              const ok = await ask(
                "Reset roadmap data?",
                `This permanently deletes all roadmap progress, notes, study activity, visits, and preferences saved in ${where}. It cannot be undone.`,
                "Reset everything",
              );
              if (ok) roadmapActions.reset();
            }}
          >
            Reset roadmap data…
          </button>
        </div>
      </section>
      {dialog}
    </div>
  );
}
