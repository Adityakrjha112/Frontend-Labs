import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TopicPage } from "@/components/roadmap/TopicPage";
import { TOPICS, TOPIC_BY_ID } from "@/roadmap/model";

export const dynamicParams = false;

export function generateStaticParams() {
  return TOPICS.map((t) => ({ topicId: t.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ topicId: string }> }): Promise<Metadata> {
  const t = TOPIC_BY_ID.get((await params).topicId);
  return { title: t ? `Week ${t.week}: ${t.title}` : "Roadmap" };
}

export default async function Page({ params }: { params: Promise<{ topicId: string }> }) {
  const { topicId } = await params;
  if (!TOPIC_BY_ID.has(topicId)) notFound();
  return <TopicPage topicId={topicId} />;
}
