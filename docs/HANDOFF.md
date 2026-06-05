# HANDOFF — living session state

This file is the bridge between work sessions. The agent MUST update it after every completed milestone and before ending any session (see AGENTS.md § 6). Keep it short and current — it describes NOW, not history (history lives in git log and DECISIONS.md).

---

## Current state

- **Last completed milestone**: M11 — Storage resilience (never brick). **v3 in progress.** 107 tests green; `npm run build` (88 KB gzip) and `npm run lint` clean. Verified live: demo still boots to a clean grid, 0 console errors.
  - **AC met**: (1) a test simulating a never-resolving `indexedDB.open` renders the recovery screen under fake timers (`src/ui/app/storageRecovery.test.tsx`); (2) "Start fresh" wipes storage and lands on the empty state (same test); (3) no "Loading…" path lingers — every `db.ts` op is `withTimeout`-bounded (3 s), `init` catches failure → recovery, and the old second infinite-spinner path (`!derived`) now routes to a corrupt-data recovery screen.
  - Built: timeout-wrapped `persistence/db.ts` (+`resetDbConnection`, `deleteAllData`, `StorageTimeoutError`); `projectStore` `storageStatus`/`saveFailed`/`retryStorage`/`readBackup`/`startFresh`; `ui/app/RecoveryScreen.tsx` (two variants); non-blocking amber autosave-failure banner in `App.tsx`.
- **In-progress milestone**: none between — M11 done, **M12 is next**.
- **Tests**: green — 107 tests across 31 files
- **Build**: green — typechecks + builds (88 KB gzip, well under the 300 KB budget)

## Next action (v3 — start M12)

M12 — Real VPPS data as the spine. The REAL full 6-day snapshot is at `docs/sources/rawData.vpps.txt` (16 classes, Mon–Sat). Tasks: (a) add the tolerant/semantic round-trip test that v1/v2 deferred, using the real snapshot as fixture; fix whatever it flushes out (multi-teacher cells, "English compulsory", senior streams); (b) make the demo the REAL VPPS school (drop/relegate synthetic demo to tests only); (c) import → editable inferred-quota review flow after a legacy import. AC: importing the snapshot yields 6 day-tabs, 16 classes, 0 hard conflicts, ELGA as bands; semantic round-trip green; inferred-quota review screen shown + editable.

**Rule-13 contradiction to fix in M12** (flagged by advisor): the real snapshot runs ELGA on **Mon–Thu, P3–P5** (4 days), but SCHOOL_CONTEXT/HANDOFF/demo assume "Mon+Thu". The snapshot is law — update SCHOOL_CONTEXT.md (and any demo assumption) to Mon–Thu and log it in DECISIONS.md.

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
