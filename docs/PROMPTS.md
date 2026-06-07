# Copy-paste prompts for driving Claude Code / Codex

Two ways to work:

- **Marathon mode (recommended for large-context models, e.g. Opus 1M)** — one session runs as many milestones as possible end-to-end. Use Prompt A; resume with Prompt B.
- **Single-milestone mode** — one milestone per session. Use the per-milestone prompts further down.

The session handoff protocol both modes rely on is defined in `AGENTS.md` § 6 and lives in `docs/HANDOFF.md`.

## Prompt A — Marathon session (start of project, or fresh start)

> You are building this project end-to-end. First read, fully: AGENTS.md, docs/SCHOOL_CONTEXT.md, docs/DATA_MODEL.md, docs/CONSTRAINTS.md, docs/ARCHITECTURE.md, docs/ROADMAP.md, docs/HANDOFF.md. Then work through the milestones in docs/ROADMAP.md strictly in order (M0 → M6), as many as you can in this session, under these rules:
>
> 1. Before each milestone: state the milestone and its acceptance criteria in one short list. No long plans — the plan already exists in ROADMAP.md.
> 2. Implement in small increments. After each meaningful unit: run `npm test` and `npm run build`. Never proceed on red.
> 3. A milestone is done ONLY when every acceptance criterion demonstrably passes. Then: (a) update docs/HANDOFF.md per its template, (b) append any non-obvious choices to docs/DECISIONS.md, (c) commit as `M<n>: <summary>` and push, (d) immediately continue to the next milestone without asking permission.
> 4. Do not ask me questions you can answer from the docs. Ask ONLY if you hit an owner-level product decision (e.g. unknown subject quotas) — and if one blocks you, record it in HANDOFF.md § Open questions, stub it with a clearly marked TODO + fixture default, and keep going if safely possible.
> 5. Never weaken, skip, or delete tests to make progress. Never violate AGENTS.md § 1.
> 6. Self-review checkpoint after each milestone: re-read AGENTS.md § 1 and § 3 and confirm in one line that you are compliant (layering, file size, purity, determinism).
> 7. If you sense the session degrading (context pressure, repeated mistakes, or >2 failed attempts at the same problem): STOP cleanly — finish the current increment, get tests green, commit, push, and write a complete handoff in docs/HANDOFF.md including exactly where you stopped mid-milestone and what the very next action is.
>
> Begin now with the first incomplete milestone according to docs/HANDOFF.md and the git log.

## Prompt B — Resume session (every later session)

> Continue building this project. Read AGENTS.md, then docs/HANDOFF.md (current state), then docs/ROADMAP.md. Verify reality before trusting the handoff: run `git log --oneline -10`, `npm test`, and `npm run build`. If tests are red, fix them before anything else. Then resume from "Next action" in docs/HANDOFF.md and continue under the marathon rules in docs/PROMPTS.md Prompt A (rules 1–7). Do not re-plan or refactor completed milestones unless a test failure forces it.

## Prompt C — v2 overhaul marathon (UX + solver, M7–M10)

> v1 is live but a product review found serious usability gaps — they are documented in docs/ROADMAP.md § v2 and docs/HANDOFF.md. Read AGENTS.md, docs/HANDOFF.md, then the v2 section of docs/ROADMAP.md in full. Verify reality first: `git log --oneline -10`, `npm test`, `npm run build`. Then work M7 → M10 in strict order under the marathon rules in Prompt A (rules 1–7), with these additions:
>
> 8. UX copy rule: no user-facing developer jargon — no "seed", "infeasible", "H1", "S1", or constraint codes outside an "Advanced" disclosure. Every conflict message is a plain sentence naming teacher/class/day/period.
> 9. Do not regress v1: the legacy rawData export, solver determinism, and all 66+ existing tests must stay green; extend, don't rewrite, `domain/` and `solver/` (M9's engine upgrade may refactor `solver/engine.ts` internals but must keep the worker protocol and determinism-per-seed contract).
> 10. Mobile matters: teachers will open the grid on phones — M8's responsive AC is not optional polish.
>
> Begin with M7.

## Prompt D — v3 marathon (non-technical usability, M11–M14)

> v2 shipped but a second owner review found the app still assumes a technical user — findings and fixes are specified in docs/ROADMAP.md § v3. Read AGENTS.md, docs/HANDOFF.md, docs/ROADMAP.md § v3, and docs/SCHOOL_CONTEXT.md (note: the REAL 6-day rawData snapshot now lives at docs/sources/rawData.vpps.txt — it supersedes synthetic fixtures). Verify reality first: `git log --oneline -10`, `npm test`, `npm run build`. Then work M11 → M14 in strict order under the marathon rules (Prompt A rules 1–7) plus Prompt C's rules 8–10, and:
>
> 11. Resilience rule: no code path may strand the user on a spinner or blank screen — every async boundary (storage, worker, import) needs a timeout + a plain-language recovery action.
> 12. Data-entry rule: no newline- or comma-separated text fields for structured data; use proper inputs (chips, selects, matrix cells) with inline validation that says why something is invalid.
> 13. The real snapshot is law: where docs/sources/rawData.vpps.txt contradicts a synthetic fixture or an assumption in docs, the snapshot wins — update the doc and note it in DECISIONS.md.
>
> Begin with M11.

## Prompt E — v4 marathon (rule system + scenario workbench, M15–M18)

> The owner has supplied the REAL working timetable (docs/sources/Class_Wise.pdf is authoritative; Teacher_Wise/Day_Wise are projections; rawData.vpps.txt is the machine-readable subset). The analysis of it is docs/TIMETABLE_ANALYSIS.md and the v4 spec is docs/ROADMAP.md § v4 + docs/CONSTRAINTS.md § v4 Rule system. Read AGENTS.md, docs/HANDOFF.md, docs/TIMETABLE_ANALYSIS.md, docs/CONSTRAINTS.md, docs/ROADMAP.md § v4. Verify reality first: `git log --oneline -10`, `npm test`, `npm run build`. Then work M15 → M18 in strict order under the marathon rules (Prompt A rules 1–7) plus rules 8–13 from Prompts C/D, and:
>
> 14. Doc-first: M15 must add the `Rule` types to docs/DATA_MODEL.md in the same commit as `src/domain/types.ts` — the doc and code may never disagree.
> 15. Sentence-first UI: every rule renders as a readable sentence; parameter pickers fill blanks in the sentence. If a rule can't be read aloud naturally, redesign it.
> 16. The PDFs are ground truth: where Class_Wise.pdf disagrees with rawData.vpps.txt or any fixture, the PDF wins (note differences in DECISIONS.md). M18's cell-for-cell AC is against the PDF.
>
> Begin with M15.

## Prompt F — v5 marathon (zero-setup + zero-noise, M19–M22)

> v4 is complete but the owner's live review found the product still fails its dailyiest job: returning browsers keep stale data (the real dataset never arrives), and the suggestions panel is an unusable flood (275 raw lines, codes leaking). The spec is docs/ROADMAP.md § v5 and docs/CONSTRAINTS.md § v5 additions. Read AGENTS.md, docs/HANDOFF.md, docs/ROADMAP.md § v5, docs/CONSTRAINTS.md. Verify reality: `git log --oneline -10`, `npm test`, `npm run build`. Work M19 → M22 in strict order under all prior rules (Prompt A 1–7, C 8–10, D 11–13, E 14–16), and:
>
> 17. Nothing automatic is silent: every auto-fix, tidy-up, or data update presents a readable diff/ledger and applies only on accept, with one-step undo.
> 18. Noise budget: the default UI may never show more than ~20 suggestion items or any constraint code; if a list can exceed that, group and rank it first.
> 19. The bundled dataset version is sacred: bump `bundledDataVersion` whenever the built-in timetable changes, and never overwrite a user's project without keeping it as a draft.
>
> Begin with M19.

## Prompt G — REBUILD marathon (v6 event model, RB0–RB8) — CURRENT DIRECTION

> The product is being rebuilt. The master plan is docs/REBUILD.md and it SUPERSEDES the M0–M22 roadmap — do not continue the old milestones. Read, fully: AGENTS.md, docs/REBUILD.md, docs/sources/VPPS_Timetable_Analysis_2026-27.md, docs/sources/VPPS_Timetable_Complexity_Analysis_2026-27.md, then docs/DATA_MODEL.md (the v6 event-model section is authoritative) and docs/CONSTRAINTS.md. Verify reality: `git log --oneline -10`, `npm test`, `npm run build`. Then build RB0 → RB8 in strict order under the marathon rules (Prompt A 1–7) plus all earlier additions (no jargon on the main surface; nothing automatic is silent — always a reviewable, undoable diff; doc-first model changes), and:
>
> 20. Event model is the law: a TimetableEvent may span many classes and many teachers; an overlap is a real clash ONLY if the entities are in different events. ELGA (team_block) and senior combined classes (joint_class) must render and move as single events.
> 21. The app opens to the real 8-period 2026-27 timetable (RB1), pre-loaded and clash-free, so the owner only tweaks. The 6-period heatwave is a secondary switchable profile.
> 22. Legal-only editing: the cell picker may NEVER offer an unqualified teacher or a clashing placement. Prove it with a test.
> 23. Full rewrite in-place: rebuild src/ on the event model; you may delete cell-model code, but re-derive its proven validation/solver logic and keep the tests' intent. Keep tooling, deploy workflow, and docs.
>
> Begin with RB0.

## Prompt H — CUSTOMIZE marathon (v6.1: editing, applied constraints, electives) — CURRENT DIRECTION

> The v6 rebuild is live but mostly view-only. Next phase makes it fully editable, gives it a REAL applied constraint system, and fixes the Arts elective problem. Master plan: docs/CUSTOMIZE.md (it sequences milestones C1–C7 and supersedes the old static-rules idea). Read, fully: AGENTS.md, docs/CUSTOMIZE.md, docs/DATA_MODEL.md (v6 + v6.1 sections are authoritative), docs/CONSTRAINTS.md (v6.1 catalog). Verify reality: `git log --oneline -10`, `npm test`, `npm run build`. Then build C1 → C7 in strict order under the marathon rules (Prompt A 1–7) plus the standing additions (no jargon on the main surface; nothing automatic is silent — reviewable, undoable diffs; doc-first model changes; legal-only editing), and:
>
> 24. Constraints must actually apply: every Constraint drives validate() (must) and generate()/score() (prefer), with live cell highlighting and plain-sentence messages. A constraint the user can create but that changes nothing is a bug. The two owner examples — "subject in the first half" and "teacher max 30/week" — must work end-to-end.
> 25. Editing is real CRUD with safe impact: add/remove/rename teacher, subject, class, period; removing anything walks the user through reassigning or confirming affected events — never leave a dangling reference or a silent clash.
> 26. Electives = student groups + option lines: an elective event is attended only by the student groups that chose it; no student group is ever placed in a non-chosen subject (C5 AC). Honor that Prakash can't teach Economics and Geography at once; parallelize electives only when the chosen combinations are clash-free, else give opted-out groups a supervised study period.
>
> Begin with C1.

## Per-milestone prompts (single-milestone mode)

Always start a session with the kickoff line.

## Kickoff (every session)

> Read AGENTS.md, then docs/SCHOOL_CONTEXT.md, docs/DATA_MODEL.md, docs/CONSTRAINTS.md, docs/ARCHITECTURE.md, docs/ROADMAP.md. Tell me which milestone is currently incomplete and list its remaining acceptance criteria before writing any code.

## M0

> Implement milestone M0 from docs/ROADMAP.md exactly. Stack and folder layout are fixed in docs/ARCHITECTURE.md — do not substitute tools. Stop when all M0 acceptance criteria pass and show me the output of npm test and npm run build.

## M1

> Implement milestone M1. The legacy rawData format is specified in docs/DATA_MODEL.md § Legacy export; a real sample lives in the sibling repo timetable2025 (read-only reference — never modify it). The ELGA detection rule and worked example are in docs/CONSTRAINTS.md. Write the round-trip test first.

## M2

> Implement milestone M2. Validation must reuse domain/validate.ts — do not duplicate conflict logic in components. Demo each acceptance criterion to me with a test or a short screen recording description.

## M3

> Implement milestone M3. The solver design (ordering heuristics, seeded PRNG, budgets, worker protocol) is fixed in docs/ARCHITECTURE.md. Write the determinism test (same seed → identical placements) before the engine.

## M4 / M5 / M6

> Implement milestone M<N> per docs/ROADMAP.md. Confirm the previous milestone's acceptance criteria still pass first.

## When the agent drifts

> Stop. Re-read AGENTS.md section 1 and docs/ROADMAP.md. You are violating: <rule>. Revert the off-plan changes and continue within the current milestone.
