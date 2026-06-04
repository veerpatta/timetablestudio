# HANDOFF — living session state

This file is the bridge between work sessions. The agent MUST update it after every completed milestone and before ending any session (see AGENTS.md § 6). Keep it short and current — it describes NOW, not history (history lives in git log and DECISIONS.md).

---

## Current state

- **Last completed milestone**: M0 — scaffold complete. `npm run build` (tsc --noEmit + vite build, 46 KB gzip), `npm test` (1 test green), `npm run lint` (clean, no-explicit-any enforced) all pass.
- **In-progress milestone**: M1 (not started)
- **Tests**: green — 1 test (src/domain/types.test.ts)
- **Build**: green — typechecks + builds

## Next action

Start M1: implement `domain/derive.ts` (cell map + teacher-occupancy map selectors), then `domain/validate.ts` (H1–H6, H8–H10; H7 as quota status). Then `legacyImport`/`legacyExport` with the rawData round-trip, `persistence/` (idb + JSON file), and build `fixtures/vpps.sample.ttproj.json` from a real rawData snapshot. The hard part is detecting repeated `ELGA (Bindu / Anita / Rashmita / Kusum / Ravina)` rows back into ONE BlockActivity (5 classes × 5 teachers × length 3).

## Mid-milestone notes (empty if between milestones)

(between milestones)

NOTE for M1: need a real `rawData` snapshot from the legacy viewer to build the fixture and the round-trip test. Not present in this repo. If unavailable, construct a faithful synthetic rawData fixture (clearly marked) that exercises ELGA-row detection + multi-teacher cells, and record it as an Open question / TODO. The round-trip test (export → parse → compare) does not require the real data, only an internally consistent fixture.

## Open questions for the owner

1. Per-class subject quotas (periods/week of each subject per class) — needed before M3; M1–M2 can use fixture estimates clearly marked TODO.
2. Teacher max loads and unavailable slots — defaults in DATA_MODEL.md apply until specified.
3. Which days carry the ELGA block, and is start period P3 fixed?

## Known TODOs / stubs in code

(none)

---

## Template (replace sections above; do not append)

- Last completed milestone + one-line proof (e.g. "M2 — all AC pass, 47 tests green")
- In-progress milestone + exactly where you stopped
- Tests / build status (green/red, counts)
- Next action: the single concrete first step for the next session
- Mid-milestone notes: tricky context the next session needs (gotchas, half-done refactors)
- Open questions / TODO stubs: anything blocked on the owner
