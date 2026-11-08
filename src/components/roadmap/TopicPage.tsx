"use client";

import Link from "next/link";
import { useEffect } from "react";
import { TOPICS, TOPIC_BY_ID, monthOf } from "@/roadmap/model";
import { currentTopic, statusOf } from "@/roadmap/state";
import { useRoadmapState } from "@/roadmap/store";
import { useHydrated } from "@/lib/store";
import { StatusPill, StorageBanner } from "./bits";
import { TopicBody } from "./TopicBody";

export function TopicPage({ topicId }: { topicId: string }) {
  const topic = TOPIC_BY_ID.get(topicId)!;
  const month = monthOf(topic);
  const state = useRoadmapState();
  const hydrated = useHydrated();
  const idx = TOPICS.indexOf(topic);
  const prev = TOPICS[idx - 1];
  const next = TOPICS[idx + 1];
  const here = hydrated && currentTopic(state)?.id === topic.id;

  // Honour #resources and other in-page anchors after hydration.
  useEffect(() => {
    if (!hydrated || !window.location.hash) return;
    document.getElementById(decodeURIComponent(window.location.hash.slice(1)))?.scrollIntoView({ block: "start" });
  }, [hydrated]);

  return (
    <div className="rm flex flex-col gap-6">
      <nav aria-label="Breadcrumb" className="text-sm">
        <ol className="flex flex-wrap items-center gap-1.5 text-ink-3">
          <li>
            <Link href="/roadmap">Roadmap</Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href={`/roadmap#month-${month.id}`}>
              Month {month.n}: {month.theme}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-ink">
            Week {topic.week}
          </li>
        </ol>
      </nav>
      <StorageBanner />

      <header className="flex flex-col gap-3">
        <h1 className="text-4xl sm:text-5xl">
          <span className="mb-2 block text-xl font-semibold tracking-normal text-ink-3">Week {topic.week} of 26</span>
          {topic.title}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          {hydrated ? <StatusPill status={statusOf(state, topic.id)} /> : null}
          {"gap" in topic.content && topic.content.gap ? <span className="rm-gap-tag ml-0">Gap focus</span> : null}
          {here ? <span className="rm-here-tag ml-0">You are here</span> : null}
        </div>
      </header>

      <section aria-labelledby="week-details-h" className="grid gap-3">
        <h2 id="week-details-h" className="text-2xl font-bold">
          Plan, tasks and practice
        </h2>
        <div className="rm-topic" data-status={hydrated ? statusOf(state, topic.id) : "not-started"}>
          <TopicBody topic={topic} />
        </div>
      </section>

      <nav aria-label="Adjacent weeks" className="flex flex-wrap justify-between gap-3 border-t border-line pt-6">
        {prev ? (
          <Link href={`/roadmap/${prev.id}`} className="btn">
            Previous: week {prev.week}, {prev.title}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link href={`/roadmap/${next.id}`} className="btn">
            Next: week {next.week}, {next.title}
          </Link>
        ) : null}
      </nav>
    </div>
  );
}
