/**
 * Roadmap week → workbook question mapping.
 *
 * This file is the single, reviewable source of truth. Each rule selects
 * questions either by an exact workbook (ID prefix, Topic) pair or by
 * explicit question IDs, and says which roadmap concept justifies it.
 * Nothing is matched by fuzzy text search. When a match was unclear, the
 * question or week is left unmapped and listed below with a reason.
 *
 * `npm run report:mapping` expands these rules into
 * docs/roadmap-question-mapping.md for review. Tests check that every rule
 * resolves to existing questions and every week is accounted for.
 */
import type { Question } from "@/lib/types";

/** Exact workbook selector: ID prefix (JS, REACT, …) and the Topic cell. */
export type TopicSelector = readonly [prefix: string, topic: string];

export interface MappingRule {
  topics?: readonly TopicSelector[];
  ids?: readonly string[];
  /** Roadmap concept(s) from that week that justify the rule. */
  why: string;
}

export const WEEK_RULES: Readonly<Record<string, readonly MappingRule[]>> = {
  w1: [
    { topics: [["HCT", "HTML semantics"]], why: "landmarks; `button` vs `a`" },
    { topics: [["HCT", "Forms"]], why: "labels, input types, constraint validation, `name` and submit" },
    { topics: [["DBG", "Forms bugs"]], why: "form submission data (`name`/`FormData`) and input states" },
  ],
  w2: [
    { topics: [["PAS", "Accessibility"]], why: "accessible names, focus management, `<dialog>`, skip links" },
    { topics: [["PAS", "Keyboard"]], why: "first rule of ARIA: native elements bring keyboard support" },
    { topics: [["PAS", "WCAG"]], why: "contrast; WCAG 2.2 A/AA" },
    { topics: [["HCT", "HTML"]], why: "`<dialog>`" },
    { topics: [["HCT", "CSS animation"]], why: "`prefers-reduced-motion`" },
    { ids: ["HCT-028"], why: "visible focus (`:focus-visible`)" },
    { topics: [["DBG", "Accessibility bugs"], ["DBG", "Keyboard bugs"]], why: "focus management and keyboard order" },
  ],
  w3: [
    { topics: [["HCT", "CSS basics"]], why: "box model and `box-sizing`" },
    { topics: [["HCT", "CSS layout"], ["HCT", "Flexbox"], ["HCT", "Grid"], ["HCT", "Layout"]], why: "flex algorithm, grid tracks, `auto-fit`/`auto-fill`, subgrid" },
    { topics: [["HCT", "Cascade"], ["HCT", "Cascade layers"], ["HCT", "CSS architecture"]], why: "cascade, specificity, `@layer`" },
    { ids: ["HCT-018"], why: "specificity (`:where`)" },
    { topics: [["HCT", "Stacking"], ["HCT", "Positioning"]], why: "stacking contexts and `z-index`; positioned layout" },
    { topics: [["DBG", "CSS bugs"]], why: "intrinsic sizing / percentage heights in normal flow" },
  ],
  w4: [
    { topics: [["HCT", "Responsive design"], ["HCT", "Responsive layout"]], why: "content-first breakpoints, fluid layouts" },
    { topics: [["HCT", "Container queries"]], why: "container queries" },
    { topics: [["HCT", "CSS units"]], why: "`rem` vs `px` and user font settings" },
  ],
  w5: [
    { topics: [["JS", "Declarations"], ["JS", "Scope"], ["JS", "Closures"]], why: "hoisting, TDZ, scope chain, closures" },
    { ids: ["JS-028"], why: "block scope" },
    { topics: [["JS", "this"], ["JS", "Prototypes"], ["JS", "Classes"]], why: "the `this` rules; prototypes and `class`" },
    { topics: [["JS", "Equality"], ["JS", "Coercion"]], why: "equality and coercion" },
    { ids: ["JS-002"], why: "value vs reference" },
    { topics: [["JS", "Immutability"], ["JS", "Cloning"]], why: "shallow vs deep copy, `structuredClone`" },
    { topics: [["JS", "Iterators"], ["JS", "Modules"]], why: "iterators and generators; ESM vs CommonJS, live bindings" },
    { topics: [["JS", "Memory"], ["PAS", "Memory"]], why: "garbage collection and common leaks" },
  ],
  w6: [
    {
      topics: [
        ["ASYNC", "Promises"],
        ["ASYNC", "async await"],
        ["ASYNC", "Combinators"],
        ["ASYNC", "Event loop"],
        ["ASYNC", "Animation"],
        ["ASYNC", "Cancellation"],
        ["ASYNC", "Async iteration"],
        ["ASYNC", "Concurrency"],
      ],
      why: "task vs microtask queues, async/await, combinators, `requestAnimationFrame`, `AbortController`, concurrency",
    },
    { topics: [["JS", "Rate limiting"], ["DBG", "Rate limiting bugs"]], why: "debouncing" },
    { topics: [["DBG", "Cancellation bugs"]], why: "`AbortController`" },
  ],
  w7: [
    { topics: [["DOM", "Rendering pipeline"]], why: "critical rendering path" },
    { topics: [["PAS", "Rendering"]], why: "forced synchronous layout (layout thrashing)" },
    { topics: [["PAS", "Main thread"]], why: "long tasks and yielding to the main thread" },
    { topics: [["HCT", "CSS performance"]], why: "`content-visibility`" },
    { topics: [["DOM", "Workers"], ["DBG", "Worker bugs"]], why: "Web Workers" },
  ],
  w8: [
    { topics: [["DOM", "CORS"]], why: "CORS and preflight" },
    { topics: [["DOM", "Fetch"], ["DBG", "Fetch bugs"]], why: "requests and responses (status handling, bodies)" },
  ],
  w9: [
    {
      topics: [
        ["TS", "Types"],
        ["TS", "Nullability"],
        ["TS", "Unions"],
        ["TS", "Narrowing"],
        ["TS", "Assertions"],
        ["TS", "Literals"],
        ["TS", "Collections"],
        ["TS", "Functions"],
        ["TS", "Generics"],
        ["TS", "Validation"],
        ["TS", "Utility types"],
        ["TS", "satisfies"],
        ["TS", "Overloads"],
        ["TS", "React typing"],
        ["TS", "Configuration"],
        ["TS", "Modules"],
        ["TS", "Conditional types"],
        ["TS", "Mapped types"],
        ["TS", "Template literal types"],
        ["TS", "Optional properties"],
      ],
      why: "the whole week: structural typing, narrowing, unions, generics, mapped/conditional types, `satisfies`, strict flags, runtime validation",
    },
  ],
  w10: [
    { topics: [["REACT", "Rendering"], ["REACT", "State"]], why: "render vs commit; state as a snapshot; purity" },
    { topics: [["REACT", "Lists"]], ids: ["REACT-053"], why: "reconciliation, keys and component identity" },
    { topics: [["REACT", "Effects"], ["REACT", "Development"]], why: "effects as synchronization; cleanup; Strict Mode replay" },
    { topics: [["DBG", "React races"]], why: "effect cleanup for stale responses" },
    { topics: [["REACT", "Refs"], ["REACT", "Forms"]], why: "refs; controlled vs uncontrolled inputs" },
    { topics: [["REACT", "Memoization"], ["REACT", "Performance"]], why: "when re-renders happen and when `memo` helps" },
    { topics: [["REACT", "Suspense"], ["REACT", "Errors"], ["REACT", "use API"]], why: "Suspense and error boundaries" },
    { topics: [["REACT", "Actions"], ["REACT", "Optimistic UI"]], why: "React 19 Actions APIs (`useActionState`, `useOptimistic`)" },
    { topics: [["REACT", "Compiler"]], why: "what the React Compiler automates" },
  ],
  w11: [
    { topics: [["REACT", "Optimistic UI"], ["DBG", "Optimistic bugs"]], why: "optimistic updates with rollback" },
  ],
  w12: [
    {
      topics: [
        ["NEXT", "Components"],
        ["NEXT", "Routing"],
        ["NEXT", "Navigation"],
        ["NEXT", "Route handlers"],
        ["NEXT", "Loading"],
        ["NEXT", "Assets"],
        ["NEXT", "Metadata"],
        ["NEXT", "Fonts"],
        ["NEXT", "Directives"],
        ["NEXT", "Request APIs"],
        ["NEXT", "Actions"],
        ["NEXT", "Layouts"],
        ["NEXT", "Rendering"],
        ["NEXT", "Caching"],
        ["NEXT", "Images"],
        ["NEXT", "Proxy"],
        ["NEXT", "Search params"],
        ["NEXT", "Hydration"],
        ["NEXT", "Parallel routes"],
        ["NEXT", "Intercepting routes"],
        ["NEXT", "Static generation"],
        ["NEXT", "Errors"],
        ["NEXT", "Streaming"],
        ["NEXT", "Dynamic imports"],
        ["NEXT", "Runtime"],
        ["NEXT", "Architecture"],
        ["NEXT", "Security"],
        ["NEXT", "Environment"],
        ["NEXT", "Deployment"],
      ],
      why: "the whole week: App Router, Server/Client Components, caching, Route Handlers, Server Actions, loading/error files, metadata, images and fonts, runtimes",
    },
    { topics: [["REACT", "Server rendering"], ["REACT", "Hydration"], ["DBG", "Hydration bugs"]], ids: ["REACT-054"], why: "hydration and its mismatches" },
  ],
  w13: [
    { topics: [["PAS", "Core Web Vitals"], ["PAS", "Metrics"]], why: "Core Web Vitals thresholds; lab vs field data" },
  ],
  w14: [
    { topics: [["PAS", "Loading"]], why: "lazy loading below the fold only; priority hints" },
    { topics: [["PAS", "Bundles"], ["REACT", "Lazy loading"]], why: "bundle analysis; code splitting and `import()`" },
    { topics: [["REACT", "Transitions"], ["REACT", "Deferred values"]], why: "INP fixes with `useTransition` and `useDeferredValue`" },
  ],
  w15: [
    { topics: [["DOM", "DOM updates"]], why: "DOM-based XSS via `innerHTML`" },
    { topics: [["NEXT", "Security"]], why: "secrets shipped in client bundles; authorization" },
    { topics: [["NEXT", "Environment"]], why: "public environment variables leak into the client" },
    { topics: [["DOM", "CORS"]], why: "why CORS isn't authorization" },
  ],
  w17: [
    { topics: [["REACT", "Context"], ["REACT", "Reducers"]], why: "Context and its re-render cost; reducers" },
    { topics: [["REACT", "External stores"], ["DBG", "External store bugs"]], why: "external stores and selectors" },
    { topics: [["REACT", "State architecture"]], why: "kinds of state (URL vs local)" },
    { topics: [["DOM", "Storage"], ["DBG", "Storage bugs"]], why: "persistence with schema versions; cross-tab sync (`storage` event)" },
  ],
  w18: [
    { topics: [["REACT", "Errors"]], why: "error-handling strategy (error boundaries)" },
  ],
  w19: [
    { ids: ["HCT-024", "HCT-031", "HCT-037"], why: "design tokens and theming with CSS custom properties" },
  ],
  w21: [
    { topics: [["NEXT", "Deployment"]], why: "hosting models (static export on a CDN)" },
    { topics: [["NEXT", "Environment"], ["DBG", "Deployment bugs"]], why: "environments and environment variables" },
  ],
};

/** Weeks deliberately left without questions, with the reason. */
export const UNMAPPED_WEEKS: Readonly<Record<string, string>> = {
  w16: "Testing strategy and automated accessibility: the workbook has no questions about test design, Playwright, axe or flaky tests.",
  w20: "Tooling and CI/CD: no workbook questions cover package managers, bundlers, linting, CI pipelines or release tooling.",
  w22: "Capstone week (project work, no study topic).",
  w23: "Capstone week (project work, no study topic).",
  w24: "Capstone week (project work, no study topic).",
  w25: "Capstone week (project work, no study topic).",
  w26: "Capstone week (project work, no study topic).",
};

/** Partial gaps worth knowing: weeks whose concepts are only partly covered. */
export const PARTIAL_COVERAGE: Readonly<Record<string, string>> = {
  w8: "Only fetch and CORS are covered; HTTP caching, CDNs, cookies, resource hints and Service Workers have no questions.",
  w11: "Only optimistic updates are covered; query caches (TanStack Query/SWR) and Testing Library have no questions.",
  w18: "Only error boundaries are covered; folder structure, boundaries, flags and micro-frontends have no questions.",
  w19: "Only design tokens (via Tailwind v4 theme variables) are covered.",
  w21: "Only environment variables and static export are covered; monitoring and rollouts have no questions.",
};

/* ------------------------------------------------------------------ */
/* Resolution                                                          */
/* ------------------------------------------------------------------ */

export interface ResolvedMapping {
  /** Week ID → question IDs in workbook order. */
  byWeek: ReadonlyMap<string, readonly string[]>;
  /** Question ID → week IDs in roadmap order. */
  byQuestion: ReadonlyMap<string, readonly string[]>;
  /** Selectors or IDs that matched nothing (should be empty). */
  dangling: string[];
}

const prefixOf = (id: string) => id.slice(0, id.lastIndexOf("-"));

export function resolveMapping(questions: readonly Question[], rules = WEEK_RULES): ResolvedMapping {
  const byWeek = new Map<string, string[]>();
  const byQuestion = new Map<string, string[]>();
  const known = new Set(questions.map((q) => q.id));
  const dangling: string[] = [];

  for (const [week, weekRules] of Object.entries(rules)) {
    const ids = new Set<string>();
    for (const rule of weekRules) {
      for (const [prefix, topic] of rule.topics ?? []) {
        const hits = questions.filter((q) => prefixOf(q.id) === prefix && q.topic === topic);
        if (hits.length === 0) dangling.push(`${week}: ${prefix} / ${topic}`);
        hits.forEach((q) => ids.add(q.id));
      }
      for (const id of rule.ids ?? []) {
        if (!known.has(id)) dangling.push(`${week}: ${id}`);
        else ids.add(id);
      }
    }
    const ordered = questions.filter((q) => ids.has(q.id)).map((q) => q.id);
    byWeek.set(week, ordered);
    for (const id of ordered) byQuestion.set(id, [...(byQuestion.get(id) ?? []), week]);
  }
  return { byWeek, byQuestion, dangling };
}
