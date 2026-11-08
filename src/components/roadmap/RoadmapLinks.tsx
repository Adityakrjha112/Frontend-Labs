import Link from "next/link";
import { topicsForQuestion } from "@/roadmap/links";

/**
 * Links a practice question back to its roadmap week(s) and that week's
 * documentation, via the explicit mapping in src/roadmap/question-map.ts.
 */
export function RoadmapLinks({ questionId }: { questionId: string }) {
  const topics = topicsForQuestion(questionId);
  return (
    <nav aria-label="Related roadmap topics" className="rounded-lg border border-line bg-card p-4 text-sm">
      <h2 className="mb-2 text-base">On the roadmap</h2>
      {topics.length === 0 ? (
        <p className="text-ink-3">
          This question isn&apos;t linked to a roadmap week.{" "}
          <Link href="/docs/question-mapping" className="font-medium text-accent underline">
            See how questions are mapped
          </Link>
          .
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {topics.map((t) => (
            <li key={t.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <Link href={`/roadmap/${t.id}`} className="font-semibold text-ink underline decoration-line underline-offset-4 hover:decoration-accent">
                Week {t.week}: {t.title}
              </Link>
              {"resources" in t.content ? (
                <Link href={`/roadmap/${t.id}#resources`} className="text-accent underline">
                  Week {t.week} documentation
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
}
