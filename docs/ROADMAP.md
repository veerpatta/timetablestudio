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

## Parked (post-v2)

Rooms/labs, multi-school config, teacher preference forms, statistics dashboard, share links.
