import type { Metadata } from "next";
import { SessionView } from "@/components/views/SessionView";

export const metadata: Metadata = { title: "Session" };

export default function Page() {
  return <SessionView />;
}
