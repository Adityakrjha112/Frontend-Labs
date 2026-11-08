import { DocsNav } from "@/components/roadmap/DocsNav";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="rm grid grid-cols-1 gap-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-8">
      <DocsNav />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
