# HANDOFF — living session state

This file is the bridge between work sessions. The agent MUST update it after every completed milestone and before ending any session (see AGENTS.md § 6). Keep it short and current — it describes NOW, not history (history lives in git log and DECISIONS.md).

---

## Current state (REVAMP — v7 decision-grade UI — M24 complete, 2026-06-21)

Branch `main`. 228 tests green (46 files); build (~104 KB gzip main) + lint clean.

**M24 — Feasibility & relaxation engine — COMPLETE (2026-06-21).**
- Added `RelaxationSuggestion` and `Blocker` interfaces to `src/solver/types.ts`. Added optional `structuredBlockers?: Blocker[]` to `FeasibilityReport` (backward compatible — all old construction sites still compile without changes).
- Upgraded `src/solver/feasibility.ts` with 6 deterministic capacity checks, each producing a `Blocker` alongside the existing string message: `subject_capacity` (no qualified teacher), `class_capacity` (class demand > weekly slots), `teacher_capacity` (teacher's intrinsic maxPerWeek < sole-qualifier demand), `slot_contention` (subject_only_periods must constraint + demand > allowed slots × days), `locked_conflict` (pinned event violates hard constraint), `cap_sum` (teacher_max_per_week must constraint cap < sole-qualifier demand).
- `teacher_capacity` and `cap_sum` each supply an `apply: (p: Project) => Project` relaxation that raises the limit, round-trip verified.
- Joint-class event deduplication: `teacher_capacity` and `cap_sum` count a joint_class event ONCE (not once per class) to avoid inflating forced-demand for teachers who teach multiple classes simultaneously.
- Added 17 new tests to `src/solver/feasibility.test.ts`: satisfied + blocked for each of the 6 checks (entity names + exact numbers asserted), plus 2 apply round-trip tests.
- AC met: 228 tests green; build + lint clean; `apply` round-trips verified.

**M23 — Tiering & vocabulary — COMPLETE (2026-06-20).**
- Added `tierLabel(severity): "Rule" | "Preference"` to `src/domain/constraintText.ts`; re-exported from `src/domain/constraints.ts` — single source of truth for the vocabulary.
- Rebuilt `src/ui/panels/ConstraintsPanel.tsx`: two-section list (Rules · N / Preferences · M); "Add Rule" + "Add Preference" buttons. Constraints moveable between sections via `onAdd` with flipped severity.
- Fixed `src/ui/app/Dashboard.tsx`: separate "Rules" and "Preferences" count tiles; grid expanded to 5 columns.
- Updated `src/ui/panels/Issues.tsx`: "Things to fix" → "Rule broken".
- AC met: 214 tests green; build + lint clean; live-verified.

**Next action: M25 — Assessment engine (W4).**
Create `src/domain/assessment.ts` with `assessTimetable(project, timetableId): TimetableAssessment` returning structured pros/cons + an overall score. See REVAMP_PLAN.md W4 for the full spec.

---

## Prior state (OVERHAUL — engine + green-field UI — COMPLETE, 2026-06-19)

Branch `overhaul/engine-ui`. 201 tests green (43 files); build (~101 KB gzip main, ~39 KB worker) + lint clean. Live-verified in Chrome.

Owner brief: the app was hard to use, "Make best timetable" filled Self Study everywhere, constraints/compulsory-per-week weren't honoured, and the solver was dumb. Owner chose (this session): one combined release · full green-field UI · complete solver (backtracking/repair) · strongly configurable, VPPS default.

Delivered (details in DECISIONS.md, 2026-06-19):
- **A1 — Self Study collapse fixed.** `isReschedulable` (shared by `solver/plan.ts` + `solver/schedule.ts`) protects group-scoped electives + self_study, so re-plan no longer strips Arts electives and leaves whole-class Self Study. Repro test in `solver/plan.test.ts`.
- **A2 — compulsory-per-week is real.** New `domain/coverage.ts` (`requirementCoverage`/`coverageGaps`/`totalShortfall`), separate from validate(); drives a three-state status (Ready/Incomplete/Clashes).
- **A3 — smarter solver.** `solver/schedule.ts` = greedy `fill` + bounded, seeded, validate-gated repair (single-eviction-relocation), best-of-N by completeness then soft. `planTimetable` now strips ONLY hard-violating lessons (was: nuke the whole board), so a re-plan preserves a complete, valid timetable. Honest boundary: a from-scratch full-school build can still leave ~10 deeply-contended gaps (surfaced, never silent).
- **B — configurability.** `domain/requirementsEdit.ts` + store upsert/remove; new "Weekly subjects" quota editor.
- **C — green-field UI** (`src/ui` rebuilt): guided Dashboard, Setup hub (People & subjects · Weekly subjects · Rules), Generate/Review screen, Timetable workspace (reuses the tested legal-only editor), reused Insights/Reports/Tools. Design tokens in index.css.

NOT yet done (next session): commit Phases B+C (A is committed `f625a18`); optional — strengthen repair for the from-scratch full-school case; mobile polish pass; merge `overhaul/engine-ui` → `main` (owner authorisation).

---

## Prior state (v6.1 CUSTOMIZE — COMPLETE)

- **🎉 v6.1 CUSTOMIZE COMPLETE (C1–C7, 2026-06-07).** The app is fully editable, has a REAL applied constraint engine that drives validate + generate, the Arts elective problem is fixed end-to-end, and reports include a per-student personal timetable. 180 tests green (36 files); build + lint clean (~93 KB gzip main; ~28 KB worker chunk). No milestone in progress.
- **🎉 C7 COMPLETE (2026-06-07) — Reports, student view & polish.** `domain/studentView.ts` (`studentTimetable` + `electiveReport`) — a chosen combination's personal timetable, built on the HE2 oracle (deriveMaps + attendeesOf) so it always matches the grid; no non-chosen subject ever appears (dropper sees Self Study). `domain/reports.ts` gains `roomUseReport` (honest: real usage if rooms are ever assigned, else an owner-visible "not assigned yet" note — same gap as C4's deferred `subject_needs_room`). UI: `ReportsView` now hosts `PersonalTimetable` (class+combination picker), `SchoolReports` (elective/option-line report + per-class subject counts + room use), an option-line-aware whole-school day sheet, and print polish (`print:hidden` controls, `breakInside: avoid` sections); legacy text export retained.
  - **AC met**: `studentView.test.ts` (10) — every Arts combination's electives == chosen set exactly (dropped absent, Self Study + compulsory present), reconciles with derive(); `PersonalTimetable.dom.test.tsx` (1) — UI shows a clean combination. Live-verified (drop-Economics combo → PolSci/Geography/EngLit + Self Study, no Economics; all six sections render; console clean).
- **🎉 C6 COMPLETE (2026-06-07) — Generator honours everything.** 169 tests green (34 files); build + lint clean (~92 KB gzip main; worker chunk ~28 KB raw — now bundles the constraint engine, off the main thread). The auto-fill generator now respects qualifications + availability + electives + every hard must it CAN pre-respect, optimises the prefers it can't, and explains infeasibility in plain language.
  - **Built (part 1 — cap-musts + blockers)**: `solver/caps.ts` (`buildCapGuard`) — fill refuses any candidate that would breach an enabled MUST cap, via counters seeded from kept placements (one-oracle with validate: fill never emits a hard cap violation it claims to honour). Pre-respects all monotone caps (teacher week/day/days/consecutive, min-free-as-a-week-cap, subject-per-day over subject×class sets, class teachers-per-day, class same-in-a-row via run-through-candidate over teach-index) + two local musts (board-protect, not-adjacent). `FillResult.blockers: string[]` (plain-language diagnosis, surfaced in `FillReview`). Headline case works: teacher cap below forced load → blocker names teacher+limit, 0 hard, honest gaps.
  - **Built (part 2 — prefer optimisation)**: `solver/generate.ts` (`generate`) — best-of-N: every seed is legal, so run a fixed seed list (default 8), score by validate() SOFT count, keep the lowest (deterministic, no Math.random). Wired through `fillWorker`/`fillClient.runGenerate`; "Fill the gaps" now calls `runGenerate`.
  - **Documented boundary (DECISIONS C6)**: genuinely non-monotone musts (order/spread/compact/variety/balance) can't be greedily pre-respected — surfaced by validate() + reduced by the multi-seed pass.
  - **AC met**: `caps.test.ts` (13) — generic one-oracle per template, canonical infeasible (blocker + 0 hard + gaps), generous no-op, electives-not-broken; `generate.test.ts` (3) — legal + deterministic + picks the minimum-soft seed. Live-verified (button runs through the real Worker, console clean).
  - **NEXT: C7** — reports, student view & polish: updated class/teacher/day reports, elective/option-line report, per-student-combination personal timetable (Arts student in a combination → clean personal timetable, no non-chosen subjects), room-use report, print layouts; legacy export retained; reports reconcile with derive().
- **🎉 C5 COMPLETE (2026-06-07) — Electives & student groups (the Arts fix).** 153 tests green (32 files); build + lint clean (~90 KB gzip). Arts 11 & 12 electives are modelled as free-3-of-4 student groups: each elective event is scoped to the groups that chose it and the dropping group gets a supervised Self Study at that slot — **no more forced sitting**. The class grid shows option-line slots stacked. Bundled stays clash-free.
  - **Built**: types (TimetableEvent.studentGroupIds, ElectiveGroup, StudentGroup, Project.electiveGroups/studentGroups); `domain/attendees.ts` (attendee-set resolution; whole-class = universal set) wired into validate's HE2; `domain/electives.ts` (seedArtsElectives — idempotent; canParallelize); buildBundledProject seeds electives (buildBundledProjectRaw = round-trip source); WeekGrid option-line rendering; normalizeProject migrates pre-C5 projects on load.
  - **Clash refinement (the load-bearing piece)**: HE2 now compares attendee sets — disjoint-audience overlap (elective + dropper Study) is legal; intersecting audiences clash. Subsumes old HE2 (no groups → universal → identical). Prakash≠Eco&Geo is still HE1.
  - **AC met**: gate (bundled validate == 0 hard with Study events present), no-forced-sitting (every elective's groups ⊆ choosers), two-sided clash test, canParallelize false under free-3-of-4, Arts grids reconcile with forced-sitting removed. Live-verified (EngLit for 3 groups + Self Study for drop-EngLit group, "All clear").
  - **Deferred to later C's (not silent)**: real parallel re-scheduling of electives into shared lines (C6 generator); the per-student-combination personal timetable (C7). A student-roster CRUD (assigning individual students to combinations) is out of scope — 4 synthetic groups per Arts class satisfy the AC.
  - **NEXT: C6** — generator honours everything (qualifications, availability, electives, all must-constraints; infeasible → plain blocker report). fill is currently NOT attendee/elective-aware nor aggregate-must-aware — that's C6's job.
- **C4 COMPLETE (2026-06-07) — Constraint library breadth + suggester + rules retired.** 143 tests green (31 files); build + lint clean (~89 KB gzip). 24 constraint templates across teacher/subject/class/global (both severities, local+aggregate), each with satisfied+violated tests. "Suggest constraints" proposes descriptive, property-tested patterns. The builder is data-driven (descriptor catalog). The legacy R1–R15 rule system is fully **removed** (deleted, not deprecated); `constraints` is the only system.
  - **Built**: constraintShared.ts / constraintAggregates.ts (18 evaluators) / constraintText.ts / constraintCatalog.ts (UI descriptors); constraints.ts dispatch; suggestConstraints.ts (+test); generic descriptor-driven ConstraintsPanel with a suggestions section. types.ts Constraint union → 24 templates.
  - **Retirement**: deleted rules.ts/.test, ruleText.ts, suggestRules.ts/.test, RulesPanel.tsx; removed Rule union + Project.rules + evaluateRules + store rule actions; entityEdit now prunes CONSTRAINTS on entity removal (pruneConstraints); findDanglingRefs scans constraint params; normalizeProject migrates persisted R4→class_teacher_p1 off the raw blob (tested).
  - **Deferred (documented, not silent)**: ~9 niche/model-thin templates (subject_needs_room — no roomId; specials_avoid_block; fair_first_last_duties; subject_double/min_gap; etc.) — see DECISIONS C4.
  - **AC met**: breadth (25 tests, satisfied+violated each), suggester (≥5, all satisfied — property test), both owner examples (C3), data-driven builder live-verified, no codes on surface.
  - **NEXT: C5** — electives & student groups (the Arts fix). ⚠ Model changes (ElectiveGroup, StudentGroup, events.studentGroupIds; Project gains electiveGroups/studentGroups — seams already in normalizer). **Checkpoint with advisor before C5** (per kickoff: free 3-of-4, no forced sitting, parallel-where-possible else supervised study, Prakash≠Eco&Geo same slot).
- **C3 COMPLETE (2026-06-07) — Applied constraint engine.** 133 tests green (31 files); build + lint clean (~86 KB gzip). Real `Constraint` entity (typed union) drives `validate()` (must→hard, prefer→soft) AND Fill-the-gaps (pre-respects placement-local musts); offending class cells highlight rose with a plain tooltip. New "Constraints" tab (replaces "Rules") with a sentence-first builder. The two owner examples both work (`subject_half_of_day`, `teacher_max_per_week`), plus `class_teacher_p1` (migrated from C2's R4).
  - **Built**: `domain/constraints.ts` (localViolates / evaluateConstraints / localMustForbids / constraintSentence; one-predicate local + aggregate split), `Constraint` typed union in types.ts (+ `Project.constraints`, doc-first DATA_MODEL), wired into validate() + fill's candidatesAt, store actions (add/update/toggle/removeConstraint), WeekGrid violation highlighting, `ui/panels/ConstraintsPanel.tsx`. Migration: `normalizeProject` converts persisted R4→`class_teacher_p1`; AssignmentsView P1 checkbox now creates the constraint.
  - **Engine policy (advisor)**: local musts pre-respected by fill; aggregate musts (weekly caps) surface as issues, resolved by the generator in C6. Parallel-run: legacy `evaluateRules` (R1–R15) still in validate() so RB6/carried rules stay green.
  - **AC met**: `constraints.test.ts` (8) — gate test (afternoon Maths flags exact cell, fill never lands afternoon Maths, disable clears, per-template satisfied/violated); UI tests `ConstraintsPanel.dom.test.tsx` (2, incl. live cell-title highlight) + updated `AssignmentsView.dom.test.tsx`. Live-verified (Bindu max-5 → "1 to fix" + plain message → disable → "All clear").
  - **Deferred to C4 (NOT silent)**: full R1–R15 → constraint-template port, the **constraint suggester** (the RB6 rule-suggester is OFF the surface in C3, returns in C4), and removal of the `Rule` type + `evaluateRules` + `rules` field. `RulesPanel.tsx`/`suggestRules.ts` linger in-repo as reference.
  - **NEXT: C4** — constraint library breadth (teacher/subject/class/global catalog from CONSTRAINTS.md § v6.1) + "Suggest constraints"; each template satisfied+violated tested; ≥5 real suggestions, no dupes. Then retire `rules`.
- **C2 COMPLETE (2026-06-07) — Assignments matrix & class teacher.** 123 tests green (29 files); build + lint clean (~85 KB gzip). New "Who teaches what" sub-tab in Setup: pick a class → set its class teacher (+ a "takes period 1 daily" checkbox that adds the R4 rule, disabled until a class teacher is chosen) and edit which teacher may teach each subject (qualified-teacher chips + "+ teacher"). Editing the matrix immediately changes what the cell picker offers; all edits undoable + persisted.
  - **Built**: `domain/assign.ts` (addQualification/removeQualification/qualifiedTeachers/setClassTeacher, pure), store actions (addQualification/removeQualification/setClassTeacher), `ui/manage/AssignmentsView.tsx`. R4 (class-teacher-P1) reused from rules.ts, id `R4:<classId>`, default `prefer`.
  - **AC met**: `assign.test.ts` (3) proves a qualification edit changes legalOptions and that setting a class teacher enables R4 (0 → >0 violations, back to 0 when cleared); `ui/manage/AssignmentsView.dom.test.tsx` (1) drives both through the UI. Live-verified. **R4 rules added here will migrate into the C3 Constraint model.**
  - **NEXT: C3** — applied constraint engine (real `Constraint` entity replacing static rules; wired into validate()/score()/generate(); Constraints panel; live highlighting). ⚠ Schema changes here (retire `rules`→`constraints`, add `Constraint` to types.ts + DATA_MODEL doc-first, migrate existing rules). **Checkpoint with advisor before starting C3** (per advisor + kickoff).
- **C1 COMPLETE (2026-06-07) — Editable entities + safe-impact + persistence.** 119 tests green (27 files); build + lint clean (~84 KB gzip). The app is no longer view-only: a new **"Setup"** view tab lets a non-technical user add/remove/rename teachers, subjects and classes, and edit the school day (rename/re-time periods, add a period, remove one). Removal is never silent — it opens a plain-language impact panel ("this affects 48 cells / 10 lessons"); teacher removal offers guided reassignment to another teacher. Edits are undoable and **persist to IndexedDB** (write-through; survives reload — live-verified).
  - **Built**: `domain/references.ts` (`referencesOf` impact preview + `findDanglingRefs` invariant), `domain/entityEdit.ts` (pure CRUD; joint/team demotion on class/teacher removal; opaque new ids), `persistence/db.ts` (idb, fresh DB name `timetable-studio-v6` to avoid the legacy M19 DB collision; field-presence normalizer for forward-compat), store CRUD actions + `enablePersistence` (hydrate + write-through, wired in main.tsx), `ui/manage/` (ManageView + generic EntityManager + PeriodManager).
  - **AC met**: add teacher / rename subject / remove class (incl. a class inside a joint event) with no dangling reference and no clash — proven by `entityEdit.test.ts` (13), `persistence/db.test.ts` (5), `store/entityCrud.test.ts` (4), and a UI integration test `ui/manage/ManageView.dom.test.tsx`. Reload-preserves-changes live-verified in the browser (removed a class → reloaded → still gone, "All clear"). See DECISIONS (C1).
  - **NEXT: C2** — assignments matrix (qualification grid) + class-teacher picker. Then C3 applied constraint engine (checkpoint with advisor — schema changes there: retire `rules`, add `Constraint`).
- **Branch**: working on **`main`** (the v6 rebuild merged to main and is live; C-series builds directly on main per the v6.1 kickoff). Each milestone is committed when green.

### (historical) v6 REBUILD branch note
- During RB0–RB8 work happened on **`rebuild`** (NOT `main`). `main` auto-deploys to GitHub Pages; RB0–RB1 left the app a placeholder until the editor returned in RB2, so RBn accumulated on `rebuild` and merged to `main` only once the app was back at parity. That merge is done (`b13666e`).
- **🎉 RB0–RB8 ALL COMPLETE — v6 event-model rewrite is LIVE on `main`.** Merged `rebuild`→`main` (`b13666e`, owner-authorized) and deployed to GitHub Pages (Deploy workflow green). 98 tests green (23 files); build + lint clean (~79 KB gzip main + 4 KB worker chunk). The app opens to the real 8-period 2026-27 timetable, clash-free; legal-only editing (picker/ghost/drag-swap), smart issues+fixes, insights, lock & auto-fill (Web Worker), rules library + suggester, reports + legacy export, and operational tools (substitution, versions, PWA) are all in. `rebuild` and `main` are now in sync; future work can branch from `main`.
  - **Heatwave profile DROPPED (owner decision 2026-06-07):** the 6-period heatwave / secondary-profile idea is removed entirely — the product is 8-period only. Deleted `buildHeatwaveProfile`/`HEATWAVE_*` (profile.ts), its test, the dead `fixtures/classWisePdf.ts` (6-period reference), and the second bundled profile (`buildProject` now ships only the regular 8-period profile). See DECISIONS.
  - **Other known deferred (owner-visible, not silent):** IndexedDB persistence (edits don't survive reload — in-memory store is enough for current AC), the "ELGA — Bindu" solo legalOptions wrinkle (RB6 policy refinement), and R16–R24 rules (doc-only).
- **Prior (REBUILD)**: **RB8 — Operational tools (COMPLETE).** `domain/substitute.ts` (coverOptions free∩qualified; absentTeacherPlan; ELGA→manual), `domain/diffTimetables.ts` (by-value diff), store `versions` (save/restore-undoable/delete), `ui/tools/ToolsView.tsx`, PWA registration (PROD+BASE_URL) over the pre-existing manifest/cache-first sw.js. Live-verified.
- **Prior (REBUILD)**: **RB7 — Reports & export (COMPLETE).** 91 tests green (20 files); build + lint clean. `domain/exportLegacy.ts` (legacy viewer text; round-trip test vs derive + ELGA expansion) + `domain/reports.ts` (workload/subject-count/clash/free, reconcile tests). UI: "Reports" view = whole-school Day sheet + teacher-workload table + "Download timetable file" (Blob) + Print. Live-verified.
- **Prior (REBUILD)**: **RB6 — Rules library (COMPLETE).** 86 tests green (18 files); build + lint clean. `domain/rules.ts` (`evaluateRules`, all 15 templates; must→hard, prefer→soft) wired into `validate()`; `domain/ruleText.ts` (`ruleSentence`); `domain/suggestRules.ts` (descriptive proposals: blocks/caps/doubles, property-tested → 0 violations each, deduped). UI: "Rules" view tab (sentence-first toggles + one-click Add, undoable via `store.addRule/toggleRule/removeRule`); Issues panel gained a muted "Could be better" soft section; header badge → "All clear"/"N to fix". DECISION (doc-first): must-rules surface as issues (not pre-excluded from the picker) — DATA_MODEL legal-move wording updated. R16–R24 deferred; R7 partial (start-consistency). Live-verified add/toggle.
- **Prior (REBUILD)**: **RB5 — Lock & auto-fill generator (COMPLETE).** 68 tests green (16 files); build + lint clean; Vite emits a separate `fillWorker-*.js` chunk. Core (RB5 1/n, see below) + Web Worker wrapper (`solver/fillWorker.ts`) + client (`solver/fillClient.runFill`, worker with main-thread fallback for tests) + "Fill the gaps" button → `FillReview` accept/reject DIFF (applied via undoable `store.applyFix`; nothing silent). Live-verified through the REAL worker (clear → fill → "Class 1 Mon P1 → Maths — Bindu" → Accept → 0 clashes, undoable) + jsdom integration test (`App.fill.test.tsx`, accept + reject).
- **RB5 core (1/n) detail**: **auto-fill solver CORE (pure, seeded).** 66 tests green (15 files); build (72 KB gzip) + lint clean. `solver/rng.ts` (mulberry32, no Math.random) + `solver/fill.ts`: fills empty teaching holes with legal quota-reducing lessons via a fast incremental occupancy index (teacher/class busy Sets + shortfall; NO deriveMaps per node — a re-derive DFS prototype blew the 5s budget). MRV-ordered, GREEDY single pass (not full backtracking — see DECISIONS for why: AC is only "0 clashes <5s, pinned untouched"; greedy meets it in ~62ms and fills ≥90%, leaving a few contended holes as visible diff gaps). NEVER moves/removes a placement → pinned/joint/team untouched by construction (HE8). AC test (`solver/fill.test.ts`): clear ~30% non-pinned → fill → 0 hard clashes <5s, locked placements byte-identical, deterministic per seed. **RB5 is NOT complete** — the worker wrapper + accept/reject diff UI remain (Task #9).
- **Prior (REBUILD)**: **RB4 — Teacher load & insights.** 63 tests green (14 files); build (72 KB gzip) + lint clean. AC met: every insights number equals an INDEPENDENT placement-derived recompute (property test over all 18 teachers + all slots); the free-teacher finder excludes anyone occupied incl. ELGA team_block (Mon P3) and senior joint_class (Mon P4) members, respects availability (Mahesh after recess) and returns [] for Recess. Built `domain/insights.ts` (teacherLoad/allTeacherLoads/loadBalance/freeTeachers, pure projection of deriveMaps) + `ui/insights/InsightsView.tsx` (third "Insights" view tab: balance sentence, teacher×day load heatmap with Week+Free, "Who's free?" finder). Live-verified via DOM (screenshot tool was timing out; app responsive).
- **Prior (REBUILD)**: **RB3 — Smart validation & fixes.** 58 tests green (13 files); build (71 KB gzip) + lint clean. AC met: (1) bundled → 0 issues (`buildIssues == []`; joint/team overlaps are never clashes by construction — validate() is the only oracle); live: no panel, "No clashes" badge. (2) An injected clash (from outside the legal-only editor) yields a readable, plain-language issue with "Show me" (jump to cell) + one-click "Fix it" + Undo — proven by `App.issues.test.tsx` (jsdom integration: inject clash → fix → undo restores). Built: `domain/issues.ts` (buildIssues + the shared `actionablePlacement` helper feeding both jump and fix), `domain/fixes.ts` (suggestFixes: reassign>move>clear, each strictly reduces hard count, all via legalOptions/canMove/clearCell), `ui/panels/Issues.tsx`, `store.applyFix` (undoable). Also fixed `store.reset` (now restores timetableId) + added global RTL cleanup.
- **Prior (REBUILD)**: **RB2 — the legal-only editor, FEATURE-COMPLETE incl. both starred niceties.** 50 tests green (12 files); build (70 KB gzip, dnd-kit added ~14 KB) + lint clean; live-verified end-to-end. The two niceties are built and verified: **ghost autocomplete** (faint best-legal "Subject?" hint in empty cells + a "Suggested" first option in the picker, one-click accept; ranked by requirement shortfall, always a legalOptions() candidate) and **drag-with-auto-swap** (drag a normal lesson onto another cell → legal swap/move via @dnd-kit; shared joint/team cells aren't draggable; a "Swap with · both stay valid" list in the picker is the same path). All swap/move affordances are two-side-tested (every offered swap → 0 new hard + swaps exist; HE4/HE1/HE7 negatives refused). Pure cores: `domain/swaps.ts` (canSwap/canMove/legalSwaps), `domain/ghost.ts` (ghostSuggestion), `edit.swapPlacements`; single store path `tryDrop`.
- **Prior (REBUILD)**: **RB1 — Real 2026-27 timetable as bundled default.** 26 tests; build 52 KB; live-verified.
  - **AC met**: (1) the app OPENS to the real 8-period timetable, pre-loaded, with **0 real clashes** (`validate(buildBundledProject()) == []`, `bundled.test.ts`; live: green "No clashes" badge); (2) ELGA renders as ONE team_block (5 classes × 5 teachers, Mon–Thu, duration 3) and senior combined classes as 6 joint_class events (English/Hindi × 11&12, Economics × Com+Arts 11&12) — asserted + live (amber/violet cells); (3) a fixture test matches the source cell-for-cell — all 768 cells round-trip (`realGrid.test.ts`), and an INDEPENDENT cross-check shows 18/18 teacher weekly loads equal the analysis §6 table (class-wise ≡ teacher-wise).
  - Built: `fixtures/realGrid.ts` (authoritative 8-period transcription, coordinate-extracted from the owner's PDF), `domain/buildProject.ts` (pure grid→events folder: normal/joint/team detection), `domain/gridReconstruct.ts` (project→grid for the round-trip), `fixtures/bundled.ts` (`buildBundledProject`, `BUNDLED_DATA_VERSION=1`, VPPS metadata), read-only `ui/app/App.tsx` + `ui/grid/WeekGrid.tsx` (+ `App.test.tsx`), heatwave profile (`buildHeatwaveProfile`).
- **Prior (REBUILD)**: **RB0 — event-model foundation.** `domain/types.ts` (v6), `profile.ts`, `derive.ts` (eventId-keyed occupancy), `validate.ts` (HE1–HE7), clash tests both directions. Deleted all cell-model `src/`.

## Next action (v6.1 CUSTOMIZE — start C1)

**NEW PHASE (2026-06-07).** v6 rebuild is live & verified (8-period real timetable, 0 clashes, cache issue resolved). Owner: app is still mostly view-only and the rules are decorative. Next phase = full editing + a REAL applied constraint system + the Arts elective fix. Master plan: **docs/CUSTOMIZE.md** (milestones C1–C7). Model additions: docs/DATA_MODEL.md § v6.1 (Constraint, ElectiveGroup, StudentGroup; events gain studentGroupIds). Catalog: docs/CONSTRAINTS.md § v6.1. **Use Prompt H. Start C1** (editable entities CRUD), then C2 assignments/class-teacher, C3 applied constraint engine, C4 constraint-library breadth, C5 electives/student-groups (Arts 3-of-4 free choice; no forced sitting; parallel where possible else supervised study; Prakash≠Eco&Geo same slot), C6 generator honours all, C7 reports + per-student view.

Owner decisions this session: electives only in Arts 11&12 (3 of 4, free choice); fix = parallel option blocks where possible + supervised study fallback; build as one combined plan, cleanest order (encoded as C1→C7).

Also queued (small, from prior session): RB-cache — service-worker skipWaiting/clients.claim + "new version, refresh" prompt so updates roll out without users clearing cache (this session's 6-period-stale bug).

## Superseded earlier next-action

## Next action (REBUILD COMPLETE & DEPLOYED)

**All RB0–RB8 merged to `main` (`b13666e`) and deployed; heatwave dropped (8-period only).** There is no next milestone. Remaining items are the owner's, none blocking:
1. **Owner-side checks on the live site** — paste the legacy export into the old viewer; Lighthouse PWA/a11y numbers; pixel match of the print sheets to the school PDFs.

Optional follow-ups, none blocking (all recorded in DECISIONS): IndexedDB persistence so edits survive reload; exclude team/fixed subjects from solo `legalOptions` placement (the "ELGA — Bindu" wrinkle); R16–R24 rules; a dedicated mobile teacher card view.

### RB4 (COMPLETE — context)
RB4 committed `aaa6a3f`: `domain/insights.ts` + Insights view; see DECISIONS.

### RB3 (COMPLETE — context)
RB3 committed `f72ba28`: issues/fixes pure cores + Issues panel; see DECISIONS.

### RB2 (COMPLETE — context)
**RB2** (committed: RB2 1/n..4/n). Legal-only editor end-to-end: click → picker (only legal options) with Explain + shared-cell guard + "Suggested" ghost + "Swap with" list; class/teacher views share one store; class-health dot + teacher load bar; global undo; keyboard-accessible cells; mobile-readable; drag-with-auto-swap + ghost autocomplete. Tests: picker independent-oracle both sides, swap/move two-sided + HE4/HE1/HE7 negatives, ghost legal+deterministic, edit isolation, cross-view store (50 tests).

**Then RB3 — Smart validation & fixes.** Plain-language issue list distinguishing real clashes from joint events, click-to-jump, one-click safe fix where one exists. AC: 0 false clashes on the bundled data; a deliberately broken placement yields a readable issue + working fix. (`validate()` already powers the clash count; build the readable panel + fixes on it. Fixes should reuse `canSwap`/`canMove`/`legalOptions` so a "fix" is always a legal, undoable, reviewable diff.)

### Known wrinkle to address in RB3/RB6 (not blocking)
- `legalOptions` offers solo placements derived from EVERY qualification triple, so an empty primary cell offers e.g. "ELGA — Bindu" (Bindu is qualified for (ELGA, Class 1) because of the team block). It is clash-free and qualified (so it does NOT break the "never offer unqualified/clashing" rule), but placing it would create a semantically-odd solo "ELGA" normal event. Refinement: exclude team/fixed-only subjects (and activity subjects already placed to quota) from solo normal placement. Decide policy in RB3 (validation) or RB6 (rules).
- IndexedDB persistence still deferred (edits don't survive reload). Optional; add when needed (its own small step).

### RB2 build state (what exists)
- Pure core: `domain/legalMoves.ts` (`legalOptions`), `domain/edit.ts` (`clearCell`/`placeNormalLesson`/`movePlacement`/`ensureEvent`, placement-granular + immutable).
- Store: `store/projectStore.ts` (Zustand, in-memory, seeds `buildBundledProject`, undo).
- UI: `ui/app/App.tsx` (view toggle + selectors + header health/undo), `ui/grid/WeekGrid.tsx` (clickable+keyboard class grid), `ui/grid/TeacherGrid.tsx` (read-only teacher view), `ui/editor/CellPicker.tsx` (legal palette + Explain + shared-cell guard), `ui/panels/Insights.tsx` (class dot + teacher load bar).

Foundations ready for RB2: the legal-move rule is specified (DATA_MODEL § v6 "Legal-move rule"); `validate()` is the feasibility oracle; `deriveMaps` gives class/teacher/day occupancy; `WeekGrid` is the starting grid component.

**RB2 build order + constraints (from advisor, binding):**
1. **`legalOptions(project, timetable, classId, day, slot): Candidate[]`** — a PURE domain fn applying the legal-move rule (qualified ∀(subject,class), available, no different-event occupancy in any covered slot, duration fits, no enabled `must` rule). The heart; unit-testable without a DOM. Add the teacher-view dual.
2. **Independent-oracle test (assert BOTH sides):** for each (entity, slot), apply each offered candidate → `validate()` reports 0 new hard; AND a known clashing/unqualified placement is ABSENT. (A one-sided test passes even if the picker offers nothing.)
3. **⚠ Edit primitive = placement-granular.** Events are SHARED across placements ("Class 1 Maths/Bindu" is ONE event with ~10 placements). NEVER mutate `event.teacherIds` in place (it rewrites all 10 cells). Edits re-point/insert/remove a `Placement`; reuse-or-create the target event by signature via an `ensureEvent(type,subject,teachers,classIds)` helper. **Test:** after editing one cell, every OTHER placement of the former event is unchanged. This also gives joint/team moves for free (one placement, many classIds — can't split a stream out).
4. **One store mutation path over placements** → the 3 views (class/teacher/day, all from `deriveMaps`) update together automatically. Wire the single path before adding view #2. In-memory Zustand is enough for the RB2 AC; add IndexedDB only when edits must survive reload (late RB2 / its own step). Seed `buildBundledProject()` on load.
5. Niceties (ghost autocomplete, drag-auto-swap, health dots, explain-cell) ride on `legalOptions` + the edit primitive — build AFTER 1–3 pass.

**Decision (settled):** emptying a cell = REMOVE its placement (event keeps its other placements); not "park". Keeps undo + health counts coherent.

**Picker scope note:** qualifications are exactly the (teacher,subject,class) triples used by the real grid — so "who else can teach X" is usually just the incumbent (no invented quals). Design the picker around legal *placement* (where/when a lesson can move), not teacher substitution.

## Carried notes / open items
- **Branch discipline (still active):** all RBn on `rebuild`; `main` keeps the live M19 cell-model app and auto-deploys. Merge `rebuild`→`main` only once the editor (RB2) restores parity, so a placeholder/read-only build never deploys over the working timetable.
- **Board flags** = {Class 10, Class 12 Sci/Com/Arts} (CBSE + M18 precedent); PDF highlight colour was ambiguous to auto-detect — refine in RB6 if the owner's set differs.
- **Heatwave removed (2026-06-07):** `fixtures/classWisePdf.ts`, `buildHeatwaveProfile`, and `HEATWAVE_*` were deleted — the product is 8-period only per the owner.
- **`.pdfwork/`** (gitignored) holds the PyMuPDF extraction intermediates; PyMuPDF is a build-time transcription tool, not an app dependency.

## (archived) v5 state at the pivot

- **M19 — Zero-setup bundled real timetable (v5 start).** 197 tests green (45 files); build (104.8 KB gzip) + lint clean. (Now superseded by the REBUILD; lives on `main` until `rebuild` merges.)
  - **AC met (live-verified)**: (1) a cleared browser opens straight into the real VPPS timetable — full 6-day grid, rules on (43 detected), 0 conflicts — with NO user action (`init()` seeds `buildBundledProject()` when storage is empty; `db.test`/`onboarding.test`/`bundled.test`); (2) a simulated pre-v5 stored VPPS project triggers the update banner, and one-click "Update timetable" adopts the latest (version 1, 43 rules) while keeping the old project under a `previous:` draft key with one-step Undo (`bundledUpdate.test` + live IDB check). Settings gained "Reset to school timetable", "Start a different school", and a "Saved drafts" restore list.
  - Built: `src/fixtures/bundled.ts` (`BUNDLED_DATA_VERSION`, `buildBundledProject`, `isStaleBundled`), `Project.bundledDataVersion?` (types + DATA_MODEL), projectStore seeding + `adoptBundled`/`restorePrevious`/`deletePrevious`/`refreshPreviousKeys` + `bundledStale`, App stale/undo banners, SettingsPage controls.
- **Prior milestone**: **M18 — Real-data reconciliation + everyday-ops polish. v4 (M15–M18) COMPLETE.** 192 tests green (43 files); build (103 KB gzip) + lint clean.
  - **AC met**: (1) the in-app grid matches `Class_Wise.pdf` CELL-FOR-CELL — 576/576, scripted against the transcribed `fixtures/classWisePdf.ts` under `pdfSubjectLabel` (`classWisePdf.test.ts`); (2) removing a teacher walks through reassignment with ZERO dangling references (`lifecycle.test.ts` + live); (3) the three print views (per-class week, per-teacher week, whole-school day) carry the reconciled clock + positioned break, mirroring the PDF formats (live-verified; pixel-exact match is owner-side, standard caveat).
  - Built: `domain/reconcile.ts` (PDF clock + break + board flags + `PDF_SUBJECT_ALIASES`; applied in `makeRealVppsProject`), `domain/lifecycle.ts` + `ReassignTeacherModal` (teacher reassignment), `fixtures/classWisePdf.ts` (full PDF transcription) + comparison test, `WeekGrid`/`TimetableGrid` clock+break headers. The cross-check caught one real PDF-vs-rawData label diff ("Science Practice"→"Sci. Practice") — aliased, PDF wins.
- **Completed milestones**: M17 — scenario workbench; M16 — rules UI; M15 — domain rules/durations/block-days/schema v2. (v1 M0–M6, v2 M7–M10, v3 M11–M14 complete since prior sessions.)
- **In-progress milestone**: none — **all of v1, v2, v3, v4 complete.**
- **Tests**: green — 192 tests across 43 files
- **Build**: green — typechecks + builds (103 KB gzip, well under the 300 KB budget); lint clean

## Next action (v6 REBUILD — start RB0)

**DIRECTION CHANGED (2026-06-07).** Owner reviewed the live app against two fresh analyses of the REAL 2026-27 timetable (docs/sources/VPPS_Timetable_Analysis_2026-27.md + ..._Complexity_Analysis_2026-27.md) and chose a **full rewrite on an event model**. Master plan = **docs/REBUILD.md**; it SUPERSEDES M0–M22 (kept in ROADMAP.md as history — do NOT continue them, including the in-flight M20 below).

Owner decisions: (1) default = the real **8-period 2026-27** timetable, pre-loaded so they only tweak; (2) **full rewrite** of UI + engine, reusing proven validation/solver concepts on the event model; (3) **legal-only editing** — the picker only ever offers conflict-free, qualified options.

Why: the cell model cannot represent the school. Real events span many classes/teachers — senior 11/12 share English/Hindi/Economics (joint_class), ELGA is a 5-class×5-teacher team_block; the cell model false-flags these (the "feels off" root cause). Bundled data is also the wrong skeleton (6-period heatwave vs the real 8-period day + Assembly + Recess).

New model: docs/DATA_MODEL.md § "v6 event model (AUTHORITATIVE)". Hard constraints HE1–HE8: docs/CONSTRAINTS.md. Milestones RB0→RB8: docs/REBUILD.md. **Use Prompt G. Start RB0** (event-model foundation), then RB1 (transcribe the real 8-period timetable as the bundled default, replacing M19's 6-period bundle).

## Superseded: v5 — M20 (do not continue)

**M20 — Health panel: 275 lines → 5 actions.** The bundled project's "Things to fix" panel is now a confirmed flood (~140 raw soft items live — 16 R4 + 26 R6 prefer rules feed the existing per-unit S1–S6 + prefer-rule violations). M20 must: health score 0–100 in the header (plain words, replaces raw counts); suggestion pipeline dedupe → group by person/class → rank by impact → top 5 with "Show me" on every item; "Fix it" (precomputed conflict-free swap/move, mini-diff, one click, undoable) on ≥60% of top-5; "Tidy up" scoped soft-optimization presented as an accept/reject ledger; NO constraint codes outside Advanced (regression test on rendered strings). AC: ≤20 grouped suggestions + a top-5; ≥60% of top-5 carry a working Fix-it; one undo reverts any fix; Tidy-up improves the health score and applies only after accept. Spec: docs/ROADMAP.md § v5 M20. Then M21 (insights), M22 (R16–R24 + presets + suggest-rules). Prompt F rules 17–19 apply throughout.

## Superseded v4 next-action

v4 is complete. No milestone is in progress. Parked (post-v4) follow-ups, none blocking:
1. **Period-count change wizard (6→7 / 6→5)** — a ROADMAP M18 feature bullet, NOT one of the three M18 AC clauses, so it was parked. `setActiveProfile` already resizes the period array; add a placement-remap + guided modal ("which lessons drop when shrinking; where the new column goes when growing").
2. Owner-side visual checks (standard honesty caveats): pixel-exact print match vs the school's PDFs; the live legacy-viewer paste; Lighthouse a11y/PWA numeric scores on the deployed site.
3. The original ROADMAP "Parked (post-v4)" list: rooms/labs, multi-school config, teacher preference forms, statistics dashboard, share links, mid-week timetable versioning (effective-from dates).

Honest carried claims (unchanged discipline): AC "non-technical tester unaided" is owner-side; the 11 EXCESS quota requirements in the real import (e.g. Class 4 English Revision placed 2 vs inferred 1) are a quota-INFERENCE quirk, harmless to the solver/scope guarantees — a candidate for a future quota-review pass. Reassigning a full teacher load onto an existing teacher legitimately creates load clashes (surfaced in the conflicts panel) — that's the everyday workflow, not a bug.

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

- M8 work (next): shared modal shell w/ Escape+overlay close; plain-language relabel (no jargon, rule 8); ELGA-as-band rendering; responsive/mobile read-only 