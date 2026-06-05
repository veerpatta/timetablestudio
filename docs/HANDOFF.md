# HANDOFF — living session state

This file is the bridge between work sessions. The agent MUST update it after every completed milestone and before ending any session (see AGENTS.md § 6). Keep it short and current — it describes NOW, not history (history lives in git log and DECISIONS.md).

---

## Current state

- **Last completed milestone**: M15 — Domain: rules, anchors, doubles, block days. **v4 started.** 149 tests green (36 files); `npm run build` (94 KB gzip) and `npm run lint` clean.
  - **AC met**: (1) each rule template R1–R15 has a satisfied + violated unit test with a plain-language message naming entities/slots (`domain/rules.test.ts`, 23 tests); (2) a duration-2 lesson occupies two periods and moves as ONE unit (`movePlacement` + `occupiedPeriods`); a double past the day-end trips H4; (3) a v1 project file loads and migrates to v2 with `rules: []` (asserted on a synthetic v1 file; the committed v1 JSON fixtures also load via `deserializeProject`→`migrate`).
  - Built (doc-first — DATA_MODEL.md + types.ts same change): `Rule` discriminated union R1–R15 + `RuleSeverity`/`HalfOfDay`; `Lesson.duration`; `BlockActivity.allowedDays`/`fixedStartPeriod`; `SchoolClass.classTeacherId`/`isBoardClass`; `ScheduleProfile.break`; `Project.rules` + `schemaVersion: 2`. Engine: `domain/rules.ts` (thin: must→validate hard, prefer→score soft with rule.weight) + `domain/ruleChecks.ts` (15 predicates) + `domain/occupancy.ts` (shared stats) + `domain/ruleText.ts` (`ruleSentence` + `RULE_TEMPLATES`) + `domain/names.ts`. `validate()` H4 generalized to any multi-period unit, H8 counts periods; `score.ts` adds prefer-rule weight; `migrations.ts` v1→v2.
- **In-progress milestone**: none — M15 complete, M16 next.
- **Tests**: green — 149 tests across 36 files
- **Build**: green — typechecks + builds (94 KB gzip, well under the 300 KB budget); lint clean

## Next action (v4 — M16: Rules UI, plain-language rule builder)

Start **M16** (docs/ROADMAP.md § v4). Build on the M15 domain:
1. "Rules" sidebar section: rule list as readable sentences (`ruleSentence`) with on/off toggles + must/prefer chips; "Add rule" = template picker (`RULE_TEMPLATES`) → fill-in-the-blanks sentence (pickers for subject/class/teacher/periods/days), zero jargon.
2. Violations panel groups by rule, explains in the rule's own words with click-to-jump (rule violations already carry `constraintId: "R4"` etc. + entity-named messages + slots).
3. **Import auto-detection**: importing the real timetable proposes detected rules (P1 anchors, doubles, ELGA Mon–Thu, board flags) as pre-filled sentences for one-click accept.
4. Presets bundle: "Indian K-12 defaults" applied optionally at setup.
- **AC**: the seven implicit VPPS constraint families all expressible via UI without code; auto-detect on the real import proposes ≥ P1 anchors, ELGA days, and the 12-Commerce Accountancy double; every violation message names entities + slots.

Key new domain facts already in the model: P1 class-teacher anchors (R4 + `classTeacherId`), ELGA Mon–Thu @P3 (R7 + block `allowedDays`/`fixedStartPeriod`), double periods (`Lesson.duration: 2`, R6), board flags (R9 + `isBoardClass`), break after P4 (`ScheduleProfile.break`). Subjects missing from rawData (CCS, Revision, Sanskrit, practices, electives) are M18's reconciliation.

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
