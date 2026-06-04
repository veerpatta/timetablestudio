# CLAUDE.md

Read and obey `AGENTS.md` in this directory — it is the full operating contract for this repo.

Then read, in order: `docs/SCHOOL_CONTEXT.md`, `docs/DATA_MODEL.md`, `docs/CONSTRAINTS.md`, `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`.

Key reminders:

- Work milestones strictly in order (`docs/ROADMAP.md`); do not skip ahead.
- No backend, no paid services, solver in a Web Worker, deterministic with seed.
- Domain types live only in `src/domain/types.ts`; `docs/DATA_MODEL.md` is authoritative.
- `npm test` and `npm run build` must pass before reporting a task complete.
- Log non-obvious choices in `docs/DECISIONS.md`.
