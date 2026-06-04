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

## Parked (post-v1)

Rooms/labs, multi-school config, teacher preference forms, statistics dashboard, share links.
