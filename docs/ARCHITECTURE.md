# Architecture

## Stack (decided)

- **Vite + React 18 + TypeScript (strict)** — generator UI needs drag-drop grid, undo, live validation; a framework is justified here (unlike the vanilla viewer).
- **Zustand** — app state; small, no boilerplate.
- **dnd-kit** — drag-and-drop on the grid.
- **Tailwind CSS** — styling.
- **idb** — IndexedDB wrapper for persistence.
- **Vitest + @testing-library/react** — tests.
- **Web Worker** — hosts the solver; communicates via typed messages.
- **No backend.** Deploy `dist/` to GitHub Pages or Firebase Hosting (free tier).

## Folder layout

```
src/
  domain/          # PURE. types.ts, derive.ts (cell/occupancy maps), validate.ts, legacyExport.ts
  solver/          # PURE. engine.ts (backtracking + min-conflicts), score.ts, types.ts
  worker/          # solver.worker.ts — message protocol wrapper around solver/
  persistence/     # db.ts (idb), projectFile.ts (JSON import/export), migrations.ts
  store/           # Zustand stores: projectStore.ts, editorStore.ts (selection, undo)
  ui/
    grid/          # TimetableGrid, Cell, DragLayer, ConflictBadge
    panels/        # TeacherLoadPanel, ViolationsPanel, RequirementsPanel
    manage/        # CRUD screens: teachers, classes, subjects, requirements, profiles
    solverui/      # GenerateDialog, CandidateCompare, ProgressBar
    app/           # routing/shell/theme
  fixtures/        # vpps.sample.ttproj.json + small synthetic projects for tests
```

Layering rule (enforced in review): `domain` ← `solver` ← (`worker`, `store`) ← `ui`. Arrows show allowed import direction; never the reverse. `domain` and `solver` import neither React nor browser APIs.

## Validation = the shared core

`domain/validate.ts` is one pure function used by BOTH:

- the editor (run on every placement change, debounced; renders red/amber badges), and
- the solver (feasibility oracle + scoring via `solver/score.ts`).

Never implement conflict logic twice.

## Solver design (`solver/engine.ts`)

Problem size: ≤ 14 classes × 6 days × 6 periods = 504 cells; ~19 teachers. Small enough for exact-ish search with good heuristics.

1. **Seeded PRNG** (mulberry32) — full determinism per seed.
2. **Place blocks first** (ELGA): fewest options, biggest footprint.
3. **Backtracking** over unplaced requirement-periods, ordering by most-constrained-variable (fewest legal slots first); value order randomized by seed for candidate diversity.
4. **Min-conflicts repair + soft optimization**: after a feasible assignment, hill-climb with random restarts on the soft score within a time budget.
5. **Budgets**: `maxMillis` (default 4000) and `maxIterations`; always return best-so-far + violations, never hang.
6. **Auto-complete mode** = same engine with `pinned` placements frozen (H10) and only missing requirement-periods as variables.

## Worker protocol (`worker/solver.worker.ts`)

```ts
// requests
{ type: "solve", project, timetableId, mode: "complete" | "generate",
  seed, maxMillis }
{ type: "cancel" }
// responses
{ type: "progress", iteration, bestScore, hardViolations }   // throttled ~4/s
{ type: "done", placements, score, violations, seed }
{ type: "error", message }
```

UI must stay responsive; cancel must work mid-solve.

## Performance budgets

- Validation pass < 16 ms at VPPS scale (it runs on every edit).
- Auto-complete typical < 5 s; full generation of one candidate < 10 s.
- Bundle < 300 KB gzipped (no heavy deps — this is why no solver libraries).

## Out of scope for v1 (do not build unless asked)

Rooms/labs, multi-school multi-tenancy, accounts/auth, server sync, mobile-native, i18n.
