import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  AssessmentDoc,
  CapstoneDetails,
  CheckpointsDoc,
  DOC_SECTIONS,
  HowToDoc,
  MappingDoc,
  ResourcesDoc,
  type DocSlug,
} from "@/components/roadmap/docs";

export const dynamicParams = false;

export function generateStaticParams() {
  return DOC_SECTIONS.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const s = DOC_SECTIONS.find((d) => d.slug === slug);
  return { title: s ? s.title : "Documentation" };
}

const BODY: Record<DocSlug, () => React.ReactNode> = {
  assessment: () => <AssessmentDoc />,
  "how-to": () => <HowToDoc />,
  checkpoints: () => <CheckpointsDoc />,
  resources: () => <ResourcesDoc />,
  capstone: () => <CapstoneDetails />,
  "question-mapping": () => <MappingDoc />,
};

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const section = DOC_SECTIONS.find((d) => d.slug === slug);
  if (!section) notFound();
  return (
    <article className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-4xl font-bold">{section.title}</h1>
        <p className="text-ink-2">{section.blurb}</p>
      </header>
      {BODY[section.slug]()}
    </article>
  );
}
