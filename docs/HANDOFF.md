# HANDOFF — living session state

This file is the bridge between work sessions. The agent MUST update it after every completed milestone and before ending any session (see AGENTS.md § 6). Keep it short and current — it describes NOW, not history (history lives in git log and DECISIONS.md).

---

## Current state

- **Last completed milestone**: M6 — ship. **All milestones M0–M6 complete.** 66 tests green; `npm run build` (74 KB gzip main + worker chunk, well under the 300 KB budget) and `npm run lint` clean. Verified in a production `vite preview`: SW registers and controls the page, cache holds the shell + JS/CSS, manifest exposes 192/512 icons; no console errors.
  - Export/Import (`ui/io/ExportImport.tsx` + `download.ts`): legacy rawData (copy + download) via `exportLegacyRawData`, JSON backup via `serializeProject`/`suggestFilename`, import of JSON (`deserializeProject`) and legacy rawData (`importLegacyRawData`→`normalizeProject`). Reads files via `readFileText` (FileReader, jsdom-safe). Tested in jsdom.
  - Print: two `@media print` targets — default prints the grid (chrome `.no-print`), `body.print-subs` prints the substitution sheet. Toolbar "Print" button.
  - PWA: `public/manifest.webmanifest` + hand-rolled `public/sw.js` (cache-first shell + runtime asset caching), registered PROD-only in `main.tsx`; icons via `scripts/makeIcons.mjs` (dependency-free PNG encoder). No new deps.
  - Deploy: `.github/workflows/deploy.yml` (lint+test+build → GitHub Pages); README documents the one-time Pages setting. `base: "./"` already set.
  - M0–M5 carryover still green.
- **In-progress milestone**: none — v1 roadmap complete.
- **Tests**: green — 66 tests across 18 files
- **Build**: green — typechecks + builds (74 KB gzip main, separate worker chunk)

## Next action

v1 roadmap (M0–M6) is complete and DEPLOYED. Live at https://veerpatta.github.io/timetablestudio/ (GitHub Pages enabled via API with `build_type=workflow`; deploy workflow green; root + manifest + sw.js all 200, relative `./` asset paths resolve under the `/timetablestudio/` subpath). Suggested next steps (none blocking), in rough priority:
1. Paste exported rawData into the LIVE legacy viewer to close the last AC empirically (no viewer instance was available in-session). Optionally install the PWA from the live URL to confirm Lighthouse "installable".
2. Replace the synthetic `fixtures/legacyRaw.sample.ts` with a real `rawData` snapshot from the viewer; add a tolerant (semantic) round-trip comparison alongside the exact one.
3. Owner-authoritative data: real per-class subject quotas + teacher caps/unavailability (currently fixture-derived) — see Open questions. Then the solver targets real requirements.
4. Polish: soft (amber) badges in the editor grid; a timetable/draft switcher UI; generalize block detection beyond the literal "ELGA" token if a second block type appears.

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
