# HANDOFF — living session state

This file is the bridge between work sessions. The agent MUST update it after every completed milestone and before ending any session (see AGENTS.md § 6). Keep it short and current — it describes NOW, not history (history lives in git log and DECISIONS.md).

---

## Current state

- **Last completed milestone**: M3 — auto-complete solver. 53 tests green; `npm run build` (69 KB gzip main + 12 KB worker chunk) and `npm run lint` clean. Verified end-to-end in the dev server: clicking "Complete" runs the worker, applies a new feasible "Auto-completed (seed 1)" draft, ELGA pins preserved, no console errors.
  - `solver/prng.ts` (mulberry32 + seeded shuffle), `solver/types.ts`, `solver/score.ts` (hard×10000 + soft S1–S6 weighted), `solver/engine.ts` (seeded backtracking, dynamic MCV, fill-only complete mode, budgets, cancel).
  - `domain/requirements.ts` — derive requirements + canonical lessons from a timetable; `normalizeProject`. `makeSampleProject` now returns the normalized sample.
  - `worker/protocol.ts` + `worker/solver.worker.ts` (message protocol); `ui/solverui/runSolver.ts` (worker wrapper, cancel = terminate) + `CompleteButton.tsx`; `projectStore.addDraft` (apply result as a new draft, never overwrite).
  - ORACLE FIX: `validate` H1/H2 now count raw occupancies (was deduping by activityId) — required by the canonical-lesson-placed-N-times model. Regression test added.
  - All M3 AC proven by tests: 30%-cleared fixture → 0 hard via the real `validate()` in ~15 ms (<5 s); deterministic per seed (`toEqual`); cancel returns promptly + incomplete; pins (ELGA) preserved.
  - M0–M2 carryover still green.
- **In-progress milestone**: M4 (not started)
- **Tests**: green — 53 tests across 14 files
- **Build**: green — typechecks + builds (69 KB gzip main, separate worker chunk)

## Next action

Start M4 (full generation + candidate compare): use the existing `solver` "generate" mode (base = pinned only, variables = full periodsPerWeek per requirement — already implemented, needs UI). Generate N candidates from different seeds (run the worker N times or one worker sequentially), show side-by-side scores + violation diff, let the user pick one as the active timetable. Add a soft-constraint weight editor (S1–S6) that feeds `SoftWeights` into `scoreTimetable` so changing weights re-ranks candidates deterministically. First concrete step: a `solver` test proving 3 seeds produce 3 feasible, visibly-different candidates for the normalized fixture, then `ui/solverui/CandidateCompare.tsx` + a weights store. NOTE: confirm "generate" mode reaches 0 hard on the normalized sample (only Mon/Tue, primary classes are tightly packed — generate from only-pinned may need the full backtracker to succeed; if it struggles, keep complete-mode semantics and seed diversity via value ordering). Soft amber badges in the editor can also be wired now (scoreTimetable already returns soft Violation[]).

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
- Solver requirements are FIXTURE-DERIVED (`deriveRequirements` reads them off the sample timetable), not owner-authoritative quotas. Replace with real per-class subject quotas when the owner provides them (Open question 1). `maxPerDay` is inferred as `max(2, observed/day)`.
- Soft constraints (S1–S6) are computed in `solver/score.ts` but NOT yet shown as amber badges in the editor, and weights are fixed defaults (weight editor is M4).
- "generate" mode exists but its 0-hard feasibility on the normalized sample is unverified (M4); only "complete" mode is covered by tests.

---

## Template (replace sections above; do not append)

- Last completed milestone + one-line proof (e.g. "M2 — all AC pass, 47 tests green")
- In-progress milestone + exactly where you stopped
- Tests / build status (green/red, counts)
- Next action: the single concrete first step for the next session
- Mid-milestone notes: tricky context the next session needs (gotchas, half-done refactors)
- Open questions / TODO stubs: anything blocked on the owner
