# Decisions Log (append-only)

Format: `YYYY-MM-DD — decision — rationale`

- 2026-06-04 — New repo, separate from `timetable2025`; integration via legacy rawData export only — keeps the deployed viewer stable; the generator has different architectural needs.
- 2026-06-04 — Hand-rolled TS solver in a Web Worker, no CP libraries — problem size ≤ 504 cells; keeps bundle small, fully free, debuggable, deterministic.
- 2026-06-04 — ELGA modeled as an atomic `BlockActivity` (5 classes × 5 teachers × 3 consecutive periods) — matches reality: students regroup by English level across Classes 1–5; partial moves are meaningless.
- 2026-06-04 — Build order: editor with live validation first, solver second — schools trust a tool that catches mistakes before they trust black-box generation.
- 2026-06-04 — No backend/auth/sync in v1; IndexedDB + JSON file export — zero cost, offline-first, matches school's existing PWA philosophy.
- 2026-06-04 (M0) — Tailwind v3.4 with classic `tailwind.config.js` + `postcss.config.js` (not v4 CSS-first config) — v4's config model is churn we don't want in a deterministic build.
- 2026-06-04 (M0) — `build` script is `tsc --noEmit && vite build` (not bare `vite build`) — esbuild strips types without checking; this makes "strict, no any" actually enforced at build time. Paired with ESLint `@typescript-eslint/no-explicit-any` (strict catches implicit any; the rule catches explicit any).
- 2026-06-04 (M0) — Vitest default `environment: "node"`; UI tests opt into jsdom via `environmentMatchGlobs` (`src/ui/**`, `*.dom.test.tsx`) — keeps the domain/solver purity invariant (AGENTS.md §3) self-policing: impure DOM code can't silently pass in those layers.
- 2026-06-04 (M0) — Single `tsconfig.json` (dropped composite project references) — `tsc --noEmit` is incompatible with `composite`/`references` emit; one config is simpler and still typechecks vite.config.ts.
- 2026-06-04 (M0) — Dev deps beyond the AGENTS.md §1 pre-approved list, all standard for this stack: `vite`, `@vitejs/plugin-react`, `typescript`, `@types/*`, `@typescript-eslint/*`, `eslint` (+ react-hooks, react-refresh plugins), `jsdom`, `postcss`, `autoprefixer`, `@testing-library/jest-dom`. Each is required by the decided stack (ARCHITECTURE.md); no runtime/solver libraries added.
