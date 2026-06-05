# HANDOFF — living session state

This file is the bridge between work sessions. The agent MUST update it after every completed milestone and before ending any session (see AGENTS.md § 6). Keep it short and current — it describes NOW, not history (history lives in git log and DECISIONS.md).

---

## Current state

- **In-progress milestone**: **M18 — Real-data reconciliation + everyday-ops polish (PARTIAL).** The PDF structural reconciliation landed; the rest of M18 remains (see Next action). **187 tests green (41 files);** build (102 KB gzip) + lint clean.
  - **Done this increment (M18 1/n)**: read the authoritative `Class_Wise.pdf` (all 16 classes) and compared to the rawData import — cells already MATCH in subject+teacher; only differences are subject-label verbosity, board flags, and the dropped clock/break. `domain/reconcile.ts` (pure) applies the PDF's structural facts: real heatwave clock + break after P4 (10:10–10:25) on the profile, `isBoardClass` on exactly Class 10/12 Arts/Commerce/Science; `PDF_SUBJECT_ALIASES` (display/compare map, NOT a rename — keeps the byte-exact round-trip). Wired into `makeRealVppsProject`. `reconcile.test.ts` (6 tests) incl. board-class P1 anchors verified cell-for-cell vs the PDF under the alias map. Idempotent on cell data (placements/subjects untouched).
- **Completed milestones**: M17 — scenario workbench (branch/compare/promote + undo, swap finder, targeted regenerate; verified live). M16 — rules UI (builder + auto-detect + presets). M15 — domain rules/durations/block-days/schema v2.
- **Tests**: green — 187 tests across 41 files
- **Build**: green — typechecks + builds (102 KB gzip, well under the 300 KB budget); lint clean

## Next action (finish M18 — 4 remaining AC pieces, in order)

The PDF cells were proven to match the import EXCEPT the documented `PDF_SUBJECT_ALIASES`, so the remaining work is now well-scoped:

1. **Full cell-for-cell PDF fixture + comparison (AC#1, the defining piece).** Transcribe all 16 classes × 6 days × 6 periods of `Class_Wise.pdf` into a fixture (subject label + teacher per cell; ELGA cells = the block). Then a scripted test builds the grid from `makeRealVppsProject` and asserts it equals the fixture cell-for-cell UNDER `pdfSubjectLabel` (the alias map). The cross-check catches transcription errors (any mismatch is either a real PDF-wins diff to fix in favour of the PDF, or a typo). I already spot-verified the board-class P1 anchors match — expect the rest to match under aliases. The full PDF text is in this session's transcript / re-read `docs/sources/Class_Wise.pdf` (16 pages, one per class).
2. **Entity-lifecycle reassignment flow (AC#2).** Removing a teacher must walk through reassignment, never leaving a dangling reference. `domain/projectEdit.removeTeacher` already cascades; ADD: a rename op + a pre-delete impact preview ("Removing Maya affects N placements — reassign to whom?") with a reassign-to-teacher choice. UI: a confirm/reassign modal on the Teachers page.
3. **Period-count change wizard (6→7 / 6→5).** Remap placements with explicit owner decisions (which lessons drop when shrinking; where the new column goes when growing). `setActiveProfile` already resizes the period array — add the placement-remap + a guided modal.
4. **Print/export parity** with the three PDF formats (class-wise, teacher-wise, day-wise). Week views + print CSS exist (M10/M13); align headers/timings (use the now-reconciled clock + break) to match the school's sheets.
- **Full AC**: in-app grid matches `Class_Wise.pdf` cell-for-cell (scripted, against the transcribed fixture); removing a teacher walks through reassignment without a dangling reference; the three print views visually match.

Note: `rawData.vpps.txt` is the machine-readable SUBSET; `Class_Wise.pdf` is authoritative. Where they differ the PDF wins (DECISIONS). The only known differences are the subject-label aliases (already mapped) + the structural facts (already applied) — no cell/teacher discrepancies were found in the spot-checks.

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
