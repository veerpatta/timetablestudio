# HANDOFF — living session state

This file is the bridge between work sessions. The agent MUST update it after every completed milestone and before ending any session (see AGENTS.md § 6). Keep it short and current — it describes NOW, not history (history lives in git log and DECISIONS.md).

---

## Current state

- **Last completed milestone**: M2 — constraint-aware editor. 41 tests green; `npm run build` (68 KB gzip) and `npm run lint` clean. Verified visually in the dev server (ELGA renders as one pinned indigo block P3–P5; no console errors).
  - `domain/edit.ts` — pure move/pin/remove/add placement ops (immutable).
  - `store/projectStore.ts` — Project source of truth + debounced IndexedDB autosave + `init()` (load-or-seed-sample).
  - `store/editorStore.ts` — day/view/selection + undo/redo over immutable snapshots, commits via projectStore.
  - `ui/grid/gridModel.ts` (pure) + `TimetableGrid.tsx` — class & teacher views, dnd-kit drag-to-move (within a day), click-to-pin, per-cell hard/soft conflict overlay.
  - `ui/panels/` — ViolationsPanel, TeacherLoadPanel, QuotaPanel. `ui/app/App.tsx` shell + `hooks.ts` (memoized derived data).
  - All four M2 AC proven by tests: Kusum-vs-ELGA → H1 instantly (store + jsdom App test); ELGA block moves 15 cells atomically; undo restores exact prior Project (`toEqual`); IndexedDB save→load restores (fake-indexeddb).
  - M1 carryover still green (derive/validate/legacy bridge/persistence/fixture).
- **In-progress milestone**: M3 (not started)
- **Tests**: green — 41 tests across 10 files
- **Build**: green — typechecks + builds (68 KB gzip)

## Next action

Start M3 (auto-complete solver): implement `solver/types.ts`, `solver/score.ts` (soft S1–S6 + hard×10000, CONSTRAINTS.md § Scoring), `solver/engine.ts` (seeded mulberry32 PRNG; place blocks first; backtracking with most-constrained-variable ordering + seed-randomized value order; min-conflicts repair; `maxMillis`/`maxIterations` budgets; H10 = freeze `pinned` placements). Then `worker/solver.worker.ts` message protocol (ARCHITECTURE.md) and `ui/solverui/` "Complete this timetable" button with progress + cancel; apply results as a NEW draft timetable (never overwrite). First concrete step: `solver/engine.ts` `solve(project, timetableId, {mode:"complete", seed, maxMillis})` returning `{placements, score, violations, seed}`, with a Vitest (Node, no worker) test: VPPS fixture, ELGA pinned, ~30% cells cleared → 0 hard violations in < 5 s, deterministic per seed. NOTE: `requirements.curriculum` is empty on the sample — M3 needs requirement data to know what to place. Define fixture requirements derived from the sample's existing lessons (each placed lesson ⇒ its class/subject/teacher quota) so "clear 30% then re-complete" is well-posed; mark as fixture-derived, not owner-authoritative.

## Mid-milestone notes (empty if between milestones)

(between milestones)

- IMPORTANT honest claim: the M1 round-trip is an EXACT-string match against a canonical-format fixture written to the DATA_MODEL.md spec — NOT against real legacy-viewer output (no snapshot exists in this repo). A real-data round-trip will need a semantic compare; the true "paste into the legacy viewer" end-to-end check is the M6 AC. If a real `rawData` snapshot arrives, add it as a second fixture and a tolerant comparison.
- `domain/` + `solver/` tests run under Node (Vitest default); UI tests will auto-use jsdom via `environmentMatchGlobs` (`src/ui/**`). Keep validate() pure.

## Open questions for the owner

1. Per-class subject quotas (periods/week of each subject per class) — needed before M3; M1–M2 can use fixture estimates clearly marked TODO.
2. Teacher max loads and unavailable slots — defaults in DATA_MODEL.md apply until specified.
3. Which days carry the ELGA block, and is start period P3 fixed?

## Known TODOs / stubs in code

- `domain/legacyImport.ts` — block detection is keyed on the literal "ELGA" subject token; generalize only if a second block type appears (DECISIONS).
- No real `rawData` snapshot — `fixtures/legacyRaw.sample.ts` is synthetic-but-faithful; replace/augment when the owner provides one.
- `requirements.curriculum` is empty on import — quotas (H7/H8) inert until the owner supplies per-class subject quotas (Open question 1).

---

## Template (replace sections above; do not append)

- Last completed milestone + one-line proof (e.g. "M2 — all AC pass, 47 tests green")
- In-progress milestone + exactly where you stopped
- Tests / build status (green/red, counts)
- Next action: the single concrete first step for the next session
- Mid-milestone notes: tricky context the next session needs (gotchas, half-done refactors)
- Open questions / TODO stubs: anything blocked on the owner
