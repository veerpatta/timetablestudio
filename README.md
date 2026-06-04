# Timetable Studio

A free, fast, offline-first **timetable builder** for Veer Patta Public School (VPPS). It complements (does not replace) the existing read-only viewer PWA at `veerpatta/timetable2025`.

## What it does

1. **Constraint-aware editor (Phase 1)** — a drag-and-drop timetable grid that instantly flags conflicts: teacher double-booked, ELGA collisions, subject quota violations, teacher overload.
2. **Auto-complete (Phase 2)** — pin the hard cells (ELGA blocks, senior science), and a solver running in a Web Worker fills the rest.
3. **Full generation (Phase 3)** — define all constraints, generate N candidate timetables, compare and pick.
4. **Substitution assistant (Phase 4)** — "Teacher X is absent today, who covers each period?"

## Hard project rules

- **Zero cost**: no backend, no database server, no paid APIs. Everything runs in the browser. Data lives in IndexedDB + downloadable JSON files. Hosting on GitHub Pages or Firebase Hosting free tier.
- **Fast**: solver runs in a Web Worker, never blocks the UI. Target < 5s for auto-complete at VPPS scale (14 classes × 6 days × 6 periods).
- **Compatible**: must export the legacy `rawData` text format consumed by the existing viewer (see `docs/DATA_MODEL.md` § Legacy export).

## For AI agents

**Read these in order before writing any code:**

1. `AGENTS.md` — operating rules and guardrails, incl. the session/handoff protocol (Claude Code users: `CLAUDE.md` points here)
2. `docs/SCHOOL_CONTEXT.md` — the real school data and what makes it complex
3. `docs/DATA_MODEL.md` — canonical TypeScript types; the single source of truth
4. `docs/CONSTRAINTS.md` — the full constraint catalog (hard vs soft)
5. `docs/ARCHITECTURE.md` — stack, folder layout, solver design
6. `docs/ROADMAP.md` — milestones with acceptance criteria; work strictly in order
7. `docs/HANDOFF.md` — living session state: what's done, what's next
8. `docs/PROMPTS.md` — session prompts: Prompt A (marathon), Prompt B (resume)

## Stack (decided — do not relitigate)

Vite + React 18 + TypeScript (strict) · Zustand · Web Worker solver (plain TS, no solver libraries) · IndexedDB via `idb` · Tailwind CSS · Vitest · deploy as static files.

## Quick start

```bash
npm install
npm run dev      # local dev server (http://localhost:5173)
npm test         # vitest (Node by default; UI tests use jsdom)
npm run build    # tsc --noEmit typecheck, then static build to dist/
npm run lint     # eslint, no-explicit-any enforced
```
