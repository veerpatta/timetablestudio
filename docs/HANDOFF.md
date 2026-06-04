# HANDOFF — living session state

This file is the bridge between work sessions. The agent MUST update it after every completed milestone and before ending any session (see AGENTS.md § 6). Keep it short and current — it describes NOW, not history (history lives in git log and DECISIONS.md).

---

## Current state

- **Last completed milestone**: M4 — full generation + candidate compare. 60 tests green; `npm run build` (71 KB gzip main + worker chunk) and `npm run lint` clean. Verified end-to-end in the dev server: "Generate…" produces 3 feasible distinct candidates (scores 96/143/148), cranking the S1 weight re-ranks them (2↔3 flip), "Use" applies the pick as the active "Generated (seed 1)" draft; no console errors.
  - `solver` "generate" mode (base = pinned only) already existed; M4 added `generate.test.ts` (3 seeds → 3 feasible visibly-different candidates on a roomy 6-day variant) + a deterministic weight-flip test in `score.test.ts`.
  - `store/weightsStore.ts` (SoftWeights, defaults from CONSTRAINTS.md) + `ui/solverui/WeightEditor.tsx`.
  - `ui/solverui/CandidateCompare.tsx` — modal: generate N candidates via the worker, RE-SCORE on the main thread with live weights (instant re-rank), pick → `addDraft` active. Wired into the App toolbar ("Generate…").
  - M0–M3 carryover still green (incl. M3 oracle fix, solver, editor, legacy bridge).
- **In-progress milestone**: M5 (not started)
- **Tests**: green — 60 tests across 16 files
- **Build**: green — typechecks + builds (71 KB gzip main, separate worker chunk)

## Next action

Start M5 (substitution assistant): mark teacher(s) absent for a date; engine proposes per-period covers from FREE, QUALIFIED teachers, respecting H1/H5/H9 and minimizing S1/S4 disruption; output a printable day sheet. AC: marking any one primary teacher absent on an ELGA day flags the ELGA block as needing an explicit owner decision (cannot auto-cover an ELGA level silently). First concrete step: a pure `domain/substitution.ts` (or `solver/substitute.ts`) `proposeSubstitutions(project, timetableId, { day, absentTeacherIds })` returning per-(class,period) cover suggestions + an `elgaConflict` flag when an absent teacher is in a block placed that day. Test the ELGA-absent → needs-owner-decision case first (it's the AC), then free/qualified candidate ranking by S1/S4 disruption. Then a `ui/` substitution view + print stylesheet (print stylesheet also feeds M6). NOTE: substitution is read-only over an existing timetable — do NOT mutate the draft; produce a separate cover plan.

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
- Soft constraints (S1–S6) drive scoring + the weight editor + candidate ranking, but are NOT shown as per-cell amber badges in the editor grid (the grid overlay only reflects `validate()` hard violations). Optional polish; wire `scoreTimetable().soft` into `gridModel` overlay if desired.
- "generate" mode reaches 0 hard on both the roomy 6-day variant (tested) and the live 2-day sample (verified in-app); diversity is limited on the rigid 2-day data (expected).

---

## Template (replace sections above; do not append)

- Last completed milestone + one-line proof (e.g. "M2 — all AC pass, 47 tests green")
- In-progress milestone + exactly where you stopped
- Tests / build status (green/red, counts)
- Next action: the single concrete first step for the next session
- Mid-milestone notes: tricky context the next session needs (gotchas, half-done refactors)
- Open questions / TODO stubs: anything blocked on the owner
