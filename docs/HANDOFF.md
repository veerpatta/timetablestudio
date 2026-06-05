# HANDOFF — living session state

This file is the bridge between work sessions. The agent MUST update it after every completed milestone and before ending any session (see AGENTS.md § 6). Keep it short and current — it describes NOW, not history (history lives in git log and DECISIONS.md).

---

## Current state

- **Last completed milestone**: M16 — Rules UI: plain-language rule builder, import auto-detection, presets. **170 tests green (38 files);** build (100 KB gzip) + lint clean. Verified LIVE on the real VPPS demo: Detect proposes the 16 P1 anchors + ELGA Mon–Thu@P3 + per-class Accountancy/Maths doubles as sentences; Accept all → 43 rules and "Ready — no conflicts"; Add-rule builder shows the live sentence ("Mahesh is class teacher of Class 11 Science and takes period 1 daily") as fields fill, with inline validation.
  - **AC met**: (1) all seven VPPS families expressible via the UI without code (`ui/manage/rulesUi.test.tsx` buildRule cases); (2) auto-detect on the real import proposes ≥ the P1 anchors, ELGA days, and the 12-Commerce Accountancy double (`domain/ruleDetect.test.ts` against `makeRealVppsProject`); (3) every violation message names entities + slots (M15) and the panel groups R* by rule.
  - Built — 16a (pure domain): `domain/ruleEdit.ts` (CRUD + entity-aware `addRuleWithBacking`), `domain/ruleDetect.ts` (P1 anchors as PREFER, ELGA from placements, recurring doubles; accept keeps 0 hard conflicts — guaranteed by test), `domain/rulePresets.ts` (guarded Indian K-12 defaults). 16b (UI): `ui/manage/RulesPage.tsx`, `RuleBuilder.tsx` + `ruleFields.ts` (one ~8-kind field schema + live `ruleSentence` preview), `DetectProposals.tsx`; ViolationsPanel groups by rule; "rules" view wired (useHashRoute/Sidebar/App).
  - **Fix landed (caught live):** `persistence/db.loadProject` now runs `migrate` — a persisted v1 project (no `rules`) was crashing the app on load.
- **Previous milestone**: M15 — domain rules/durations/block-days/schema v2 (doc-first: DATA_MODEL.md + types.ts together; `Rule` union R1–R15, `Lesson.duration`, block `allowedDays`/`fixedStartPeriod`, `SchoolClass.classTeacherId`/`isBoardClass`, `ScheduleProfile.break`).
- **In-progress milestone**: none — M16 complete, M17 next.
- **Tests**: green — 170 tests across 38 files
- **Build**: green — typechecks + builds (100 KB gzip, well under the 300 KB budget); lint clean

## Next action (v4 — M17: Scenario workbench)

Start **M17** (docs/ROADMAP.md § v4): "Try a change" mode for safe exploration.
1. Branch any draft in one click; edit/regenerate; compare side-by-side with the live timetable (diff grid + a change ledger: "3 cells changed · fixes 2 problems · creates 1 new problem"). `domain/diff.ts` already does cell-diff; build the ledger on top (count fixes/new-problems via `validate` before/after).
2. **Impact preview on hover/drop**: before committing a drag, show what it would break/fix (run `validate` on a speculative copy).
3. **Swap finder**: select a cell → list conflict-free exchanges (property test: swaps keep hard violations at 0).
4. Targeted regenerate: freeze everything except a selection (class/teacher/day/subject) and re-solve only that.
5. Promote a branch to live (with undo); export as usual.
- **AC**: branch→edit→compare→promote loop works with full undo; swap finder returns only swaps that keep hard violations at 0 (property test); targeted regenerate changes ONLY the unfrozen scope.

Domain facts now modeled (M15/M16): rules R1–R15 + auto-detect/presets; P1 anchors (R4+`classTeacherId`), ELGA Mon–Thu@P3 (R7+block fields), doubles (`Lesson.duration`/R6), board flags (R9+`isBoardClass`), break (`ScheduleProfile.break`). M18 handles reconciliation of subjects missing from rawData (CCS, Revision, Sanskrit, practices, electives) + cell-for-cell match to Class_Wise.pdf.

Honest carried claims (unchanged discipline): AC#3 "non-technical tester unaided" is owner-side; Lighthouse a11y/PWA numeric scores confirm on deploy; the live legacy-viewer paste check is owner-side (the byte-exact M1 + semantic M12 round-trip tests back it in-repo).

Suggested follow-ups (none blocking): mobile polish on the 16×22 matrix (sticky-column scroll works; could add per-class card view); "first-encounter" auto-surfacing for glossary terms (currently click-to-reveal); teacher unavailable-slot editor in Settings; per-teacher week print "print all".

## Previous next-action (v2, superseded)

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
