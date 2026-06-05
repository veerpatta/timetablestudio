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

---

# v4 — The real workflow: rules + scenario workbench (owner deep-dive, 2026-06-05)

Owner supplied the REAL working timetable as PDFs (docs/sources/*.pdf) and stated the true use case: **iterate on the existing timetable over the session** — not generate-from-scratch. Deep analysis in docs/TIMETABLE_ANALYSIS.md found seven implicit constraint families (P1 class-teacher anchors, ELGA Mon–Thu only, intentional double periods, heavy-early/light-late, board-class protection, specialist teacher coupling, subject spread). The fixed S1–S6 set cannot express these → v4 builds the configurable Rule system (CONSTRAINTS.md § v4) and the what-if workbench. Strict order, AC-gated; marathon rules + Prompt C/D additions apply.

## M15 — Domain: rules, anchors, doubles, block days

- `Rule` entity (DATA_MODEL.md addendum to be written in the same commit, per the doc-first rule): template id R1–R15, params, severity must/prefer, weight; compiled to predicates reusing `Violation`; rules evaluated in both `validate()` (musts) and `scoreTimetable()` (prefers).
- Activities support `duration: 2` (double periods placed/moved/deleted as one unit; H-checks treat them atomically like mini-blocks).
- Blocks gain `allowedDays` + optional `fixedStartPeriod` (ELGA Mon–Thu @P3).
- Class-teacher field on SchoolClass (`classTeacherId`) powering R4; board-class flag powering R9.
- Schedule profile supports a positioned break (after P4, 10:10–10:25) and per-period times as data.
- Schema migration v2 with back-compat load of v1 projects.
- **AC**: each rule template R1–R15 has a unit test (satisfied + violated case, plain-language message); a duration-2 activity moves as one unit; v1 project file loads and migrates.

## M16 — Rules UI: plain-language rule builder

- "Rules" sidebar section: rule list as readable sentences with on/off toggles and must/prefer chips; "Add rule" = template picker → fill-in-the-blanks sentence (pickers for subject/class/teacher/periods/days) — modeled on how aSc/Untis express constraints but sentence-first, zero jargon.
- Violations panel groups by rule and explains in the rule's own words ("CCS is in Period 1 on Tue for Class 8 — rule says never in P1") with click-to-jump.
- **Import auto-detection**: importing the real timetable proposes detected rules (P1 anchors, doubles, ELGA days, board flags) as pre-filled sentences for one-click accept — the owner confirms reality instead of authoring from scratch.
- Presets bundle: "Indian K-12 defaults" (heavy-early, light-not-P1, spread ≥3 days, teacher caps) applied optionally at setup.
- **AC**: the seven implicit VPPS constraint families are all expressible via the UI without code; auto-detect on the real import proposes ≥ the P1 anchors, ELGA days and 12-Commerce Accountancy double; every violation message names entities and slots.

## M17 — Scenario workbench: explore changes safely

- "Try a change" mode: any draft can be branched (one click), edited/regenerated, and **compared side-by-side** with the live timetable — diff grid plus a change ledger ("3 cells changed · fixes 2 problems · creates 1 new problem · Hemlata gains a free P6 Tue").
- **Impact preview on hover/drop**: before committing a drag, show what it would break/fix (reuses validate on a speculative copy).
- **Swap finder**: select a cell → "show legal swaps" lists conflict-free exchanges (the everyday operation when a teacher requests a change).
- Targeted regenerate: freeze everything except a selection (class, teacher, day, or subject) and re-solve only that — marginal change, not big-bang.
- Promote: a branch replaces the live timetable (with undo); export as usual.
- **AC**: branch→edit→compare→promote loop works with full undo; swap finder returns only swaps that keep hard violations at 0 (property test); targeted regenerate changes ONLY the unfrozen scope.

## M18 — Real-data reconciliation + everyday ops polish

- Reconcile the app's dataset with the PDFs (subjects missing from rawData: CCS, Revision, practices, Sanskrit, streams' electives; the break; board flags; anchors) so the in-app timetable equals the printed truth.
- Entity lifecycle ease: add/remove/rename teacher, subject, class, period count — each with a guided impact flow ("Removing Maya affects 11 placements — reassign to whom?").
- Period-count change wizard (6→7 or 6→5) remapping placements with explicit owner decisions.
- Print/export parity with the current PDFs (class-wise, teacher-wise, day-wise sheets).
- **AC**: in-app grid matches Class_Wise.pdf cell-for-cell after reconciliation (scripted comparison against a transcribed fixture); removing a teacher walks through reassignment without ever leaving a dangling reference; the three print views visually match the school's current formats.

---

# v5 — Zero-setup + zero-noise: the owner's daily driver (owner review #3, 2026-06-05)

Live review after v4: (a) **returning browsers keep their old stored project forever** — the M18 reconciled real dataset never reaches an existing user, so the owner sees a stale synthetic timetable and thinks the data is wrong; (b) the suggestions panel is a flood (275 raw lines, "Bindu uneven daily load" ×3, `[S1]` codes leaking outside Advanced) — exactly the "too complex" feeling; (c) insights exist but aren't glanceable (no load heatmap, no fairness view, no free-teacher finder); (d) everything the owner asked for ("play with it, most work automatic") needs suggestions to be *actionable*, not descriptive. Strict order, AC-gated, all prior prompt rules apply.

## M19 — The school timetable IS the app (zero setup)

- Bundle the PDF-true VPPS dataset (data + detected rules R1–R15, board flags, anchors, ELGA config) as the built-in default project with a `bundledDataVersion`.
- First run: open straight into the real timetable — full grid, 0 conflicts, rules pre-enabled. The empty-state/wizard moves behind "Start a different school" (Settings / File).
- Stale-data detection: if the stored project derives from an older bundled version, show a banner — "The built-in school timetable has been updated. Load the latest? (your current one is kept as a draft)". One click migrates; nothing is silently overwritten.
- Settings: "Reset to school timetable" (always available, undoable via the kept draft).
- **AC**: a cleared browser shows the real timetable (cell-for-cell vs the M18 fixture) with rules on and 0 conflicts, with NO user action; a simulated older stored project triggers the banner and the one-click update keeps the old timetable as a draft.

## M20 — Health panel: 275 lines → 5 actions

- **Health score 0–100** in the header (soft-weight based, plain words: "Good — 3 things could be better"), replacing raw counts.
- Suggestion pipeline: dedupe → group by person/class ("Bindu: 2 idle gaps · uneven Mon/Tue load — view") → rank by impact → show top 5 with "Show me" (jump + highlight) on every item.
- **"Fix it" on suggestions where a safe fix exists**: precompute the best conflict-free swap/move; clicking shows a mini diff ("Move Tue P4 Maths → Tue P2; Bindu's gap disappears") and applies with one click, fully undoable.
- **"Tidy up" button**: scoped soft-optimization pass (musts frozen, budgeted) that presents its whole result as a change ledger to accept/reject — "most of the work done automatically", but never behind the owner's back.
- No constraint codes anywhere outside Advanced (regression test on rendered strings).
- **AC**: the bundled project shows ≤ 20 grouped suggestions and a top-5; at least 60% of top-5 items on the bundled data carry a working "Fix it"; one undo reverts any fix; Tidy-up improves the health score on the bundled data and applies only after accept.

## M21 — Glanceable insights (modern teacher-load views)

- Teachers page upgrades: **load heatmap** (teacher × day, intensity = periods), week total vs cap bars, gap count, P1/P6 duty counts, **fairness meter** (spread across teachers) — the "teacher load" modern view the owner asked for.
- **Free-teacher finder**: pick any (day, period) → who is free, sorted by lightest load (also powers substitutions).
- Click any teacher chip anywhere → highlight all their cells across the grid + a mini day-strip popover.
- Class insights: subject-mix bar per class (planned vs quota), heaviest-day indicator.
- **AC**: heatmap numbers equal derive() counts (property test); free-teacher finder excludes everyone occupied incl. blocks; teacher-click highlighting works from grid, panels, and heatmap.

## M22 — Constraint catalog v2 + auto-tuning

- Implement rule templates **R16–R24** (CONSTRAINTS.md § v5): teacher free day, fair first/last duties, no same-day repeats, heavy-pair separation, after-break slotting, max teachers/day for juniors, teacher preferred periods, consecutive-class cap, practice-after-theory.
- **Weight presets**: "Teacher comfort" / "Student focus" / "Board exam mode" — one click re-weights prefer-rules (data-driven, shown as sentences).
- **"Suggest rules"**: scan the current timetable for strong patterns not yet captured as rules (like the M16 import-detection, but runnable anytime) and propose them as pre-filled sentences.
- **AC**: each new template has satisfied+violated tests with plain-language messages; presets change candidate ranking deterministically; Suggest-rules on the bundled data proposes ≥ 3 sensible candidates and zero already-existing duplicates.

## Parked (post-v5)

Rooms/labs, multi-school config, teacher preference forms, statistics dashboard, share links, mid-week timetable versioning (effective-from dates).
