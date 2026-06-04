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
