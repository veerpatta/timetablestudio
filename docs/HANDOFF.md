# HANDOFF — living session state

This file is the bridge between work sessions. The agent MUST update it after every completed milestone and before ending any session (see AGENTS.md § 6). Keep it short and current — it describes NOW, not history (history lives in git log and DECISIONS.md).

---

## Current state

- **Last completed milestone**: **M18 — Real-data reconciliation + everyday-ops polish. v4 (M15–M18) COMPLETE.** 192 tests green (43 files); build (103 KB gzip) + lint clean.
  - **AC met**: (1) the in-app grid matches `Class_Wise.pdf` CELL-FOR-CELL — 576/576, scripted against the transcribed `fixtures/classWisePdf.ts` under `pdfSubjectLabel` (`classWisePdf.test.ts`); (2) removing a teacher walks through reassignment with ZERO dangling references (`lifecycle.test.ts` + live); (3) the three print views (per-class week, per-teacher week, whole-school day) carry the reconciled clock + positioned break, mirroring the PDF formats (live-verified; pixel-exact match is owner-side, standard caveat).
  - Built: `domain/reconcile.ts` (PDF clock + break + board flags + `PDF_SUBJECT_ALIASES`; applied in `makeRealVppsProject`), `domain/lifecycle.ts` + `ReassignTeacherModal` (teacher reassignment), `fixtures/classWisePdf.ts` (full PDF transcription) + comparison test, `WeekGrid`/`TimetableGrid` clock+break headers. The cross-check caught one real PDF-vs-rawData label diff ("Science Practice"→"Sci. Practice") — aliased, PDF wins.
- **Completed milestones**: M17 — scenario workbench; M16 — rules UI; M15 — domain rules/durations/block-days/schema v2. (v1 M0–M6, v2 M7–M10, v3 M11–M14 complete since prior sessions.)
- **In-progress milestone**: none — **all of v1, v2, v3, v4 complete.**
- **Tests**: green — 192 tests across 43 files
- **Build**: green — typechecks + builds (103 KB gzip, well under the 300 KB budget); lint clean

## Next action (v5 — start M19)

Owner review #3 (2026-06-05): two blockers found live — (1) returning browsers keep the OLD stored project, so the M18 real dataset never reaches existing users (the owner sees stale wrong data); (2) the suggestions panel floods (275 raw lines, duplicate items, [S1]/[S4] codes leaking). v5 spec: docs/ROADMAP.md § v5 (M19 zero-setup bundled real timetable + stale-data banner; M20 health score + grouped top-5 + one-click fixes + Tidy-up; M21 teacher-load heatmap/fairness/free-teacher finder; M22 rule templates R16–R24 + weight presets + suggest-rules). Use **Prompt F**. Begin with M19.

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