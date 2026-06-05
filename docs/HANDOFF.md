# HANDOFF — living session state

This file is the bridge between work sessions. The agent MUST update it after every completed milestone and before ending any session (see AGENTS.md § 6). Keep it short and current — it describes NOW, not history (history lives in git log and DECISIONS.md).

---

## Current state

- **Last completed milestone**: M7 — onboarding + data manager. 80 tests green; `npm run build` (83 KB gzip, under the 300 KB budget) and `npm run lint` clean. Verified live in the dev server: fresh user sees the empty state (no auto-seed); "Explore demo" loads a 16-class Mon–Sat grid with 0 conflicts; the wizard creates a project ("Maple High", 5 classes, 6 days); refresh restores; no console errors.
  - First-run empty state (`ui/app/EmptyState.tsx`): three paths — Set up / Import / Explore demo. `projectStore.init` no longer auto-seeds (loads from IndexedDB only; `initialized` flag distinguishes loading vs empty; early-returns if a project is in memory). `loadDemo()` loads the static demo.
  - Demo dataset: `fixtures/demoSchool.ts` (real roster, moderate quotas) → shared pure `domain/projectBuilder.ts` → solved ONCE at build time by `scripts/buildDemoFixture.ts` → committed `fixtures/vpps.demo.ttproj.json` (16 classes × 6 days, 322 placements, 0 hard). Gated by `fixtures/demo.test.ts`.
  - Setup wizard (`ui/manage/SetupWizard.tsx`, 5 steps) builds a project via `buildProject`. Data manager (`ui/manage/DataManager.tsx`) = CRUD for school/classes/teachers/quotas via pure cascading `domain/projectEdit.ts`. Toolbar "Data" button.
  - v1 untouched: `makeSampleProject`/`legacyRawSample` (2-day fixture) unchanged; the 2 tests asserting v1 auto-seed were re-specified (not deleted) to the v2 empty-state contract.
- **In-progress milestone**: M8 (not started)
- **Tests**: green — 80 tests across 22 files
- **Build**: green — typechecks + builds (83 KB gzip)

## Next action

Start **M8** (UI overhaul: modern app shell + readable grid). The App is still one monolithic `ui/app/App.tsx` with emoji-toolbar buttons and a whole-school day grid — M8 replaces this. Key AC: five tasks completable by a non-technical user without docs (change a lesson; find why a cell is red and fix it; fill gaps; print a teacher's week; mark a teacher absent); Escape closes every modal; ELGA appears once as a band per day. Plus: left-sidebar nav + draft switcher; subject color coding; compact cells (subject + abbreviated teacher, detail in popover); **ELGA as one merged band** (not 15 duplicate cells — currently `gridModel` emits a cell per class×period); plain-language relabel ("Complete (seed 1)" → "Fill the gaps"; "Generate…" → "Create timetables"; seeds/scores behind "Advanced"; S1–S6 → sentence sliders); conflict messages as click-to-jump sentences; per-class & per-teacher week views; responsive to tablet/phone (read-only grid on mobile). First concrete step: a shared modal shell with Escape + overlay-click close (refactor the 5 existing modals onto it), since it's reused everywhere and is a discrete AC. NOTE rule 8 (no jargon) + rule 10 (mobile) apply throughout.

## Mid-milestone notes (empty if between milestones)

(between milestones)

- Modals to migrate onto the shared Escape/overlay-close shell: `CandidateCompare`, `SubstitutionView`, `ExportImport`, `DataManager`, `SetupWizard` (all use `.modal-overlay`/`.modal-card` classes already — good hook).
- ELGA-as-band: `ui/grid/gridModel.ts` currently sets one `GridCell` per (class, period) for the block. For the merged band, the grid renderer needs block-span info (rowSpan across the 5 primary classes + colSpan across its periods) — extend gridModel to emit a band descriptor, or handle in `TimetableGrid` from placements. Keep the underlying model (one BlockActivity) — purely a rendering change.
- Jargon still user-facing (to fix in M8): `CompleteButton` "Complete (seed N)"; `CandidateCompare` "seed"/"Score"/"Hard"; `WeightEditor` "S1…S6" labels; `ViolationsPanel`/grid badges show "H1"/"S2" constraint codes; substitution/quota use "infeasible"-adjacent wording. Move codes/seeds/scores behind an "Advanced" disclosure.
- IMPORTANT honest claim (carried from v1): no real legacy-viewer `rawData` snapshot exists; M1 round-trip + M7 demo both use faithful SYNTHETIC data. Real-snapshot import and the live-viewer paste check remain owner-side.
- `domain/` + `solver/` tests run under Node; UI tests auto-use jsdom via `environmentMatchGlobs` (`src/ui/**`). Keep `domain/`+`solver/` pure.

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
