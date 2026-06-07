# HANDOFF — living session state

This file is the bridge between work sessions. The agent MUST update it after every completed milestone and before ending any session (see AGENTS.md § 6). Keep it short and current — it describes NOW, not history (history lives in git log and DECISIONS.md).

---

## Current state (v6 REBUILD in progress)

- **Branch**: working on **`rebuild`** (NOT `main`). `main` auto-deploys to GitHub Pages; RB0–RB1 leave the app a placeholder until the editor returns in RB2, so RBn accumulate on `rebuild` and merge to `main` only once the app is back at parity. `main` still holds the live M19 cell-model app.
- **Last completed (REBUILD)**: **RB3 — Smart validation & fixes.** 58 tests green (13 files); build (71 KB gzip) + lint clean. AC met: (1) bundled → 0 issues (`buildIssues == []`; joint/team overlaps are never clashes by construction — validate() is the only oracle); live: no panel, "No clashes" badge. (2) An injected clash (from outside the legal-only editor) yields a readable, plain-language issue with "Show me" (jump to cell) + one-click "Fix it" + Undo — proven by `App.issues.test.tsx` (jsdom integration: inject clash → fix → undo restores). Built: `domain/issues.ts` (buildIssues + the shared `actionablePlacement` helper feeding both jump and fix), `domain/fixes.ts` (suggestFixes: reassign>move>clear, each strictly reduces hard count, all via legalOptions/canMove/clearCell), `ui/panels/Issues.tsx`, `store.applyFix` (undoable). Also fixed `store.reset` (now restores timetableId) + added global RTL cleanup.
- **Prior (REBUILD)**: **RB2 — the legal-only editor, FEATURE-COMPLETE incl. both starred niceties.** 50 tests green (12 files); build (70 KB gzip, dnd-kit added ~14 KB) + lint clean; live-verified end-to-end. The two niceties are built and verified: **ghost autocomplete** (faint best-legal "Subject?" hint in empty cells + a "Suggested" first option in the picker, one-click accept; ranked by requirement shortfall, always a legalOptions() candidate) and **drag-with-auto-swap** (drag a normal lesson onto another cell → legal swap/move via @dnd-kit; shared joint/team cells aren't draggable; a "Swap with · both stay valid" list in the picker is the same path). All swap/move affordances are two-side-tested (every offered swap → 0 new hard + swaps exist; HE4/HE1/HE7 negatives refused). Pure cores: `domain/swaps.ts` (canSwap/canMove/legalSwaps), `domain/ghost.ts` (ghostSuggestion), `edit.swapPlacements`; single store path `tryDrop`.
- **Prior (REBUILD)**: **RB1 — Real 2026-27 timetable as bundled default.** 26 tests; build 52 KB; live-verified.
  - **AC met**: (1) the app OPENS to the real 8-period timetable, pre-loaded, with **0 real clashes** (`validate(buildBundledProject()) == []`, `bundled.test.ts`; live: green "No clashes" badge); (2) ELGA renders as ONE team_block (5 classes × 5 teachers, Mon–Thu, duration 3) and senior combined classes as 6 joint_class events (English/Hindi × 11&12, Economics × Com+Arts 11&12) — asserted + live (amber/violet cells); (3) a fixture test matches the source cell-for-cell — all 768 cells round-trip (`realGrid.test.ts`), and an INDEPENDENT cross-check shows 18/18 teacher weekly loads equal the analysis §6 table (class-wise ≡ teacher-wise).
  - Built: `fixtures/realGrid.ts` (authoritative 8-period transcription, coordinate-extracted from the owner's PDF), `domain/buildProject.ts` (pure grid→events folder: normal/joint/team detection), `domain/gridReconstruct.ts` (project→grid for the round-trip), `fixtures/bundled.ts` (`buildBundledProject`, `BUNDLED_DATA_VERSION=1`, VPPS metadata), read-only `ui/app/App.tsx` + `ui/grid/WeekGrid.tsx` (+ `App.test.tsx`), heatwave profile (`buildHeatwaveProfile`).
- **Prior (REBUILD)**: **RB0 — event-model foundation.** `domain/types.ts` (v6), `profile.ts`, `derive.ts` (eventId-keyed occupancy), `validate.ts` (HE1–HE7), clash tests both directions. Deleted all cell-model `src/`.

## Next action (REBUILD — start RB4)

**RB3 is COMPLETE** (committed `f72ba28`). Next is **RB4 — Teacher load & insights**: load bars, week heatmap (teacher × day), free-period report, balance meter, free-teacher finder (who's free at a slot). AC: numbers equal `deriveMaps()` counts (property test); the free-teacher finder excludes anyone in an event (incl. joint/team) at that slot. `Insights.TeacherLoad` already shows a per-teacher load bar; extend into a proper insights view. Build the finder on `deriveMaps.teacherCells` (a teacher is busy at a slot iff that slotKey has any occupancy — which already collapses joint/team to one occupancy per teacher).

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
- **`fixtures/classWisePdf.ts`** (6-period heatwave cells) is retained as reference; the heatwave profile exists but no heatwave *bundled timetable* is built yet (secondary; add if needed).
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