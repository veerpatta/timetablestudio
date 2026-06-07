# REBUILD (v6) — Timetable Studio, event-model rewrite

Decided 2026-06-07 by the owner after reviewing the live app against two fresh analyses of the real 2026-27 timetable (`docs/sources/VPPS_Timetable_Analysis_2026-27.md`, `..._Complexity_Analysis_2026-27.md`). This document is the master plan for the rewrite and **supersedes the M0–M22 roadmap** as the active direction. The old milestones remain in ROADMAP.md as history; do not continue them.

## Why rewrite

The app was built on a **cell model** (one cell = one class + one subject + one teacher). The real school runs on **events that span multiple classes and/or teachers**:

- **ELGA** = one team-taught block: 5 classes × 5 teachers, Mon–Thu P3–P5.
- **Senior combined classes** = one event, many sections: 11 Sci/Com/Arts share English & Hindi; 12 likewise; Economics is shared by Commerce+Arts. The cell model wrongly sees these as clashes or duplicates — the core reason the app "feels off."
- The bundled data is also the wrong **skeleton**: 6-period heatwave, while the real year is **8 periods + Assembly + Recess**.

Per the reports: *"Without an event-based model, the app will keep misunderstanding the school's actual timetable."* So we rebuild the core around events, ship the real 8-period timetable as the default, and rebuild the UI around one principle: **the user can only make legal moves.**

## Owner decisions (binding)

1. **Default = the real 8-period 2026-27 timetable**, pre-loaded so the owner only tweaks — never enters data from scratch.
2. **Full rewrite** of UI and engine. Reuse proven *concepts and tests* from the old build (validation logic, seeded solver, derive maps) but re-implement on the event model; do not carry the cell model forward.
3. **Legal-only editing**: clicking a slot offers only conflict-free, qualified options. Mistakes are designed out, not reported after the fact.

## North-star UX principles

1. **One screen, no modal maze.** A grid + one context side-panel. Everything is direct manipulation.
2. **You can't create a clash.** The editor only offers valid placements; illegal ones are never shown.
3. **One source, three live views.** Class / Teacher / Day are projections of the same events; editing any updates all instantly.
4. **The app does the work; you approve.** Auto-fill, swaps, and balancing are one click and always shown as a reviewable change, never silent.
5. **Plain language only.** Health dots, load bars, sentences — no codes, seeds, or jargon on the main surface.
6. **Always shippable.** It opens to a correct, complete timetable; the owner edits from a good state, not a blank one.

## Creative ideas brainstormed for "easy to play with" (build the starred ones)

- ★ **Legal-only cell picker** — click an empty/filled slot → a small palette shows only (qualified teacher × needed subject) options that are free in that slot. Pick one; done. No clash possible.
- ★ **Drag with auto-resolve** — drop a lesson on an occupied slot and the app offers the clean swap ("Swap with Class 7 Maths? both stay valid") instead of erroring.
- ★ **Ghost autocomplete** — empty teaching slots show a faint best-legal suggestion; click to accept, like tab-completion for a timetable.
- ★ **Inline health + load** — every class row has a status dot; every teacher a load bar (periods used / cap, free count). Glanceable, no separate report needed.
- ★ **"Explain this cell"** — click any cell → plain sentence: "Part of the ELGA block (Classes 1–5, Mon–Thu). Locked." or "Joint English for all Class 11 streams." So joint/team events are understood, not feared.
- ★ **Lock & fill** — pin what's good (or it's pinned by default), press *Fill the gaps*; the solver completes only the holes and shows a diff.
- ★ **Swap finder** — select a cell → "show legal swaps" lists only exchanges that keep everything valid (the everyday "a teacher asked to move" task).
- **Teacher-leaves simulation** — drop a teacher for a day/forever → instant substitution suggestions + impact ("Harshita has only 1 free period — fragile").
- **Command bar** (power users) — "Move Class 7 Maths off Monday", "give Anjana Friday off".
- **Scenario branches + version history** — try a change on a copy, compare side-by-side, promote with undo; named versions ("v2 after Physics fix").
- **Mobile teacher view** — each teacher's week on a phone; class noticeboard view.

## The event model (new source of truth)

This replaces the cell/Lesson/BlockActivity model. Full TypeScript spec goes in `docs/DATA_MODEL.md` (rewrite section) and `src/domain/types.ts` in the same commit. Shape:

- **TimetableEvent**: `{ id, type, subjectId, classIds[], teacherIds[], roomId?, duration, source }` where `type ∈ normal | joint_class | team_block | self_study | free | sports | robotics | ccs | notebook_check | assembly | recess`. One event can occupy many classes and many teachers in the same slot — this is the whole point.
- **Placement**: `{ eventId, day, period, pinned }` — events are placed onto the fixed grid.
- **Grid/Profile**: Assembly + 8 teaching periods + Recess as typed slots (teaching vs fixed-non-teaching). **The regular 8-period profile is the only profile.** (SUPERSEDED 2026-06-07: the "heatwave 6p switchable profile" idea was dropped by the owner — the product is 8-period only; see DECISIONS.md post-RB8.)
- **Qualification**: `{ teacherId, subjectId, classId }` triples — the only (teacher, subject, class) combos the engine may ever use.
- **Availability**: per-teacher mask over (day × period) for hard windows (Mahesh narrow; Anjana P5–P8 only; Director not schedulable).
- **Requirement**: per (class, subject) weekly period count + optional double-period preference, driving fill & quota checks.
- **Room/Resource**: optional field now (lab, ground, robotics) so it isn't retrofitted later.

Clash rule, restated for the event model: a teacher/class may appear in two placements in the same slot **only if they belong to the same event** (joint/team). Otherwise it's a real clash.

## Architecture (unchanged where it was right)

Vite + React + TS strict, Zustand, Tailwind, Vitest; pure `domain/` + `solver/` (Node-tested) in a Web Worker; IndexedDB; static deploy to GitHub Pages. Free, offline-first, no backend. Strict layering and the < 300-line-file rule still hold. The rewrite happens **in-place in this repo** (keep tooling, deploy, docs, git history); `src/` is rebuilt module-by-module behind a branch.

## Rebuild milestones (RB0 → RB8, strict order, AC-gated)

**RB0 — Event-model foundation.** New `domain/types.ts` (event model above), fixed 8-period grid with Assembly/Recess, derive → class/teacher/day maps, event-aware `validate()` (real clash vs legal joint/team overlap). AC: unit tests for clash logic incl. a joint-class and the ELGA block as non-clashes; build+lint green.

**RB1 — Real 2026-27 timetable as bundled default.** Transcribe the full 8-period timetable (all 16 classes) from the source analyses + PDFs into the event model: normal lessons, the ELGA team block, all senior joint classes (English/Hindi/Economics), special slots, qualifications, and the Mahesh/Anjana availability windows. AC: app opens to this timetable with **0 real clashes**, joint/team events render as single events, and a fixture test matches the source views cell-for-cell.

**RB2 — The legal-only editor (the heart).** Single-screen grid, class/teacher/day toggle, click-a-slot → legal-only picker, drag-with-auto-swap, ghost autocomplete, inline class-health dots + teacher load bars, "Explain this cell". No modals for editing. AC: scripted test proves the picker never offers a clashing/unqualified option; editing in one view updates the others; full keyboard + mobile-readable.

**RB3 — Smart validation & fixes.** Plain-language issue list that distinguishes real clashes from joint events, each with click-to-jump and a one-click safe fix where one exists. AC: on the bundled data, zero false clashes; a deliberately broken placement yields a readable issue + working fix.

**RB4 — Teacher load & insights.** Load bars, week heatmap (teacher × day), free-period report, balance meter, free-teacher finder (who's free at a slot). AC: numbers equal derive() counts (property test); finder excludes anyone in an event (incl. joint/team) at that slot.

**RB5 — Lock & auto-fill generator.** Place most-constrained first (Mahesh, Anjana), then pinned blocks + joint events, then fill remaining holes; present result as an accept/reject diff; deterministic per seed. AC: clearing ~30% of non-pinned slots and filling reaches 0 real clashes < 5 s in a Node test; pinned/joint/team events never moved.

**RB6 — Rules library.** Carry the configurable rules (core-early, subject spread, double periods, no-free-for-juniors, max teachers/day, teacher free-day, etc.) as sentence-first toggles; "Suggest rules" detects patterns in the bundled data. AC: each rule has satisfied+violated tests with plain messages; suggestions propose ≥3 real patterns, no duplicates.

**RB7 — Reports & export.** Class / teacher / day sheets matching the school's current PDF formats, plus workload, clash, subject-count, and free-period reports; legacy rawData export retained for the old viewer. AC: the three sheets visually match the source PDFs; reports reconcile with derive().

**RB8 — Operational tools.** Substitution planner (absent teacher → suggested covers), "what if teacher X leaves", named versions with compare, mobile teacher view, PWA offline. AC: marking a teacher absent yields valid covers respecting availability; versions compare and restore; installable offline.

## Honesty / guardrails for the rebuild

- Doc-first: every model change lands in DATA_MODEL.md in the same commit as the code.
- No silent automation: fills, swaps, balancing, and data updates always show a reviewable diff and are undoable.
- The source analyses + PDFs are ground truth; where they disagree with old fixtures, they win (note in DECISIONS.md).
- Keep the test discipline: `npm test`, `npm run lint`, `npm run build` green before any milestone is "done"; the deploy workflow gates on them.
