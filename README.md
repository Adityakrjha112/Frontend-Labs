# Frontend Lab

One Next.js app that combines two former projects:

- **The Front-End Depth Roadmap:** a 26-week plan with concepts, projects, exercises, checklists, notes, a study log and an activity heatmap. It was converted from the original single-file `index.html`.
- **The interview-practice app:** 500 questions covering JavaScript, React, Next.js, TypeScript, HTML/CSS/Tailwind, DOM and browser APIs, async JavaScript, performance/accessibility/SEO, and debugging scenarios.

Each roadmap week links to its relevant questions through an explicit mapping, and each question links back to its week and that week's documentation.

All questions come from `data/frontend_interview_question_bank.xlsx`. The app shows them exactly as written, as plain text. It never renders workbook content as HTML and never runs any of the code snippets.

## Quick start

Requires Node.js 20.9 or newer (developed on Node 26, npm 11).

```bash
npm install
npm run dev          # imports the workbook, then starts http://localhost:3000
```

Production:

```bash
npm run build        # imports and validates the workbook, then runs next build
npm start
```

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Re-imports the workbook (`predev`), then starts the dev server |
| `npm run build` | Re-imports the workbook (`prebuild`), then builds. **The build fails if the workbook is malformed.** |
| `npm start` | Serves the production build |
| `npm run import:questions [-- path.xlsx]` | Imports a workbook into `src/data/questions.json` |
| `npm run lint` | ESLint (Next.js core-web-vitals + TypeScript rules) |
| `npm run typecheck` | `tsc --noEmit` (strict, `noUncheckedIndexedAccess`) |
| `npm test` | Vitest: importer, session selection, grading, persistence, question UI |
| `npm run report:mapping` | Regenerates `docs/roadmap-question-mapping.md` from the mapping rules |
| `npm run verify` | Runs import validation, lint, typecheck, test and build in order |

## Updating the question bank

1. Replace `data/frontend_interview_question_bank.xlsx` with the new workbook. Keep the same file name, or pass a path: `npm run import:questions -- ~/Downloads/bank.xlsx`.
2. Run `npm run import:questions`. On success it writes `src/data/questions.json`. On failure it lists every problem and exits with code 1, for example:

   ```
   Workbook validation failed with 1 issue(s):
     - sheet "All_Questions", row 3, question ASYNC-002, field "Expected Output": Predict Output requires Expected Output
   ```

3. Commit both the workbook and the regenerated `questions.json`.

### What the importer checks

The importer reads the `Schema`, `Overview` and `All_Questions` sheets. Only `All_Questions` supplies questions; the per-technology sheets are views of the same rows and are ignored.

- **Structure:** every column the app uses must be defined in `Schema` and present in the `All_Questions` header.
- **Required fields:** every column marked `Yes` in `Schema` must be non-empty. Whitespace-only counts as empty.
- **IDs:** each ID must match `PREFIX-000`, be unique (a duplicate is reported against the row of the first use), and use the prefix that matches its technology (`JS`, `REACT`, `NEXT`, `TS`, `HCT`, `DOM`, `ASYNC`, `PAS`, `DBG`).
- **Allowed values:** technology, difficulty and question type must each come from the allowed set.
- **MCQ:** `Options` must be valid JSON: an array of exactly four `{id, text}` objects with ids A, B, C and D in that order and non-empty text. `Correct Answer` must be one of those ids.
- **Expected Output:** required for Predict Output and Code Trace, where it must equal `Correct Answer` exactly. It must be empty for every other type.
- **Conditional fields:** `Options` must be empty for non-MCQ questions. An empty conditional cell means "not applicable" and becomes `null`.
- **Source URL:** must be a single `https://` URL.
- **Follow-ups:** the question must start with `Follow-up to PREFIX-000:` and name an existing question.
- **Escaping:** per the workbook's import note, a leading apostrophe before `=`, `+`, `-` or `@` is removed. Only that one character is removed.
- **Overview:** the total in `Overview` is checked against the imported count. A mismatch prints a warning but does not fail the import, because those totals are derived data.

The workbook uses namespace-prefixed SpreadsheetML (`<x:worksheet>`), which common spreadsheet libraries such as exceljs fail to parse. `src/importer/workbook.ts` therefore reads the `.xlsx` package directly with `fflate` and `fast-xml-parser`. It never evaluates formulas.

## Features

- **Dashboard:** overall progress, MCQ accuracy, self-rated recall, practice streak (current and best), and breakdowns by technology and by difficulty.
- **Practice:**
  - A one-click **Quick 10**, which picks unseen questions first.
  - A **custom session builder** with filters for technology, topic, difficulty and type. Each filter option shows a live count, you choose how many questions to include, and you get a clear message when no questions match.
  - Sessions built from the review queue or your bookmarks.
- **Question view:**
  - Syntax-highlighted code (JS/TS, HTML, CSS), rendered as React text nodes. Long lines scroll horizontally and the code block can be scrolled with the keyboard.
  - **MCQ:** pick an option, then submit. The app grades it.
  - **All other types:** write your answer in a text box (a monospace box for code and output questions), then reveal the reference. These answers are **self-reviewed**: you mark them *Got it* or *Missed it*, and the app never claims to grade them.
  - Two progressive hints and an optional timer. The timer counts up against a soft target and never submits for you.
  - After you answer: the correct answer, the expected output, the explanation, and a link to the source documentation.
- **Results:** MCQ accuracy, with self-review completion reported separately. Also shows missed topics, a per-question breakdown, and **Practice these again**.
- **Library:** search and filter all 500 questions, bookmark them, add them to the review queue, or practise any one of them on its own.
- **Persistence:** all progress is saved in versioned `localStorage` and validated whenever it is read. Malformed entries are dropped one by one. If the saved data can't be read at all, it is backed up and reset, and the app shows a notice. **Settings** has a reset control with a confirmation dialog.
- **Accessibility:**
  - Semantic landmarks, a skip link and visible focus rings.
  - Native radio and checkbox controls; focus moves to each new question and to the feedback after you answer.
  - Keyboard shortcuts: `A`–`D`, `H`, `←`/`→`, `B`, and `⌘/Ctrl+Enter`.
  - Respects `prefers-reduced-motion`.
  - Light and dark themes (Auto / Light / Dark), and layouts that work down to 360px wide.

## Design

The visual identity is based on the DevTools box-model diagram. Its four tones (margin, border, padding, content) are the only colours, used for the home-page roadmap diagram, week status and selected states. Everything else is ink on a cool panel grey, in both light and dark themes.

- **Type:** Atkinson Hyperlegible Next for all text, and its Mono sibling only for code and question IDs.
- **Navigation:** DevTools-style panel tabs.
- **Stats:** shown as Computed-panel rows of names and values.
- **Tokens:** defined in `src/app/globals.css`.

Based on the `frontend-design` skill in `.claude/skills/frontend-design`.

## Routes

| Route | What it is |
| --- | --- |
| `/` | Home: where you are on the roadmap, that week's practice questions, Quick 10 |
| `/roadmap` | Overview (you-are-here card, stats, month progress) and all 26 weeks, with search (`/` to focus), a status filter, and expand/collapse that is remembered |
| `/roadmap/w1` … `/roadmap/w26` | One page per week: status, facts, tasks, notes, `#resources`, mapped practice questions, previous/next week |
| `/docs`, `/docs/[slug]` | Documentation: assessment, how-to, checkpoints, resources, capstone spec, and the question mapping |
| `/practice`, `/library`, `/session`, `/results` | Interview practice (unchanged behaviour) |
| `/progress` | Practice stats, roadmap stats, Today (goals and study log), the activity heatmap, and roadmap data export/import/reset |
| `/settings` | Practice preferences and practice-data reset |

Primary navigation is Roadmap · Documentation · Practice · Progress. Settings is the gear icon in the header.

## Architecture

```
data/                              source workbook (the only question source)
scripts/import-questions.ts        CLI: workbook → src/data/questions.json (fails the build if malformed)
scripts/report-mapping.ts          CLI: mapping rules → docs/roadmap-question-mapping.md
src/importer/                      xlsx reader, schema validation, language hint
src/data/questions.json            generated question data (500)
src/roadmap/
  content.json                     roadmap content, extracted verbatim from the original index.html
  model.ts                         typed content + derived weeks/items (original item IDs kept)
  state.ts                         pure port of the original tracker logic (sanitize, storage, streaks, mutations)
  store.ts                         client store, toasts, storage banner
  question-map.ts                  explicit week → question rules, unmapped weeks with reasons
  links.ts                         resolved mapping used by the UI
  Md.tsx                           inline markdown (`code`, **bold**, links) as React elements
src/lib/                           practice domain: types, sessions, grading, practice storage, stats
src/components/roadmap/            roadmap UI (weeks, topic body, overview, today/activity, data, docs)
src/components/                    practice UI (QuestionRunner, filters, views)
src/app/                           App Router routes; roadmap.css holds the ported roadmap styles
docs/roadmap-question-mapping.md   generated, reviewable mapping report
tests/                             Vitest suites, workbook fixtures, legacy-sanitize parity fixture
```

Every route is statically prerendered: 44 pages, including all 26 week pages and 6 documentation pages.

### What changed from the original roadmap page

- Content moved into `src/roadmap/content.json`. A test pins its SHA-256 to the original.
- DOM building with `innerHTML` was replaced by React components. The markdown helper now produces React elements.
- Behaviour was ported to pure, tested functions in `src/roadmap/state.ts`. A parity fixture, captured by running the original page in jsdom, checks that `sanitize()` produces identical output.
- Features kept:
  - the you-are-here card and month progress
  - status per week, task checklists, notes that save automatically, milestones and checkpoints
  - search with the `/` shortcut, the status filter, and expand/collapse that is remembered
  - today's goals and the study log (1–600 minutes)
  - the 27-week heatmap with arrow, Home and End keys, and day detail
  - visits tracked separately from study days
  - export, import and reset with confirmation
  - cross-tab sync
- The roadmap's theme button merged into the app-wide theme toggle.
- The single-page sections (Overview, Today, Activity, Roadmap, Guide) are now spread across `/roadmap`, `/progress` and `/docs`.

## AI tutor prompts (voice study)

Every week page, and every week in the roadmap list, has a **Study week N with an AI tutor** panel. **Copy prompt** gives you a detailed prompt to paste into an AI assistant before you switch on voice mode. The home page's "This week" card has a one-click copy for your current week.

The prompt is generated by `src/roadmap/tutor-prompt.ts` from the week's own roadmap content, so it can't drift from the page:

- **The week:** purpose, prerequisites, key concepts in order, skip check, project, advanced exercise with its hint, interview questions, resources and tasks.
- **Assessment notes:** the gap-focus flag, assessment rows that name the week, and questions you previously missed that point to it.
- **Month milestone and checkpoint:** included in the last week of each month.
- **Practice questions:** up to six mapped bank questions that work when spoken. Follow-ups are only included with their parent question, and the workbook text is passed through unchanged.
- **Your progress (optional):** the week's status and the tasks you've already finished.

The prompt sets voice-mode rules: short turns, one question at a time, no reading code aloud, hints before solutions, and commands like "slower" or "quiz me". It then runs a fixed session: warm-up, skip check, concepts with understanding checks, project planning, the exercise, a scored mock interview, and a wrap-up covering what to tick off and log. Capstone weeks get a mentor-and-reviewer prompt built from the plan, features and acceptance criteria.

The roadmap text is quoted as written, and the prompt tells the AI that "you" in it means the learner.

## Accounts and cloud sync (Firebase)

Signing in is optional. Firebase Authentication handles sign-in with Google or with an email and password, including account creation and password reset.

- **Signed out:** everything is saved in this browser's localStorage, as before.
- **Signed in:** practice and roadmap progress is saved in the Firebase Realtime Database at `users/{uid}/practice` and `users/{uid}/roadmap`, in the same validated formats. It syncs live across tabs and devices.
- **When you sign in,** anything saved in this browser is merged into your account (see the rules below), then removed from the browser once the merged result is safely written. A banner reports what was merged.
- **Signing out** returns the app to localStorage. Your data stays in your account.
- **If sync fails,** the app falls back to this browser's storage, so nothing is lost.
- **The theme setting** stays on each device.

### Merge rules (`src/lib/cloud/merge.ts`)

Nothing is overwritten. Each field is combined:

| Data | How it's merged |
| --- | --- |
| Question progress | Attempts and successes are added together; the most recent answer decides the last outcome |
| Bookmarks, review queue, practice days | Union |
| Session in progress / last results | The most recent is kept (its answers are already counted in progress) |
| Week status | The furthest status wins (completed > in progress > not started) |
| Ticked tasks | Union, keeping the earliest completion time |
| Notes | Kept as they are if identical or one contains the other; otherwise both are kept, separated by a "Merged from this device" line |
| Study logs | Union by log ID |
| Visits | Added together |
| Preferences | The account's choice wins over this device's default |

Counts are added, so the same local data must never be merged twice. `src/lib/cloud/migrate.ts` guarantees that in two ways:

- **Fingerprints:** each local snapshot is fingerprinted. The fingerprint is stored at `users/{uid}/meta/merged/` in the same atomic multi-path update as the merged data, so a snapshot that was already merged is skipped.
- **Mid-upload changes:** if local data changes during the upload, only the difference since the uploaded snapshot is merged.

Local data that can't be read is never deleted, so the existing recovery backup still works.

### Setup

1. **Create the project.** In the [Firebase console](https://console.firebase.google.com/), create a project and add a **Web app**.
2. **Enable sign-in.** Under **Authentication → Sign-in method**, enable **Google** and **Email/Password**. Add your site's domain under **Authorized domains**.
3. **Create the database.** Create a **Realtime Database**, then deploy the security rules with `npm run deploy:rules`. This uses `database.rules.json`, which gives each signed-in user read and write access to their own `users/{uid}` node only, rejects malformed data and unknown paths, and blocks everything else.
4. **Configure the app.** Copy `.env.example` to `.env.local` and fill in the web app's settings: API key, auth domain, database URL, project ID and app ID. These values are public by design; the security rules are what protect the data. Then rebuild.

Without these settings, the app hides sign-in and runs local-only, exactly as before.

### Testing with the emulators

`npm run emulators` starts the Firebase Auth and Realtime Database emulators. The database emulator needs Java 21 or newer.

To point a build at them, set:

- `NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR=127.0.0.1:9099`
- `NEXT_PUBLIC_FIREBASE_DATABASE_EMULATOR=127.0.0.1:9000`
- `NEXT_PUBLIC_FIREBASE_DATABASE_URL=http://127.0.0.1:9000?ns=demo-frontend-lab-default-rtdb`

Use the project ID `demo-frontend-lab`. The emulator applies the rules only to the `<project>-default-rtdb` namespace.

## Saved data and migration

| Store | Key | Format |
| --- | --- | --- |
| Roadmap progress | `fe-depth-tracker:v1` | Unchanged from the original (`app: "fe-depth-tracker"`, `schema: 1`) |
| Practice progress | `frontend-lab:state` | Unchanged (version 1). A new session origin, `roadmap`, was added without breaking older data |
| Theme | `frontend-lab:theme` | If it isn't set, the app adopts the roadmap's saved `prefs.theme` once |

Neither storage format changed, so no data migration is needed:

- **Same origin:** if the original page was served from the same origin as this app, its progress loads directly.
- **Different origin** (for example, opened as a `file://` page): browsers keep that storage separate. Export from the old page (`git show 602bf52:index.html > old.html`, open it, then **Data → Download JSON**) and import it in **Progress → Data → Import**. The import accepts the original export format.

## Grading

- **MCQ:** graded by the app.
- **Every other type:** self-reviewed (*Got it* / *Missed it*).

Neither original project had AI grading, API keys or server routes, and none were added. The app is fully static. Its only external service is the optional Firebase sign-in and sync described above, whose web settings are public by design.

## Roadmap ↔ question mapping

`src/roadmap/question-map.ts` defines the links between weeks and questions:

- **Rules:** each rule selects an exact workbook `(ID prefix, Topic)` pair or specific question IDs, and gives the roadmap concept that justifies it. No fuzzy matching is used.
- **Coverage:**
  - 362 of the 500 questions link to at least one week.
  - 138 don't, because they sit in areas the roadmap doesn't teach: most JS standard-library topics, Tailwind syntax, SEO, DOM events and observers, and a few one-off React and debugging topics.
  - Weeks 16 (testing), 20 (tooling and CI/CD) and 22–26 (capstone) have no matching questions.
  - Five weeks are only partly covered.
- **Review:** see `/docs/question-mapping` in the app, or `docs/roadmap-question-mapping.md`.
- **Tests:** they fail if a rule matches nothing, or if a week is neither mapped nor explained.

## Known limitations

- **Cloud sync writes each store as a whole document.** If two signed-in devices change the same store at nearly the same moment, the last write wins; the other device then catches up through live sync. Merging happens only when local data moves into the account at sign-in.
- **Offline changes while signed in** are queued by Firebase in memory and sent when the connection returns. They are lost if the tab is closed before that.

- Roadmap progress and practice progress are separate stores with separate resets and streaks. A roadmap study day comes from logging time or ticking a task; answering practice questions doesn't count toward it.
- Roadmap visits are counted once per app load, as the original counted page opens.

- Progress lives in a single browser. There is no account or sync, and clearing site data erases it.
- Free-text and code answers are self-reviewed only. Code is never executed, and output answers are not compared automatically.
- The highlighting language (JS/TS, HTML or CSS) is guessed from the snippet's content. This only affects colours.
- The question data (about 540 KB of JSON) is bundled into the client, so the first load is heavier than it would be with per-page data loading.
