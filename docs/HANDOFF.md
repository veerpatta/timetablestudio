# HANDOFF — living session state

This file is the bridge between work sessions. The agent MUST update it after every completed milestone and before ending any session (see AGENTS.md § 6). Keep it short and current — it describes NOW, not history (history lives in git log and DECISIONS.md).

---

## Current state

- **Last completed milestone**: M5 — substitution assistant. 64 tests green; `npm run build` (73 KB gzip main + worker chunk) and `npm run lint` clean. Verified end-to-end in the dev server: marking Kusum absent on Mon flags the ELGA block "OWNER DECISION" (no auto-cover) and proposes Rakesh/Anjana for her other lessons (honest "no free qualified teacher" for EVS); no console errors.
  - `domain/substitution.ts` (PURE, read-only): `proposeSubstitutions(project, timetableId, {day, absentTeacherIds})` → per-slot cover items. ELGA/block → `owner-decision` (zero candidates); single-teacher lesson → `needs-cover` ranked by S1/S4; co-taught lesson → `partial`.
  - `ui/substitution/SubstitutionView.tsx` — modal: pick day + absent teachers, see the plan, print day sheet. `@media print` rules in index.css print only the sheet (App shell wrapped in `.app-shell`). Wired into toolbar ("Substitutions").
  - M0–M4 carryover still green.
- **In-progress milestone**: M6 (not started)
- **Tests**: green — 64 tests across 17 files
- **Build**: green — typechecks + builds (73 KB gzip main, separate worker chunk)

## Next action

Start M6 (ship): (1) Export UI — legacy rawData (copy-to-clipboard + file download via `exportLegacyRawData`) for the existing viewer, JSON backup (`serializeProject` + download, `suggestFilename`), and import (file picker → `deserializeProject` / `importLegacyRawData`); print stylesheet for the timetable grid (extend the M5 `@media print` scaffolding to print the grid). (2) PWA — `manifest.webmanifest` + a cache-first service worker (hand-rolled or `vite-plugin-pwa`; if adding the plugin, justify it — else write a tiny SW + manifest by hand to stay dependency-light) registered in `main.tsx`, offline-capable shell. (3) Deploy — a GitHub Pages Actions workflow building `dist/` (note `base: "./"` is already set in vite.config), documented in README. AC: Lighthouse PWA installable; full flow works offline; exported rawData pasted into the legacy viewer renders correctly. First concrete step: an Export/Import panel or modal using the already-tested `legacyExport`/`projectFile` functions (download via Blob + anchor), then the manifest + SW, then the Pages workflow. NOTE: prefer a hand-rolled SW (no new dep) caching the built assets (cache-first for the app shell); keep it tiny.

## Mid-milestone notes (empty if between milestones)

(between milestones)

- IMPORTANT honest claim: the M1 round-trip is an EXACT-string match against a canonical-format fixture written to the DATA_MODEL.md spec — NOT against real legacy-viewer output (no snapshot exists in this repo). A real-data round-trip will need a semantic compare; the true "paste into the legacy viewer" end-to-end check is the M6 AC. If a real `rawData` snapshot arrives, add it as a second fixture and a tolerant comparison.
- `domain/` + `solver/` tests run under Node (Vitest default); UI tests will auto-use jsdom via `environmentMatchGlobs` (`src/ui/**`). Keep validate() pure.

## Open questions for the owner

1. Per-class subject quotas (periods/week of each subject per class) — needed before M3; M1–M2 can use fixture estimates clearly marked TODO.
2. Teacher max loads and unavailable slots — defaults in DATA_MODEL.md apply until specified.
3. Which days carry the ELGA block, and is start period P3 fixed?

## Known TODOs / stubs in code

- `domain/legacyImport.ts` — block detection is keyed on the literal "ELGA" subject token; generalize only if a second block type appears (DECISIONS).
- No real `rawData` snapshot — `fixtures/legacyRaw.sample.ts` is synthetic-but-faithful; replace/augment when the owner provides one.
- Solver requirements are FIXTURE-DERIVED (`deriveRequirements` reads them off the sample timetable), not owner-authoritative quotas. Replace with real per-class subject quotas when the owner provides them (Open question 1). `maxPerDay` is inferred as `max(2, observed/day)`.
- Soft constraints (S1–S6) drive scoring + the weight editor + candidate ranking, but are NOT shown as per-cell amber badges in the editor grid (the grid overlay only reflects `validate()` hard violations). Optional polish; wire `scoreTimetable().soft` into `gridModel` overlay if desired.
- "generate" mode reaches 0 hard on both the roomy 6-day variant (tested) and the live 2-day sample (verified in-app); diversity is limited on the rigid 2-day data (expected).

---

## Template (replace sections above; do not append)

- Last completed milestone + one-line proof (e.g. "M2 — all AC pass, 47 tests green")
- In-progress milestone + exactly where you stopped
- Tests / build status (green/red, counts)
- Next action: the single concrete first step for the next session
- Mid-milestone notes: tricky context the next session needs (gotchas, half-done refactors)
- Open questions / TODO stubs: anything blocked on the owner
