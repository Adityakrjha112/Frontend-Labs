import type { Metadata } from "next";
import { ResultsView } from "@/components/views/ResultsView";

export const metadata: Metadata = { title: "Results" };

export default function Page() {
  return <ResultsView />;
}
