# HANDOFF — living session state

This file is the bridge between work sessions. The agent MUST update it after every completed milestone and before ending any session (see AGENTS.md § 6). Keep it short and current — it describes NOW, not history (history lives in git log and DECISIONS.md).

---

## Current state

- **Last completed milestone**: none — repo contains planning docs only, no code yet
- **In-progress milestone**: M0 (not started)
- **Tests**: n/a (no code)
- **Build**: n/a (no code)

## Next action

Start M0: scaffold Vite + React + TS strict + Tailwind + Vitest + ESLint per docs/ARCHITECTURE.md folder layout, and implement `src/domain/types.ts` from docs/DATA_MODEL.md verbatim.

## Mid-milestone notes (empty if between milestones)

(none)

## Open questions for the owner

1. Per-class subject quotas (periods/week of each subject per class) — needed before M3; M1–M2 can use fixture estimates clearly marked TODO.
2. Teacher max loads and unavailable slots — defaults in DATA_MODEL.md apply until specified.
3. Which days carry the ELGA block, and is start period P3 fixed?

## Known TODOs / stubs in code

(none)

---

## Template (replace sections above; do not append)

- Last completed milestone + one-line proof (e.g. "M2 — all AC pass, 47 tests green")
- In-progress milestone + exactly where you stopped
- Tests / build status (green/red, counts)
- Next action: the single concrete first step for the next session
- Mid-milestone notes: tricky context the next session needs (gotchas, half-done refactors)
- Open questions / TODO stubs: anything blocked on the owner
