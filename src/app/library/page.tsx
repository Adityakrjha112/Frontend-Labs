import type { Metadata } from "next";
import { LibraryView } from "@/components/views/LibraryView";

export const metadata: Metadata = { title: "Library" };

export default function Page() {
  return <LibraryView />;
}
