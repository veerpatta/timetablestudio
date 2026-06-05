# HANDOFF — living session state

This file is the bridge between work sessions. The agent MUST update it after every completed milestone and before ending any session (see AGENTS.md § 6). Keep it short and current — it describes NOW, not history (history lives in git log and DECISIONS.md).

---

## Current state

- **Last completed milestone**: M8 — UI overhaul (app shell + readable grid). 95 tests green; `npm run build` (85 KB gzip) and `npm run lint` clean. Verified live on the demo: ELGA renders as one merged band (rowspan 5 × colspan 3); per-teacher week view shows ELGA as 2 vertical bands (Mon+Thu); plain-language toolbar ("Fill the gaps", "Create timetables", "Ready — no conflicts"); no console errors.
  - **AC met**: (a) five everyday tasks present in plain language — change a lesson (drag in day grid), find/fix a red cell (ViolationsPanel sentence + "view" jump), fill gaps ("Fill the gaps"), print a teacher's week (week view + Print), mark a teacher absent (Substitutions); (b) Escape closes every modal (shared `ui/common/Modal.tsx`); (c) ELGA appears once as a band per day. All covered by `ui/app/app.m8.test.tsx`.
  - Plain language (rule 8): `uiStore.advanced` toggle gates all codes/seeds/scores; user-facing strings are sentences. Internal API unchanged (constraintId/seed/S-keys) so domain/solver tests stayed green.
  - Week views: pure `weekModel.ts` + read-only `WeekGrid.tsx`; `GridWorkspace.tsx` extracted from App; `editorStore.gridView`/`weekScope`; `DraftSwitcher` + `projectStore.setActiveTimetable`/`deleteTimetable`.
  - Responsive: header + toolbars use `flex-wrap` + `sm:` padding; grids scroll (`overflow-auto`) on mobile; week view is the mobile-friendly single-entity grid.
  - **Deferred to M10 polish (non-AC deliverables)**: left-sidebar nav (top toolbar used instead), subject color coding, compact-cell popovers, free-slot highlighting.
- **In-progress milestone**: M9 (not started)
- **Tests**: green — 95 tests across 26 files
- **Build**: green — typechecks + builds (85 KB gzip)

## Next action

Start **M9** (Solver v2: real requirements, explainable results). Key AC: with real VPPS quotas entered, a full 6-day feasible timetable generates in < 10 s; deliberately over-constrained input yields a READABLE blocker report naming the bottleneck (verified by test); candidate diff renders correctly for a changed cell. Work items: (1) Solver input = owner-authoritative quotas (the demo/wizard already produce `requirements.curriculum`; `deriveRequirements` stays only as a one-time "infer quotas from an imported timetable" suggestion the user confirms — do NOT feed it back circularly). (2) Engine upgrade INSIDE `solver/engine.ts` — forward-checking (prune teacher/class domains) + min-conflicts repair + soft optimization with random restarts in budget; **MUST keep the worker protocol + determinism-per-seed contract** (rule 9). (3) **Never silently apply an infeasible result**: when the solver can't reach 0 hard, return a blocker report — which constraints can't be met, which entities are over-committed (e.g. "Kusum is needed for 8 periods on Mon but the day only has 6"), with relaxation suggestions. Add a pure `solver/diagnose.ts` (e.g. detect per-(teacher,day) demand > capacity, total weekly demand > supply, quota infeasible vs free slots) — test the over-constrained case first (it's the AC). (4) Candidate compare v2: visual diff grid (changed cells highlighted), per-teacher load delta. First concrete step: write the over-constrained blocker test + `solver/diagnose.ts`, then surface it in CompleteButton/CandidateCompare (no silent apply). NOTE the solver currently returns best-so-far on budget/cancel and `feasible:false` — wire that into the blocker report rather than applying.

## Mid-milestone notes (empty if between milestones)

(between milestones)

- M8 deferred polish (fold into M10): subject colors (Subject.color exists in the model — assign + apply as cell bg, careful not to clash with the red/amber conflict ring), compact-cell popover (full subject+teacher on hover/click), free-slot highlighting, optional left-sidebar.
- ELGA-as-band only merges when the block's classes are contiguous in display order (true for the demo + sample). If a user reorders classes so primary classes are non-contiguous, it falls back to per-cell — acceptable, documented.
- Block (ELGA) CRUD still missing in the data manager (arrives via demo/import). Add if M9/M10 needs editable blocks.
- IMPORTANT honest claim (carried): no real legacy-viewer `rawData` snapshot exists; M1 round-trip + M7 demo use faithful SYNTHETIC data. Real-snapshot import + the live-viewer paste check remain owner-side.
- `domain/` + `solver/` tests run under Node; UI tests auto-use jsdom via `environmentMatchGlobs` (`src/ui/**`). Keep `domain/`+`solver/` pure; keep the worker protocol stable (rule 9).

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
