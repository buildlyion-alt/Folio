# Folio

Folio is a record-keeping web app for homeschool families using the A.C.E. curriculum. It tracks every child's
current PACE in every subject, PACE Test scores and completions, and turns them into a live dashboard, per-student
progress, searchable records and printable reports. Progress can be logged with a quick form or by simply telling
Folio what happened — _“Gabriel completed Math 1084 today with 94% and started 1085”_ — and confirming the
changes it proposes.

## Features

- **Accounts and households.** Email/password sign-up, database-backed sessions, and a five-step setup: homeschool
  name, students (paste a whole list), subjects (the six A.C.E. core subjects preselected), everyone's current PACE
  in a keyboard-friendly grid, and a confirmation summary.
- **Home dashboard.** Weekly numbers, a progress chart with every student's current PACE per subject (click a
  cell to log), what needs attention (scores below the pass mark, PACEs running long, subjects with nothing in
  progress) and recent activity.
- **Log progress anywhere.** One dialog, prefilled from context: student, subject, PACE, status, test score, date
  and notes. Saving updates the canonical record everywhere and offers to start the next PACE.
- **AI assistant.** Natural-language entries become proposed changes that are checked against your records and
  shown for review — nothing is written until you confirm, edit or cancel. It also answers questions
  (“Who completed PACEs this week?”, “Show scores below 80%”) and opens reports. Works with OpenAI or a built-in
  offline parser.
- **Command bar.** <kbd>⌘K</kbd> / <kbd>Ctrl K</kbd> (or <kbd>/</kbd>) searches students, subjects and PACE
  numbers, jumps to pages, and passes anything else to the assistant.
- **Students.** Directory with status and current PACEs; profiles with a PACE strip per subject (levels, scores,
  gaps to backfill, the next PACE), full history and an activity trail.
- **Records.** Every PACE record with search, filters (student, subject, status, date, PACE and score ranges),
  sorting, pagination and CSV export. Records can be inspected, edited and deleted with confirmation; the audit
  trail keeps every change.
- **Progress.** Completions per week against the household's target, completed vs. expected per student, by-subject
  averages, school-year pace and low scores — for this week, this month, last month, a term or the school year.
- **Reports.** Weekly, monthly, student, subject, test score history, completed PACEs and academic summary —
  generated from real records, laid out for printing or saving as PDF, and downloadable as CSV.
- **Designed for phones too.** A dedicated mobile layout with bottom navigation, full-screen dialogs and touch-sized
  controls.

## Quick start

Requirements: Node.js 20.9 or newer and PostgreSQL 14 or newer.

```bash
npm install
cp .env.example .env.local          # then set DATABASE_URL
createdb folio_dev                  # or create the database however you prefer
npm run db:migrate
npm run db:seed                     # optional: the demo homeschool
npm run dev
```

Open http://localhost:3000 and create an account, or sign in to the demo homeschool with
**demo@folio.app** / **folio-demo** after seeding (set `FOLIO_DEMO_LOGIN=1` to show the hint on the sign-in page).

### Environment

| Variable           | Required | Purpose                                                                                       |
| ------------------ | -------- | --------------------------------------------------------------------------------------------- |
| `DATABASE_URL`     | yes      | PostgreSQL connection string.                                                                 |
| `OPENAI_API_KEY`   | no       | Enables OpenAI parsing for the assistant. Without it, the offline parser is used.             |
| `OPENAI_MODEL`     | no       | Model for parsing (default `gpt-5.4-mini`).                                                   |
| `FOLIO_DEMO_LOGIN` | no       | `1` shows the demo credentials on the sign-in page. Development only — ignored in production. |

### The AI assistant

With `OPENAI_API_KEY` set, Folio sends the sentence you typed plus your students' first names and subject names to
OpenAI and asks for a structured reading (Responses API with structured outputs). Scores, history and other records
are never sent. The reading is then resolved against the database on the server: names are matched, the PACE is
inferred when omitted, and anything unusual (an overwrite, a score below the pass mark, a PACE far from the current
one, an unknown student) is flagged. The parent sees exactly what will change and confirms; only then does Folio
write, through the same validated path as the form, marked “via assistant” in the history.

Without a key — or if the provider fails — the deterministic offline parser handles the same kinds of sentences,
and the UI says which one was used. The API key is read only on the server and never reaches the browser.

## Scripts

| Command               | What it does                                                   |
| --------------------- | -------------------------------------------------------------- |
| `npm run dev`         | Development server.                                            |
| `npm run build`       | Production build.                                              |
| `npm start`           | Serve the production build.                                    |
| `npm run lint`        | ESLint.                                                        |
| `npm run typecheck`   | TypeScript, no emit.                                           |
| `npm run db:generate` | Generate a migration after changing `src/server/db/schema.ts`. |
| `npm run db:migrate`  | Apply migrations to `DATABASE_URL`.                            |
| `npm run db:seed`     | Rebuild the demo homeschool (refuses in production).           |
| `npm test`            | Unit and integration tests (Vitest).                           |
| `npm run test:e2e`    | End-to-end flows in Chromium (Playwright).                     |

## Testing

**Unit and integration tests** cover the offline parser, name matching, dates, PACE numbering and on-track
signals, plus the write path against a real database: onboarding, logging, edits and deletes with their audit
events, household isolation (including the database's own composite-key checks), the assistant from proposal to
confirmed write, sessions and password changes.

```bash
createdb folio_test
DATABASE_URL=postgres://folio:folio@127.0.0.1:5432/folio_test npm run db:migrate
npm test                            # TEST_DATABASE_URL overrides the folio_test default
```

The integration helpers refuse to run against a database whose name doesn't end in `_test`.

**End-to-end tests** build the app, start it against the test database (re-migrated and re-seeded first), and walk
through the core flows in a real browser:

- **A** — sign up, complete onboarding, land on the dashboard.
- **B** — log Gabriel's Mathematics 1084 as completed at 94%, start 1085, and see it on the dashboard, in records
  and in the weekly report.
- **C** — Students → Gabriel → Mathematics history → inspect 1084; edit and delete safeguards.
- **D** — “Gabriel completed Math 1085 with 91%” in the assistant → review → confirm → verified in the database.
- **E** — records filtered to Gabriel and Mathematics.
- **F** — on a phone-sized screen, sign in and log a completed PACE.

```bash
npx playwright install chromium     # once, or set PLAYWRIGHT_CHROMIUM to an existing Chromium
npm run test:e2e                    # E2E_DATABASE_URL overrides the folio_test default
```

## Architecture

Next.js 16 (App Router, React Server Components and Server Actions), TypeScript, PostgreSQL with Drizzle ORM, Zod
for validation, CSS Modules on a small set of design tokens, and Lucide icons.

```
src/
  app/              routes: (auth) sign-in/up, onboarding, (app) home, students, progress, records, reports,
                    assistant, settings; server actions in app/actions; CSV route handlers
  components/       UI primitives (ui/), the app shell, dialogs and feature components
  domain/           pure logic shared by server and client: dates, PACE numbering, on-track signals,
                    validation schemas, DTO types
  server/
    auth/           password hashing, sessions, cookies, the session → household context
    db/             schema, client
    services/       every write: progress (the single write path), onboarding, students, settings, assistant
    queries/        every read: overview, records, activity, progress analytics, reports, search
    assistant/      parsers (OpenAI and offline), matching, resolution into proposed changes
  proxy.ts          optimistic redirect for signed-out visitors (Next.js 16's replacement for middleware)
drizzle/            SQL migrations
scripts/            migrate and seed
tests/              unit, integration and e2e
```

**One record, everywhere.** Each student–subject–PACE has exactly one row in `pace_records`. The form, the
assistant, onboarding and edits all go through `recordProgress` / `updatePaceRecord`, which enforce the rules
(no future dates, completion not before the start, scores only on completed PACEs) and append an event to
`progress_events` with the previous state. Dashboards, profiles, records and reports all read those two tables, so
there's nothing to keep in sync.

**On track.** With the household's target (12 PACEs per subject per year by default, over 36 school weeks), a PACE
is expected to take about three weeks. A subject needs attention when its latest test is below the pass mark (80%
by default) or its current PACE has run more than 1.5× the expected time. A subject with nothing in progress is a
to-do, not a concern.

## Security

- **Authentication.** Passwords are hashed with scrypt (per-password salt, parameters stored with the hash).
  Sessions are random 256-bit tokens; only their SHA-256 hash is stored, and the cookie is HTTP-only, `SameSite=Lax`
  and `Secure` in production, with a 30-day sliding expiry. Sign-in attempts are rate-limited, unknown emails take
  the same time as wrong passwords, and changing the password signs out every other device.
- **Authorization.** The household is always derived on the server from the session — never from IDs sent by the
  browser. Every query and write is scoped to that household, and the database enforces it as well: composite
  foreign keys make it impossible to attach a student, subject or record to another household's rows.
- **The assistant never writes on its own.** Interpreting text has no side effects; changes are written only after
  the parent confirms them, re-validated and re-scoped on the server, in a single transaction.
- **Secrets stay on the server.** The OpenAI key and database URL are only read in server-only modules.
- **Demo data is separate.** The demo homeschool lives in a household flagged `is_demo`, is labeled “Demo data” in
  the app, and is the only thing the seed script deletes or rebuilds. The seed refuses to run in production.

## Deployment

Any Node.js host with PostgreSQL works. Set `DATABASE_URL` (and optionally `OPENAI_API_KEY`), run
`npm run db:migrate`, then `npm run build && npm start`. Serve over HTTPS — session cookies are `Secure` in
production.

When running more than one instance, note that the sign-in rate limiter is in memory and so applies per instance;
put a shared limiter (or your platform's) in front if you scale out.

## Not yet included

- Password reset and email verification (there is no outgoing email).
- Inviting a second parent or tutor to a household — the data model supports multiple members, but there's no
  invitation flow yet.
