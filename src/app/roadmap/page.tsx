import type { Metadata } from "next";
import { RoadmapView } from "@/components/roadmap/RoadmapView";

export const metadata: Metadata = { title: "Roadmap" };

export default function Page() {
  return <RoadmapView />;
}
