import Link from "next/link";
import { Md } from "@/roadmap/Md";
import { ROADMAP, TOPICS, TOPIC_BY_ID } from "@/roadmap/model";
import { PARTIAL_COVERAGE, UNMAPPED_WEEKS, WEEK_RULES } from "@/roadmap/question-map";
import { MAPPING } from "@/roadmap/links";
import { QUESTIONS } from "@/lib/bank";

const G = ROADMAP.guide;

export const DOC_SECTIONS = [
  { slug: "assessment", title: "Assessment summary", blurb: "Where the gaps are, and how the plan responds." },
  { slug: "how-to", title: "How to use this roadmap", blurb: "The weekly rhythm, skip checks, debugging method and artifacts." },
  { slug: "checkpoints", title: "Review checkpoints", blurb: "Pass bars for each month, and what to do if you fall behind." },
  { slug: "resources", title: "Core resources", blurb: "Primary references to return to." },
  { slug: "capstone", title: "Capstone specification", blurb: "Features, mocked API contract and acceptance criteria." },
  { slug: "question-mapping", title: "Roadmap ↔ question mapping", blurb: "Which workbook questions belong to which week, and why." },
] as const;
export type DocSlug = (typeof DOC_SECTIONS)[number]["slug"];

function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="rm-table-wrap">
      <table>
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const ExtLink = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a href={href} target="_blank" rel="noopener noreferrer">
    {children}
    <span className="sr-only"> (opens in a new tab)</span>
  </a>
);

export function AssessmentDoc() {
  return (
    <div className="rm-gbody">
      <p><Md>{G.assessmentLead}</Md></p>
      <Table
        head={["Area", "Result", "Core gap", "How the plan responds"]}
        rows={G.assessment.map((r) => r.map((c, i) => <Md key={i}>{c}</Md>))}
      />
      <p><strong>Assumptions.</strong> <Md>{G.assumptions}</Md></p>
      <p>
        <strong>Hints for the questions you missed.</strong> Try each one again before its week starts; the full answer is part of that week.
      </p>
      <ul className="rm-list">
        {G.hints.map(([q, h]) => (
          <li key={q}>
            <strong>{q}:</strong> <Md>{h}</Md>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function HowToDoc() {
  return (
    <div className="rm-gbody">
      <p>
        Each week follows the same 10-hour rhythm, and each week ends with something written. Depth comes from building things and explaining them, not from reading alone.
      </p>
      <Table
        head={["Block", "Hours", "What you do"]}
        rows={G.rhythm.map(([b, h, w]) => [b, <span key="h" className="rm-mono">{h}</span>, <Md key="w">{w}</Md>])}
      />
      <p><strong>Skip checks.</strong> <Md>{G.skipChecks}</Md></p>
      <p><strong>Hints before solutions.</strong> <Md>{G.hintsRule}</Md></p>
      <p><strong>Debugging method (use it every time).</strong></p>
      <ol className="rm-list rm-list-ol">
        {G.debugging.map((s, i) => (
          <li key={i}><Md>{s}</Md></li>
        ))}
      </ol>
      <p>
        <strong>Communication artifacts.</strong> Rotate through these. By month 6 you&apos;ll have about 26 of them, which also makes good interview material.
      </p>
      <ul className="rm-list">
        {G.artifacts.map(([a, d]) => (
          <li key={a}>
            <strong>{a}:</strong> <Md>{d}</Md>
          </li>
        ))}
      </ul>
      <p><strong>Tradeoff habit.</strong> <Md>{G.tradeoff}</Md></p>
    </div>
  );
}

export function CheckpointsDoc() {
  return (
    <div className="rm-gbody">
      <p><Md>{G.checkpointRule}</Md></p>
      <Table
        head={["Week", "Checkpoint", "Assessment questions re-taken", "Pass bar"]}
        rows={G.checkpoints.map(([w, c, q, p]) => [<span key="w" className="rm-mono">{w}</span>, <Md key="c">{c}</Md>, <Md key="q">{q}</Md>, <Md key="p">{p}</Md>])}
      />
      <p><strong>If you fall behind:</strong> <Md>{G.behind}</Md></p>
      <p><strong>How to work with me during the six months:</strong> <Md>{G.workWithMe}</Md></p>
    </div>
  );
}

export function ResourcesDoc() {
  return (
    <div className="rm-gbody">
      <p>These are free, primary, and maintained. The per-week links are the starting point; these are the references to return to.</p>
      <ul className="rm-list">
        {G.resources.map(([t, url, note]) => (
          <li key={url}>
            <ExtLink href={url}>{t}</ExtLink>
            {note ? (
              <>
                : <Md>{note}</Md>
              </>
            ) : null}
          </li>
        ))}
      </ul>
      <p className="rm-muted">All links point to official or long-standing sources. If one has moved, search for its title on the same site.</p>
      <h2 className="mt-4 text-xl font-bold">Per-week documentation</h2>
      <ul className="rm-list">
        {TOPICS.filter((t) => "resources" in t.content).map((t) => (
          <li key={t.id}>
            <Link href={`/roadmap/${t.id}#resources`}>
              Week {t.week}: {t.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CapstoneDetails({ collapsible = false }: { collapsible?: boolean }) {
  const c = ROADMAP.capstone;
  // Standalone on /docs/capstone (under the h1) or nested in the Weeks list (under an h2).
  const H = collapsible ? "h3" : "h2";
  const body = (
    <div className="mt-3 grid gap-3.5">
      <H className="rm-h4">Features (each one exercises specific skills)</H>
      <Table head={["Feature", "Skills it demonstrates"]} rows={c.features.map((r) => r.map((x, i) => <Md key={i}>{x}</Md>))} />
      <H className="rm-h4">Mocked API contract</H>
      <p><Md>{c.apiIntro}</Md></p>
      <ul className="rm-list">
        {c.endpoints.map((e, i) => (
          <li key={i}><Md>{e}</Md></li>
        ))}
      </ul>
      <H className="rm-h4">Capstone acceptance criteria</H>
      <Table
        head={["Area", "Criterion", "How it's verified"]}
        rows={c.acceptance.map(([a, b, v]) => [<strong key="a"><Md>{a}</Md></strong>, <Md key="b">{b}</Md>, <Md key="v">{v}</Md>])}
      />
      <p><strong>Required documents:</strong> <Md>{c.docs}</Md></p>
      <p><strong>Case study outline:</strong> <Md>{c.caseStudy}</Md></p>
    </div>
  );
  if (!collapsible) return <div className="rm-gbody">{body}</div>;
  return (
    <details className="rm-hint-box" open>
      <summary>Capstone details: features, API contract, acceptance criteria</summary>
      {body}
    </details>
  );
}

export function MappingDoc() {
  const mappedCount = MAPPING.byQuestion.size;
  const unmapped = QUESTIONS.filter((q) => !MAPPING.byQuestion.has(q.id));
  const unmappedByArea = new Map<string, string[]>();
  for (const q of unmapped) {
    const key = `${q.id.slice(0, q.id.lastIndexOf("-"))}: ${q.topic}`;
    unmappedByArea.set(key, [...(unmappedByArea.get(key) ?? []), q.id]);
  }
  return (
    <div className="rm-gbody">
      <p>
        Each roadmap week links to workbook questions through explicit rules in <code>src/roadmap/question-map.ts</code>. A rule selects an exact workbook
        topic (by ID prefix and Topic) or specific question IDs, and names the roadmap concept that justifies it. Nothing is matched by keyword search.
        Unclear matches are left unmapped.
      </p>
      <p>
        <strong>{mappedCount}</strong> of {QUESTIONS.length} questions are linked to at least one week; <strong>{unmapped.length}</strong> are not linked
        and remain available in Practice and the Library.
      </p>
      <Table
        head={["Week", "Questions", "Rules: workbook topic or IDs, and the reason"]}
        rows={TOPICS.map((t) => {
          const rules = WEEK_RULES[t.id] ?? [];
          const n = MAPPING.byWeek.get(t.id)?.length ?? 0;
          return [
            <Link key="w" href={`/roadmap/${t.id}`}>
              Week {t.week}: {t.title}
            </Link>,
            <span key="n" className="rm-mono">{n}</span>,
            rules.length ? (
              <ul key="r" className="rm-list">
                {rules.map((r, i) => (
                  <li key={i}>
                    <span className="font-semibold">{[...(r.topics ?? []).map(([p, tp]) => `${p} ${tp}`), ...(r.ids ?? [])].join(", ")}</span>: <Md>{r.why}</Md>
                  </li>
                ))}
                {PARTIAL_COVERAGE[t.id] ? <li className="rm-muted">Partial: {PARTIAL_COVERAGE[t.id]}</li> : null}
              </ul>
            ) : (
              <span key="r" className="rm-muted">Unmapped: {UNMAPPED_WEEKS[t.id]}</span>
            ),
          ];
        })}
      />
      <h2 className="mt-4 text-xl font-bold">Workbook questions without a roadmap week</h2>
      <p className="rm-muted">These areas aren&apos;t covered by any roadmap concept, so they aren&apos;t linked.</p>
      <Table
        head={["Workbook area", "Count", "Question IDs"]}
        rows={[...unmappedByArea].map(([k, ids]) => [k, <span key="n" className="rm-mono">{ids.length}</span>, <span key="i" className="rm-mono text-xs">{ids.join(", ")}</span>])}
      />
    </div>
  );
}

export function weekLabel(id: string): string {
  const t = TOPIC_BY_ID.get(id);
  return t ? `Week ${t.week}: ${t.title}` : id;
}
