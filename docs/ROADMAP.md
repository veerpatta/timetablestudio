# Roadmap — build strictly in order

Each milestone has acceptance criteria (AC). Do not start the next milestone until all AC pass. Each milestone = one or more small PRs/commits, each leaving `npm test` and `npm run build` green.

## M0 — Scaffold

- Vite + React + TS strict + Tailwind + Vitest + ESLint configured; folder layout from ARCHITECTURE.md created with placeholder files.
- `src/domain/types.ts` implements DATA_MODEL.md verbatim.
- CI-ready scripts: `dev`, `build`, `test`, `lint`.
- **AC**: `npm run build` and `npm test` (one trivial test) pass; no `any`; README quick start works.

## M1 — Domain core + persistence + legacy bridge

- `domain/derive.ts`: cell map and teacher-occupancy map selectors.
- `domain/validate.ts`: H1–H6, H8–H10 (H7 reported as quota status, not error, until generation exists).
- `domain/legacyExport.ts` + `domain/legacyImport.ts`: parse the existing viewer's `rawData` text into a `Project` (best-effort: infers teachers/subjects/classes, detects ELGA rows into one `BlockActivity`), and export back.
- `persistence/`: IndexedDB save/load, JSON project file import/export.
- `fixtures/vpps.sample.ttproj.json`: built by running legacyImport on a snapshot of the real rawData.
- **AC**: round-trip test — import real rawData → export → semantically identical text. Validation unit tests cover every implemented H-rule, incl. the ELGA worked example in CONSTRAINTS.md. ELGA detected as a single block with 5 teachers, 5 classes, length 3.

## M2 — Constraint-aware editor (the core product)

- Timetable grid: classes × periods for a selected day (and a teacher-view toggle), drag-drop placement of lessons from a requirement palette, click-to-pin.
- Live validation on every change (< 16 ms): red badges (hard) and amber badges (soft) with human-readable messages from `Violation[]`.
- Teacher load panel (periods/day, periods/week vs caps) and per-class quota panel (placed vs required).
- Undo/redo (editorStore history), autosave to IndexedDB.
- **AC**: placing Kusum opposite an ELGA block flags H1 instantly; moving an ELGA block moves all 15 cells atomically; undo restores exact prior state; refresh restores from IndexedDB.

## M3 — Auto-complete solver

- `solver/engine.ts` + worker per ARCHITECTURE.md; "Complete this timetable" button: pins stay, gaps fill.
- Progress UI with cancel; results applied as a new draft (never overwrite the user's draft silently).
- **AC**: on the VPPS fixture with ELGA pinned and ~30% of cells cleared, solver reaches 0 hard violations in < 5 s in a Vitest run (Node, no worker) with a fixed seed; deterministic across runs with the same seed; cancel works.

## M4 — Full generation + candidate compare

- Generate N candidates (different seeds), side-by-side compare with scores and violation diff; pick one as active.
- Soft-constraint weight editor (S1–S6).
- **AC**: 3 candidates generated for the fixture, all feasible, visibly different; chosen candidate becomes the active timetable; weights change ranking deterministically.

## M5 — Substitution assistant

- Mark teachers absent for a date; engine proposes per-period covers from free, qualified teachers, respecting H1/H5/H9 and minimizing S1/S4 disruption; output a printable day sheet.
- **AC**: marking any one primary teacher absent on an ELGA day flags the ELGA block as needing explicit owner decision (cannot auto-cover an ELGA level silently).

## M6 — Ship

- Export: legacy rawData (copy/paste + file download) for the existing viewer, JSON backup, print stylesheet.
- PWA: manifest + service worker (cache-first shell), offline-capable.
- Deploy: GitHub Pages workflow (or Firebase Hosting); document in README.
- **AC**: Lighthouse PWA installable; full flow works offline; exported rawData pasted into the legacy viewer renders correctly.

---

# v2 — Usability & solver overhaul (post-ship review, 2026-06-05)

Live review of v1 found: no way to enter school data in the UI (only file import), boots into a conflicted 2-day synthetic sample labeled "infeasible", developer jargon throughout, noisy grid, and a solver driven by fixture-derived (circular) requirements instead of real quotas. v2 fixes product usability on top of the sound v1 core. Same rules: strict order, AC-gated.

## M7 — Real data in: onboarding + data manager

The single biggest gap: a user must be able to build their school inside the app.

- First-run empty state with three clear paths: **Set up my school** (wizard) / **Import existing timetable** (legacy rawData or JSON) / **Explore demo**.
- Setup wizard (stepper): 1) school + days + periods/timings (ScheduleProfile editor) → 2) classes → 3) teachers (subjects taught, daily/weekly caps, unavailable slots) → 4) per-class subject quotas (CurriculumRequirement editor with a periods/week grid) → 5) blocks (ELGA: classes, teachers, length, allowed days/start).
- Persistent left-nav sections: Timetable, Teachers, Classes, Subjects & Quotas, Blocks, Settings — full CRUD on every entity (`ui/manage/`, per ARCHITECTURE.md).
- Replace the conflicted 2-day sample: demo = clean 6-day dataset built from the real viewer rawData snapshot (also closes the v1 real-data round-trip gap). Never auto-load the demo into a returning user's project.
- Quota dashboard: per class × subject, placed vs required, with shortfall/excess chips; same data feeds the solver in M9.
- **AC**: a fresh user can create teachers/classes/quotas and see a full Mon–Sat grid without touching files or docs; importing the real VPPS rawData shows 6 days with zero hard conflicts; refresh persists everything.

## M8 — UI overhaul: modern app shell + readable grid

- App shell: left sidebar nav, top bar = project name + draft/timetable switcher + primary actions; modals close on Escape and overlay click; full keyboard navigation; responsive down to tablet (teachers check phones — read-only grid must work on mobile).
- Grid redesign: subject color coding (port the viewer's palette idea); compact cells (subject + abbreviated teacher, full detail in popover); **ELGA rendered as one merged band** spanning Classes 1–5 × its periods instead of 15 duplicate cells; pin = subtle corner dot, not an emoji per cell.
- Plain-language everywhere: "Complete (seed 1)" → **"Fill the gaps"**; "Generate…" → **"Create timetables"**; seeds/scores behind an "Advanced" disclosure; S1–S6 → sentence-labeled sliders ("Keep teachers' days compact", "Spread a subject across the week"); conflict messages as sentences with **click-to-jump-to-cell** ("Rashmita is in Class 2 and Class 3 at Mon P1 — view both").
- Views: per-class week view and per-teacher week view (not just whole-school day view); free-slot highlighting.
- Status header shows human state ("Draft · 2 conflicts to fix", never "seed 14, infeasible").
- **AC**: five tasks completable by a non-technical user without docs — change a lesson, find out why a cell is red and fix it, fill gaps, print a teacher's week, mark a teacher absent. Escape closes every modal. ELGA appears once as a band per day.

## M9 — Solver v2: real requirements, explainable results

- Solver input = owner-authoritative quotas from M7 (delete `deriveRequirements` circularity; keep it only as a one-time "infer quotas from imported timetable" suggestion the user confirms/edits).
- Engine upgrade: constraint propagation (forward-checking on teacher/class domains) + min-conflicts repair phase + soft optimization with random restarts within budget.
- **Never silently apply an infeasible result.** Infeasible → a blocker report: which constraints can't be met, which entities are over-committed (e.g. "Kusum is required for 8 periods on Mon but only 6 exist"), and concrete relaxation suggestions. Feasible-but-poor → show soft-violation summary before applying.
- Candidate compare v2: visual diff grid (changed cells highlighted), per-teacher load delta, soft-violation breakdown — scores demoted to advanced.
- "What-if" affordances: freeze a day, lock a teacher's day, regenerate the rest.
- **AC**: with real VPPS quotas entered, a full 6-day feasible timetable generates in < 10 s; deliberately over-constrained input yields a readable blocker report naming the bottleneck (verified by test); candidate diff renders correctly for a changed cell.

## M10 — Trust & polish

- First-run guided tour (coach marks on grid, conflicts panel, fill-gaps); inline "?" help per screen.
- Amber soft-violation badges in the grid (wire `scoreTimetable().soft` into the overlay — known v1 TODO); teacher-gap visualization in Teacher View.
- Print layouts: master grid, per-class sheet, per-teacher sheet, substitution day sheet.
- Undo toast ("Moved Maths · Undo"), autosave indicator.
- **AC**: Lighthouse a11y ≥ 90; soft violations visible in-grid; all four print layouts correct.

---

# v3 — Make it truly non-technical (owner review #2, 2026-06-05)

v2 shipped its ACs, but a second owner review + source audit found the product still assumes a technical user. Root causes: (a) storage failure bricks the app to an infinite "Loading…" (reproduced live — no timeout, no error screen, no reset); (b) the setup wizard uses developer idioms — newline textarea for classes, comma-separated subjects, and quotas added ONE ROW AT A TIME (~100 rows for VPPS: impractical); (c) the ELGA/block step promised in M7 was deferred out of the wizard; (d) everything is a modal over one screen — the M7/M8 "persistent left-nav" was never built; (e) the demo is synthetic while the REAL school data now exists in-repo. v3 fixes these. Strict order, AC-gated, marathon rules apply.

## M11 — Storage resilience (never brick)

- Render the app shell immediately; load IndexedDB in the background. `openDb` wrapped with a ~3 s timeout.
- On open timeout/error: a recovery screen (not a dev message): "We couldn't open your saved data" with three actions — **Try again**, **Download a backup** (if a read succeeds via a fresh attempt), **Start fresh** (deleteDatabase + reload), plus a tip to try closing other tabs of this site.
- Autosave failures surface as a non-blocking banner ("Changes aren't being saved — download a backup"), never silent.
- **AC**: a test simulating a never-resolving `indexedDB.open` renders the recovery screen (fake timers); "Start fresh" produces a working empty state; no code path can leave the user on "Loading…" for more than ~4 s.

## M12 — Real VPPS data as the spine

- `docs/sources/rawData.vpps.txt` (real, full 6-day snapshot, now in-repo) becomes the real-data fixture: add the semantic (tolerant) round-trip test that v1/v2 deferred; fix anything it flushes out (multi-teacher cells, "English compulsory", senior streams).
- Demo = the real VPPS school (16 classes, 6 days). Drop the synthetic demo or keep it only for tests.
- Import → **quota confirmation flow**: after a legacy import, show inferred quotas as an editable review screen ("Class 1 gets Maths 6×/week with Bindu — keep/adjust"), then normalize. The user confirms reality instead of typing it from scratch.
- **AC**: importing the snapshot yields 6 day-tabs, 16 classes, 0 hard conflicts, ELGA as bands; semantic round-trip test green; inferred-quota review screen shown and editable after import.

## M13 — Pages, not modals + the quota matrix

- Left sidebar navigation with real views (hash-routed): **Timetable · Teachers · Classes · Subjects & Quotas · Blocks · Substitutions · Settings**. Modals remain only for confirmations and the wizard. Mobile: sidebar collapses to a bottom nav/hamburger.
- **Quota matrix editor** (the make-or-break screen): grid of classes × subjects with number cells; per-class running total vs available slots ("31 of 36 periods planned"); assign a teacher per class-subject from the cell; bulk tools — copy one class's quotas to others, fill a subject column. No more one-row-at-a-time.
- Wizard v2: chips/tag inputs replace newline/comma textareas; inline validation messages (why Next/Finish is disabled); **Blocks step added** (define ELGA: classes, teachers, length, days) as M7 originally specified; wizard progress autosaved.
- **AC**: full VPPS data (16 classes, ~19 teachers, quotas) enterable from scratch in under 15 minutes using matrix + bulk tools (scripted walkthrough test of the flow); every sidebar view reachable on a 390 px viewport; zero textarea-based data entry left.

## M14 — Guided experience + pre-flight

- First-run guided tour (coach marks: grid → conflicts → fill gaps → print) — the M10 item that wasn't delivered; dismissible, replayable from Settings.
- "Next step" hints in the header driven by project state: no quotas → "Add weekly subject quotas"; quota shortfall → "Class 7 has 4 unplanned periods"; conflicts → "2 clashes to fix — tap to see".
- Generate pre-flight: one **Create timetable** CTA runs a readable checklist first (quota sums vs slots, teacher capacity vs demand, block fit) and explains any blocker in a sentence before the solver runs.
- Plain-language glossary popovers (quota, block, draft, pin) on first encounter.
- **AC**: a deliberately under-quota'd project shows the right hint and the pre-flight names the class and the missing count; tour renders on a fresh project and never again unless replayed; a non-technical tester (the owner) completes import → adjust → generate → print unaided.

## Parked (post-v3)

Rooms/labs, multi-school config, teacher preference forms, statistics dashboard, share links.
