# AGENTS.md — Operating rules for AI agents (Claude Code, Codex, Cowork)

This file is the contract. If a user instruction conflicts with this file, ask; otherwise follow this file.

> **⚠ ACTIVE DIRECTION (2026-06-07): v6 REBUILD.** The product is being rebuilt on an **event model**. Read `docs/REBUILD.md` first — it is the master plan and supersedes the M0–M22 roadmap. Build with `docs/PROMPTS.md` Prompt G (milestones RB0–RB8). The authoritative data model is `docs/DATA_MODEL.md` § "v6 event model". The §1 guardrails below still hold (the "≤504 cells" figure is now ≈768; a hand-rolled deterministic TS solver in a Web Worker is still the rule).

## 1. Non-negotiable guardrails

- **No backend. No servers. No paid services.** If a feature seems to need one, redesign it client-side or stop and ask.
- **The solver must run in a Web Worker.** Never run constraint solving on the main thread.
- **No solver/CP libraries.** Write the solver in plain TypeScript (backtracking + min-conflicts heuristics). The problem size is small (≤ 504 cells); a hand-rolled solver is sufficient, debuggable, and dependency-free.
- **Solver must be deterministic given a seed.** Every generation accepts a `seed: number` so results are reproducible in tests and bug reports.
- **Never edit the legacy repo** (`timetable2025`). It is reference material only. Compatibility is one-directional: this app exports the legacy format; it never imports code from it.
- **TypeScript strict mode, no `any`** outside `*.d.ts`. All domain types come from `src/domain/types.ts` only — never redeclare domain shapes locally.
- **Every solver/validation change requires tests.** UI changes need tests where practical. `npm test` must pass before claiming a task done.
- **Dependencies require justification.** Allowed without asking: react, react-dom, zustand, idb, tailwindcss, vitest, @testing-library/react, dnd-kit. Anything else: state the reason in the PR/commit message.

## 2. Source of truth hierarchy

1. `docs/DATA_MODEL.md` — types and formats. If code and doc disagree, the doc wins; fix the code or propose a doc change.
2. `docs/CONSTRAINTS.md` — constraint semantics, IDs, and severities.
3. `docs/ROADMAP.md` — what to build and in what order. Do not start milestone N+1 while N's acceptance criteria are unmet.
4. `docs/SCHOOL_CONTEXT.md` — factual school data. Never invent teachers, classes, or subjects not listed there (tests may use synthetic data clearly marked as fixtures).

## 3. Architecture invariants

- Strict layering: `domain/` (pure types + logic, zero React imports) → `solver/` (pure, worker-wrapped) → `store/` (Zustand) → `ui/` (React). Lower layers never import from higher layers.
- `domain/` and `solver/` must be pure: no DOM, no IndexedDB, no `window`. This keeps them unit-testable in Node.
- Validation (conflict detection) and solving are separate modules. The editor uses validation alone; the solver uses validation as its feasibility oracle. One implementation, shared.
- All persistence goes through `src/persistence/` (IndexedDB + JSON file import/export). No component touches storage directly.
- Max ~300 lines per file. Split before you exceed it. We are explicitly avoiding a second 5,700-line `index.html`.

## 4. Workflow rules

- Work in small, verifiable increments. After each task: run `npm test` and `npm run build`, then report what changed.
- When a requirement is ambiguous, check the docs first, then ask one precise question. Do not silently invent product behavior.
- Update `docs/DECISIONS.md` (append-only log: date, decision, why) whenever you make a non-obvious technical choice.
- Commit messages: `M<milestone>: <imperative summary>` e.g. `M2: add teacher clash detection`.

## 5. Session protocol (marathon + handoff)

- `docs/HANDOFF.md` is the living session state. Update it: (a) after every completed milestone, (b) before ending any session, (c) whenever you stop mid-milestone. Use its template; describe NOW, not history.
- In marathon mode (large-context sessions), complete milestones back-to-back without asking permission to continue — but never start milestone N+1 with N's acceptance criteria unmet.
- Commit and push after every milestone (`M<n>: <summary>`); also commit before any risky refactor.
- Stop cleanly when degrading: >2 failed attempts at the same problem, or context pressure → get tests green, commit, push, write the handoff, end the session. A clean stop beats a long broken session.
- On resume, trust `git log` + `npm test` over HANDOFF.md if they disagree, and fix HANDOFF.md first.
- Session prompts live in `docs/PROMPTS.md` (Prompt A = marathon start, Prompt B = resume).

## 6. Domain quick-reference (details in docs/)

- 14 classes: Class 1–10, plus 11/12 × Arts/Commerce/Science. 6 days (Mon–Sat), 6 periods/day.
- **ELGA**: Classes 1–5 regroup by English level for 3 *consecutive* periods (currently P3–P5) on ELGA days. All five primary teachers (Bindu, Anita, Rashmita, Kusum, Ravina) are simultaneously occupied — a single ELGA block consumes 5 teachers × 5 classes atomically. It is modeled as one `BlockActivity`, never as independent cells.
- Multi-teacher cells exist beyond ELGA. A cell holds an `Activity` which may reference 1..n teachers and 1..n class groups.
- Teachers are shared across many classes; teacher availability is the binding constraint, not rooms.
