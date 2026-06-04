# Decisions Log (append-only)

Format: `YYYY-MM-DD — decision — rationale`

- 2026-06-04 — New repo, separate from `timetable2025`; integration via legacy rawData export only — keeps the deployed viewer stable; the generator has different architectural needs.
- 2026-06-04 — Hand-rolled TS solver in a Web Worker, no CP libraries — problem size ≤ 504 cells; keeps bundle small, fully free, debuggable, deterministic.
- 2026-06-04 — ELGA modeled as an atomic `BlockActivity` (5 classes × 5 teachers × 3 consecutive periods) — matches reality: students regroup by English level across Classes 1–5; partial moves are meaningless.
- 2026-06-04 — Build order: editor with live validation first, solver second — schools trust a tool that catches mistakes before they trust black-box generation.
- 2026-06-04 — No backend/auth/sync in v1; IndexedDB + JSON file export — zero cost, offline-first, matches school's existing PWA philosophy.
