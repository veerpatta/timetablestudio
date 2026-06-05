# HANDOFF — living session state

This file is the bridge between work sessions. The agent MUST update it after every completed milestone and before ending any session (see AGENTS.md § 6). Keep it short and current — it describes NOW, not history (history lives in git log and DECISIONS.md).

---

## Current state

- **Last completed milestone**: M9 — Solver v2 (explainable results). 103 tests green; `npm run build` (87 KB gzip) and `npm run lint` clean. Verified live on the demo: "Create timetables" yields 3 options (Conflicts: None) with a "Changes vs current" diff (413 concrete cell changes); no console errors.
  - **AC met**: (1) full feasible 6-day generation from the demo's real quotas in ~0.6 s (`generate.test.ts`, < 10 s); (2) over-constrained input → readable blocker report naming the bottleneck (`solver/diagnose.test.ts` + `CompleteButton.test.tsx`: "Asha is needed for 40 periods a week, but can teach at most 36."); (3) candidate diff renders a changed cell (`domain/diff.test.ts` + live).
  - `solver/diagnose.ts` (pure): structural necessary-condition checks (teacher weekly demand > cap; demand > days×maxPerDay; class demand > week slots; counts block periods) → plain blockers + suggestions. `BlockerReport` modal.
  - Never silently apply infeasible: Fill/Create run `diagnose` BEFORE solving; solver `feasible:false` → generic report, no apply; "Use this" disabled on conflicted options. Worker protocol + determinism UNCHANGED (rule 9).
  - `domain/diff.ts` (pure) + CandidateCompare "Changes" column + expandable diff list.
  - Engine internals NOT rewritten (existing backtracker meets the <10 s AC; rule-9 rewrite optional) — see DECISIONS. `deriveRequirements` circularity resolved (wizard/demo use real `buildProject` quotas; derive only for legacy import).
- **In-progress milestone**: M10 (not started)
- **Tests**: green — 103 tests across 30 files
- **Build**: green — typechecks + builds (87 KB gzip)

## Next action

Start **M10** (Trust & polish). AC: Lighthouse a11y ≥ 90; soft violations visible in-grid; all four print layouts correct (master grid, per-class sheet, per-teacher sheet, substitution day sheet). Work items: (1) **Amber soft-violation badges in the grid** — wire `scoreTimetable().soft` into the grid overlay (known TODO; `gridModel`/`weekModel` already compute a `severity`, but only `validate()` HARD violations are fed in — also feed soft from `scoreTimetable`). (2) Print layouts: the substitution sheet + grid already print; add per-class and per-teacher week sheets (the `WeekGrid` already exists — ensure it prints cleanly via the `@media print` default target) and a master grid sheet. (3) a11y to ≥ 90: labels/roles on all controls (many added in M8/M9), focus management in the shared `Modal` (focus trap + return focus), color-contrast pass, alt/aria on icon-only buttons. (4) Polish: first-run guided tour (coach marks) — OPTIONAL, do last; undo toast ("Moved Maths · Undo"); autosave indicator. (5) Fold in M8 deferred polish: subject colors, compact-cell popover, free-slot highlighting, optional left-sidebar. First concrete step: wire soft badges into the grid (it's an explicit AC and a long-standing TODO) + a small test; then a Lighthouse a11y pass on the running app (focus trap in Modal is the highest-value a11y fix). NOTE rule 8 (no jargon) still applies to any new copy.

## Mid-milestone notes (empty if between milestones)

(between milestones)

- Soft badges: `gridModel`/`weekModel` take `violations: Violation[]` and color cells by severity. Currently `App`/`GridWorkspace` pass only `derived.violations` (hard, from `validate()`). To show amber soft, also compute `scoreTimetable(project, tt, weights).soft` and merge into the violations passed to the grids (or extend `useDerived` to include soft). Keep hard ring > soft ring precedence.
- Print layouts to verify/produce (M10 AC): master grid (whole-school day — exists), per-class week sheet (WeekGrid scope=class), per-teacher week sheet (WeekGrid scope=teacher), substitution day sheet (exists). The `@media print` default target prints the visible grid; per-class/per-teacher just need the week view selected before printing. Consider a "Print all teacher sheets" later.
- a11y: the shared `Modal` should trap focus and restore it on close (highest-value fix); icon-only buttons (Undo/Redo ↶↷, draft delete ✕) need aria-labels (some have them); check contrast on slate-400 text.
- Carried honest claim: no real legacy `rawData` snapshot — M1 round-trip + M7 demo use faithful SYNTHETIC data; live-viewer paste check remains owner-side.
- ELGA-as-band merges only when block classes are contiguous in display order (documented fallback). Block CRUD still absent in the data manager.
- Keep `domain/`+`solver/` pure; keep the worker protocol stable (rule 9). UI tests jsdom via `environmentMatchGlobs`.

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
