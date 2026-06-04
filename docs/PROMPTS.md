# Copy-paste prompts for driving Claude Code / Codex

Use one milestone per session. Always start a session with the kickoff line.

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
