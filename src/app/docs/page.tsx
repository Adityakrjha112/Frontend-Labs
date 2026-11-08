import type { Metadata } from "next";
import Link from "next/link";
import { DOC_SECTIONS } from "@/components/roadmap/docs";
import { ROADMAP } from "@/roadmap/model";

export const metadata: Metadata = { title: "Documentation" };

export default function Page() {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-4xl font-bold sm:text-5xl">Roadmap guide</h1>
        <p className="max-w-[65ch] text-ink-2">
          Assessment results, how to work each week, checkpoints, the capstone and resources for “{ROADMAP.title}”, as of {ROADMAP.asOf}.
        </p>
      </header>
      <ul className="grid gap-4 sm:grid-cols-2">
        {DOC_SECTIONS.map((s) => (
          <li key={s.slug}>
            <Link href={`/docs/${s.slug}`} className="card flex h-full flex-col gap-1.5 p-5 no-underline hover:border-line-strong" style={{ color: "var(--ink)" }}>
              <span className="font-display text-lg font-bold">
                {s.title}
              </span>
              <span className="text-sm text-ink-2">{s.blurb}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
