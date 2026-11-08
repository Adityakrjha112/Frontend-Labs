"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DOC_SECTIONS } from "./docs";

export function DocsNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Documentation" className="min-w-0 lg:sticky lg:top-24 lg:self-start">
      <h2 className="rm-h4 mb-2">Documentation</h2>
      <ul className="flex flex-wrap gap-1.5 lg:flex-col lg:flex-nowrap lg:gap-1">
        <li>
          <Link
            href="/docs"
            aria-current={pathname === "/docs" ? "page" : undefined}
            className={`flex min-h-10 items-center rounded-md border border-line px-3 text-sm no-underline lg:min-h-0 lg:border-0 lg:px-2.5 lg:py-1.5 ${pathname === "/docs" ? "bg-ink text-paper" : "hover:bg-paper-2"}`}
            style={pathname === "/docs" ? undefined : { color: "var(--ink)" }}
          >
            Overview
          </Link>
        </li>
        {DOC_SECTIONS.map((s) => {
          const href = `/docs/${s.slug}`;
          const current = pathname === href;
          return (
            <li key={s.slug}>
              <Link
                href={href}
                aria-current={current ? "page" : undefined}
                className={`flex min-h-10 items-center rounded-md border border-line px-3 text-sm no-underline lg:min-h-0 lg:border-0 lg:px-2.5 lg:py-1.5 ${current ? "bg-ink text-paper" : "hover:bg-paper-2"}`}
                style={current ? undefined : { color: "var(--ink)" }}
              >
                {s.title}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
