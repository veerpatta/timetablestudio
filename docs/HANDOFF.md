# HANDOFF — living session state

This file is the bridge between work sessions. The agent MUST update it after every completed milestone and before ending any session (see AGENTS.md § 6). Keep it short and current — it describes NOW, not history (history lives in git log and DECISIONS.md).

---

## Current state

- **Last completed milestone**: M10 — Trust & polish. **v2 roadmap (M7–M10) COMPLETE.** 105 tests green; `npm run build` (87 KB gzip) and `npm run lint` clean. Verified live on the demo: 9 amber soft-suggestion cells (0 red), modal focus trap works, week sheet is printable; no console errors.
  - **AC met**: (1) a11y — shared `Modal` focus trap + restore; all icon buttons labelled; live audit shows 0 unnamed buttons (of 127), 0 unlabeled fields, lang+title+alt all good → structural Lighthouse a11y audits pass (numeric score to confirm on deploy). (2) soft violations visible in-grid — `useDerived` feeds `scoreTimetable().violations` (hard+soft); S3/S5/S6 color cells amber, hard rings take precedence (`gridModel.test`). (3) four print layouts via `@media print`: master grid (day view), per-class week sheet, per-teacher week sheet, substitution day sheet (WeekGrid lives outside `.no-print`).
  - NOT built (optional, non-AC): coach-marks tour, undo toast, autosave indicator, subject colors, cell popovers, free-slot highlighting, left-sidebar. Listed below for a future pass.
- **In-progress milestone**: none — **v1 (M0–M6) and v2 (M7–M10) both complete and deployed.**
- **Tests**: green — 105 tests across 30 files
- **Build**: green — typechecks + builds (87 KB gzip, well under the 300 KB budget)

## Next action

Roadmap complete (M0–M10). Live at https://veerpatta.github.io/timetablestudio/ (auto-deploys on push to `main`). Suggested follow-ups, none blocking, rough priority:
1. Owner-side empirical checks: run Lighthouse on the deployed site (confirm a11y ≥ 90 and PWA installable); paste exported rawData into the LIVE legacy viewer (the one M6/v1 AC never verifiable in-session).
2. Replace the SYNTHETIC data with reality: a real legacy `rawData` snapshot (→ second round-trip fixture + tolerant compare) and owner-authoritative per-class quotas / teacher caps / ELGA days (currently faithful synthetic). Fix the SCHOOL_CONTEXT "14 vs 16 classes" miscount.
3. Optional polish parked from M8/M10: subject color coding (Subject.color exists), compact-cell popover, free-slot highlighting, left-sidebar nav, coach-marks tour, undo toast + autosave indicator, teacher-gap visualization, "Print all teacher sheets".
4. Data manager: Block (ELGA) CRUD (currently arrives only via demo/import).
5. Solver: forward-checking/min-conflicts engine upgrade IF a real over-constrained-but-feasible instance proves too slow (current backtracker meets the <10 s AC).

## Mid-milestone notes (empty if between milestones)

(between milestones — roadmap complete)

- Carried honest claims: (a) no real legacy `rawData` snapshot — M1 round-trip + M7 demo use faithful SYNTHETIC data; live-viewer paste check remains owner-side. (b) Lighthouse a11y/PWA numeric scores: structural audits pass in-app, exact numbers to confirm on the deployed site.
- ELGA-as-band merges only when block classes are contiguous in display order (documented fallback).
- Architecture invariants held throughout: `domain/`+`solver/` pure (Node-tested), worker protocol + determinism-per-seed stable (rule 9), no new runtime deps beyond the pre-approved list, all files < 300 lines, strict layering, no `any`.
- UI tests jsdom via `environmentMatchGlobs` (`src/ui/**`); domain/solver under Node.

## Open questions for the owner

1. Per-class subject quotas (periods/week of each subject per class) — M7 demo uses faithful SYNTHETIC quotas (moderate, free periods left). Real quotas feed M9's solver; until then the wizard/data-manager let the owner enter their own.
2. Teacher max loads and unavailable slots — defaults (6/day, 36/week) apply; editable per teacher in the data manager.
3. Which days carry the ELGA block, and is start period P3 fixed? — demo ASSUMES Mon+Thu, P3–P5. Confirm.
4. Class count: SCHOOL_CONTEXT says "14" but enumerates 16 (Class 1–10 + 11/12 × Arts/Commerce/Science). The demo uses the enumerated 16. Confirm the true count / fix the doc.

## Known TODOs / stubs in code

- M8 work (next): shared modal shell w/ Escape+overlay close; plain-language relabel (no jargon, rule 8); ELGA-as-band rendering; responsive/mobile read-only grid (rule 10); per-class & per-teacher week views; sidebar nav + draft switcher.
- M9 work: replace `deriveRequirements` circularity with owner quotas from M7 (keep it only as a one-time "infer from imported timetable" suggestion); engine forward-checking + min-conflicts; never silently apply infeasible — blocker report naming the bottleneck.
- Data manager has no Block (ELGA) CRUD yet — ELGA arrives via demo/import only. Add block editing (classes/teachers/length/days) when needed.
- `domain/legacyImport.ts` — block detection keyed on the literal "ELGA" token; generalize only if a second block type appears.
- No real `rawData` snapshot — `fixtures/legacyRaw.sample.ts` (2-day) and the M7 demo are synthetic-but-faithful; replace/augment when the owner provides one.
- Soft constraints (S1–S6) drive scoring/weights/ranking but are NOT yet shown as per-cell amber badges in the grid (M10 AC; wire `scoreTimetable().soft` into the grid overlay).

---

## Template (replace sections above; do not append)

- Last completed milestone + one-line proof (e.g. "M2 — all AC pass, 47 tests green")
- In-progress milestone + exactly where you stopped
- Tests / build status (green/red, counts)
- Next action: the single concrete first step for the next session
- Mid-milestone notes: tricky context the next session needs (gotchas, half-done refactors)
- Open questions / TODO stubs: anything blocked on the owner
