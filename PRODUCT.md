# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Parents homeschooling with the A.C.E. (Accelerated Christian Education) curriculum, often with several children at
different levels. They open Folio for a few seconds at a time, on a laptop at the table or on a phone, usually right
after a child finishes a PACE or a PACE Test.

## Product Purpose

Folio replaces paper record folders, handwritten logs and spreadsheets. It answers three questions, in this order:
how are my children doing, what is each of them working on right now, and how do I record what they just completed.
Success means a first-time parent understands the app within about five seconds, can record a completed PACE in
under ten seconds, and can produce something printable for their files, a co-op or a state portfolio without help.

## Operating Context

- A.C.E. work is organized in PACEs: numbered workbooks (1001–1144 for Levels 1–12, twelve per level) per subject.
  A child usually has one PACE in progress per subject and finishes with a PACE Test scored as a percentage; 80% is
  the usual pass mark.
- Typical subjects: Mathematics, English, Science, Social Studies, Word Building, Literature, plus family-specific
  extras.
- Records are kept per household; a household may have one or many children.

## Capabilities and Constraints

- Accounts with per-household data; a household's records are visible only to its members.
- Students, subjects, enrollments and one canonical record per student–subject–PACE, with an audit trail of every
  change.
- Logging progress (completed with score, started), editing and deleting records with confirmation.
- Natural-language entry ("Gabriel finished Math 1084 with 94%") that proposes structured changes; nothing is written
  until the parent confirms. Works with OpenAI or a built-in offline parser.
- Records search and filtering, CSV export, printable reports (weekly, monthly, student, subject, test scores,
  completed PACEs, academic summary).
- Constraints: keep the existing functionality and database architecture; the household is always derived from the
  session on the server; demo data stays in a separate, clearly labeled household.

## Brand Commitments

- Name: Folio.
- The interface should feel calm, clear, fast, precise and intuitive, never enterprise, dense, technical or
  analytics-heavy: a calm homeschool command center rather than an analytics platform.
- Color source of truth: the green palette the owner supplied (near-black green, mint-white, white, green signal).
  The app ships light and dark themes, following the device by default.

## Evidence on Hand

- A seeded demo homeschool (six children, the six core subjects, several months of PACE history) for demonstration;
  it is synthetic and labeled "Demo data" in the app.
- No testimonials, customer counts or published claims exist; none may be invented.

## Product Principles

1. Remove before adding; combine before creating; hide before duplicating.
2. The children come first: every screen answers how they are doing or what they are working on.
3. Recording progress is the primary action everywhere, and it takes seconds.
4. AI is a shortcut into the same confirmed workflow, never a separate product.
5. One obvious purpose and one obvious primary action per screen.

## Accessibility & Inclusion

WCAG 2.2 AA: readable contrast in both themes, full keyboard use, visible focus, touch-sized controls on phones, and
no information carried by color alone.
