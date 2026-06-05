# HANDOFF — living session state

This file is the bridge between work sessions. The agent MUST update it after every completed milestone and before ending any session (see AGENTS.md § 6). Keep it short and current — it describes NOW, not history (history lives in git log and DECISIONS.md).

---

## Current state

- **Last completed milestone**: M17 — Scenario workbench. **181 tests green (40 files);** build (102 KB gzip) + lint clean. Verified LIVE on the real VPPS demo: "Try a change" branches the live timetable; swap finder lists conflict-free exchanges for a selected lesson; targeted regenerate of Class 8 changed **16 cells, all Class 8, 0 new problems** and honestly surfaced a partial refit; Compare shows the change ledger; Promote to live then Undo (no errors).
  - **AC met**: (1) branch→edit→compare→promote loop with full undo (`store/scenarioStore.test.ts`); (2) swap finder returns only swaps that keep hard violations at 0 — property test re-validates each returned swap with an INDEPENDENT oracle + a negative case (`domain/scenario.test.ts`); (3) targeted regenerate changes ONLY the unfrozen scope — asserted changed-cells ⊆ scope on the real VPPS import.
  - Built — 17a (pure domain): `domain/scenario.ts` (`changeLedger` fixed/created via hard-key set-difference, `impactOfMove`, `legalSwaps`/`applySwap`, `withClearedScope`/`placementInScope` for targeted regen via the existing complete-solve — no engine/worker change). 17b (UI): `store/scenarioStore.ts` (session-only branch/discard/promote), `ui/scenario/` (ScenarioBar, ScenarioCompare, SwapFinder, RegenerateControl), `editorStore.swap`/`replaceActivePlacements` (undoable), grid click-to-select.
- **Previous milestones**: M16 — rules UI (builder + auto-detect + presets); M15 — domain rules/durations/block-days/schema v2.
- **In-progress milestone**: none — M17 complete, M18 next (the LAST v4 milestone).
- **Tests**: green — 181 tests across 40 files
- **Build**: green — typechecks + builds (102 KB gzip, well under the 300 KB budget); lint clean

## Next action (v4 — M18: Real-data reconciliation + everyday-ops polish)

Start **M18** (docs/ROADMAP.md § v4) — the LAST v4 milestone. Rule 16: the PDFs are ground truth; M18's cell-for-cell AC is against `docs/sources/Class_Wise.pdf`.
1. **Reconcile the dataset with the PDFs** so the in-app grid equals the printed truth: subjects missing from rawData (CCS, Revision, Sanskrit, practices, streams' electives — many ARE already in `rawData.vpps.txt`; cross-check against `Class_Wise.pdf`), the break (`ScheduleProfile.break` after P4), board flags (R9/`isBoardClass` for 10, 12A/C/S), P1 anchors (R4/`classTeacherId`).
2. **Entity lifecycle ease**: add/remove/rename teacher, subject, class, period-count — each with a guided impact flow ("Removing Maya affects 11 placements — reassign to whom?"). `domain/projectEdit.ts` already cascades deletes; add rename + an impact-preview before destructive ops.
3. **Period-count change wizard** (6→7 or 6→5) remapping placements with explicit owner decisions.
4. **Print/export parity** with the current PDFs (class-wise, teacher-wise, day-wise sheets) — week views + print CSS exist (M10/M13); align formatting.
- **AC**: in-app grid matches `Class_Wise.pdf` cell-for-cell after reconciliation (scripted comparison against a transcribed fixture — likely transcribe `Class_Wise.pdf` to a fixture and diff vs the imported grid); removing a teacher walks through reassignment without ever leaving a dangling reference; the three print views visually match the school's current formats.

Note: `rawData.vpps.txt` is the machine-readable SUBSET; `Class_Wise.pdf` is authoritative and RICHER. Where they differ, the PDF wins (note in DECISIONS). The current demo import (`makeRealVppsProject`) reads `rawData.vpps.txt`; M18 must reconcile any gaps the PDF reveals. Domain facts already modeled across M15–M17 (rules R1–R15, durations, block days, anchors, board flags, break, scenario workbench) are the substrate.

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
