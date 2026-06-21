# PLAN — Making the Timetable Generator Rarely Get Stuck

> Status: proposed (2026-06-21). Owner-approved direction: **auto-relax soft rules, ask before bending hard rules**; **optional free backend** documented alongside the in-browser default; prioritise all four flexibility ideas (flexible qualified swaps, partial-fill + gap report, constraint priority tiers, auto-suggest fixes).
>
> This plan extends the existing engine (`src/solver`, `src/domain`). It does **not** relitigate the stack or the zero-cost default. Work the milestones in order; each is shippable on its own.

---

## 1. The problem, stated plainly

VPPS is a hard instance: 16 classes, 18 teachers, 6×6 grid, heavy teacher coupling (Hemlata, Pradhyuman, Prakash span senior streams), atomic ELGA blocks Mon–Thu P3–P5, P1 class-teacher anchors, intentional doubles, and board-class protection. Teacher availability — not rooms — is the binding constraint.

Today the engine is **correct but brittle at the edges**. When the instance is over-constrained it does the honest thing: it reports blockers and stops, or returns a timetable with a few stubborn empty cells. That is the right behaviour for a *correct* tool, but it feels like hitting a wall. The owner's real loop is *import → tweak → see what breaks → print*, so "it's impossible" is the least useful possible answer.

The goal of this plan: **the generator almost never returns a flat "not possible." Instead it returns the best near-complete timetable it can, tells you in plain language the smallest change that would close the gap, bends the rules you've allowed it to bend, and asks before bending the ones you haven't.**

The key reframe: **stop treating the timetable as a yes/no satisfiability problem and treat it as an optimisation problem** — always produce *a* result, ranked by how little it had to compromise.

---

## 2. What already exists (so we extend, not rebuild)

The current pipeline is genuinely good and most of this plan plugs into seams that are already there:

- **`fill.ts`** — fast greedy MRV constructor with an incremental occupancy index. Already pre-respects MUST caps via `buildCapGuard` and placement-local musts via `localMustForbids`. Already emits plain-language `blockers[]` explaining *why* a (class, subject) couldn't be filled.
- **`schedule.ts` → `solve()`** — greedy fill + bounded, validate-gated **repair** with single-eviction-relocation. Accepts a move only if `validate()` shows zero hard violations *and* shortfall strictly drops. This is the seam where deeper search slots in.
- **`generate.ts`** — best-of-N over seeds, plus `generateCandidates()` per emphasis preset with weighted soft scoring.
- **`feasibility.ts` → `analyzeFeasibility()`** — already detects six blocker classes (`subject_capacity`, `class_capacity`, `teacher_capacity`, `slot_contention`, `locked_conflict`, `cap_sum`) and already attaches **structured relaxations**, some with an `apply(project)` auto-fix function. **This is the backbone for "auto-suggest fixes" — it is half-built already.**
- **`deepSearch.ts` → `solveTimetable()`** — mode router (`fast` / `prove` / deep) with exact backtracking for small spaces and an `impossible` proof level.
- **`types.ts`** — constraints are a discriminated union with `severity: "must" | "prefer"` and a `weight`. Hard = must, soft = prefer. ~30 templates (R1–R24 + core).

What's missing is the *flexibility layer* on top: priority tiers, automatic soft-relaxation, flexible cross-class qualified swaps, and turning the existing relaxation suggestions into a one-click loop. That's what this plan adds.

---

## 3. Design principles (carry these into every milestone)

1. **Always return the best partial, never a bare failure.** A timetable with 3 empty cells + a reason for each beats "infeasible."
2. **One oracle.** `validate()` remains the single source of truth for hard violations. Every new move type must pass through it. No second constraint engine that can drift (AGENTS §3).
3. **Determinism preserved.** Everything stays seeded and pure. Relaxations are explicit data, applied as visible project edits, never hidden mutation.
4. **Soft bends silently, hard asks.** Per owner decision: the engine may auto-relax `prefer` rules to find a solution and *report* what it bent; bending a `must` rule always requires owner approval.
5. **Suggest the smallest change.** When stuck, prefer the minimal-cost fix (qualify one teacher, raise one cap by the exact deficit, drop one filler period) over broad changes.
6. **In-browser first.** The WASM/backend solver is an *optional accelerator* for the hardest instances, never a dependency. The app must stay fully usable offline with the current TS solver.

---

## 4. The flexibility layer — five features

### 4.1 Constraint priority tiers (new core concept)

Today a rule is binary: `must` (hard) or `prefer` (soft, weighted). That is too coarse to express "I'd rather lose the heavy-subjects-early preference than leave a class with a free period." Introduce an explicit **priority tier** on every constraint:

| Tier | Label (UI) | Meaning | Solver behaviour |
|------|-----------|---------|------------------|
| 0 | **Never bend** | True hard invariant | Enforced always (current HE1–HE8 + must caps). Never auto-relaxed; bending requires explicit owner override. |
| 1 | **Strong** | Important but sacrificeable to avoid a gap | Treated as hard during construction; auto-downgraded to a heavy soft penalty only when no zero-violation solution exists. Owner is told. |
| 2 | **Preferred** | Nice to have | Soft, weighted (current `prefer`). Auto-relaxed freely; reported in summary. |
| 3 | **Optional** | Tie-breaker | Lowest weight; bent first. |

Implementation:
- Add `tier: 0 | 1 | 2 | 3` to `ConstraintBase` in `types.ts`. Migrate existing data: `must` → tier 0, `prefer` → tier 2 (a pure-data migration in `restore.ts` / `buildProject.ts`; default any missing tier from `severity`).
- `validate()` keeps using `severity` for the hard/soft split, but the **solver** reads `tier` to decide what it may bend. Tier 1 ("Strong") is the new lever: the planner first attempts a tier-0-and-1-respecting solve; if that fails, it re-runs allowing tier-1 violations as weighted penalties, and surfaces exactly which strong rules it had to break.
- UI: a simple drag-to-rank list per rule, or a 4-way segmented control on each rule card. Ship a sensible default mapping (e.g. ELGA atomicity, qualification, teacher clash = tier 0; P1 class-teacher anchor, board-class core protection = tier 1; heavy-early, spread = tier 2).

This single concept is what lets the solver "neglect rules sometimes" *in a controlled, owner-defined order* instead of randomly.

### 4.2 Partial-fill + gap report (make "best partial" the default outcome)

The engine already computes `remainingShortfall` and per-(class,subject) `blockers`. Promote this from a side-channel to the **primary result object**.

- Define a `CoverageReport` (extend the existing `FillResult`): for every unfilled cell, attach `{ classId, subjectId, day?, slot?, reasons: BlockerReason[], suggestedFixes: Fix[] }`.
- `solve()` and `planTimetable()` always return the best partial they reached plus this report — they never throw "infeasible." `deepSearch`'s `proofLevel: "impossible"` becomes "we could not fill these N cells; here is why and here is the cheapest fix," not a dead end.
- New UI panel **"What's left & why"** (extends `src/ui/panels/Issues.tsx` / `FillReview.tsx`): a short list — "Class 7 needs 1 more Maths period. Reason: Anita (only qualified Maths teacher for Class 7) is full Mon–Sat. Fix: qualify one more teacher, or move one Class 9 Maths off Anita." Each fix is a button (see 4.4).
- Visually, unfilled cells render as amber "open" cells in the grid, not as errors — they're *work remaining*, distinct from red hard conflicts.

### 4.3 Flexible qualified swaps (your X/Y maths example)

Your example — *X and Y both teach Maths, X owns Class 1, so Y can take 1–2 of Class 1's Maths periods* — is exactly a **cross-class qualified relocation**. The repair in `schedule.ts` already does *single-eviction-relocation* but only ever re-places the *same* teacher. Generalise the move set so a different *qualified* teacher can absorb periods:

1. **Teacher substitution within a subject.** When a (class, subject) cell can't be filled because the "owner" teacher is busy, the repair tries any *other* teacher who holds the `(class, subject)` qualification and is free in that slot. This is already legal under HE3 (qualification) — it just isn't attempted. Gate it behind a per-class soft preference "keep the same teacher for this subject" (tier 2) so the planner prefers continuity but will break it to close a gap. Pradhyuman/Hemlata-style coupling is precisely where this unlocks solutions.
2. **Qualification inference (opt-in).** Many teachers are *de facto* qualified for a subject/grade band they aren't formally listed for. Add a one-click **"Also let {teacher} teach {subject} to {class band}"** suggestion (a qualification edit), surfaced when a subject is bottlenecked to a single teacher. The engine never invents this silently — it proposes it as a fix (4.4) and the owner confirms, which then permanently widens the qualification table.
3. **Load rebalancing across qualified teachers.** Extend `balance_teacher_loads` so that when teacher X is over `maxPerWeek` and Y (qualified, under cap) is free, the planner shifts marginal periods X→Y. This is the "share the load" generalisation of your example and directly attacks the teacher-coupling bottleneck.

All three are new candidate generators inside `gapCandidates()` in `schedule.ts`, each still passing the `validate()` acceptance gate — so they can never introduce a clash. They're tried in cost order (continuity-preserving first, qualification-widening last).

### 4.4 Auto-suggest fixes (one-click, minimal change)

`feasibility.ts` already produces `relaxation` suggestions, some with an executable `apply(project)`. Build the loop around it:

- **Standardise a `Fix` type**: `{ id, label, kind: "qualify" | "raise_cap" | "reduce_quota" | "add_teacher_slot" | "relax_rule" | "swap_teacher" | "drop_filler", costEstimate, apply(project): Project, undo? }`. Each `Fix` is reversible (it's just a project edit; the existing undo/redo + version store covers it).
- Every blocker and every unfilled cell carries 1–3 ranked `Fix` suggestions, cheapest first. Examples the engine can already compute the data for:
  - *Raise Harshita's weekly cap from 30 to 32* (exact deficit, from `teacher_capacity` / `cap_sum` checks — already has an `apply`).
  - *Qualify {teacher Y} for Maths/Class 1* (from the single-qualifier detection in `analyzeFeasibility`).
  - *Reduce Class 8 SST from 5 to 4 periods/week* (from `class_capacity` / shortfall).
  - *Drop one CCS/Revision filler period for {board class}* (CCS/Revision are first-class droppable subjects per the analysis doc).
  - *Expand the allowed periods for {subject}* (from `slot_contention`).
- **Preview before apply.** Clicking a fix shows the resulting diff (reuse `diffProjects`/`CellDiff` and the candidate-compare UI) and the new feasibility verdict, *then* applies on confirm. This is the import-and-tweak loop the owner actually wants.
- **"Auto-fix to feasible" button.** Greedily apply the cheapest fixes (soft/tier-2+3 only, never tier-0) until `analyzeFeasibility` returns `ready`, showing the full list of what it did. Hard-rule or qualification changes are queued for explicit approval, never auto-applied (owner decision).

### 4.5 Relaxation engine — auto-relax soft, ask on hard

Tie 4.1–4.4 together with an explicit relaxation search:

```
solveWithRelaxation(project, timetableId):
  1. solve respecting tier 0 + 1 as hard.            → if complete, done (no relaxation needed)
  2. else: relax tier 2 + 3 to weighted soft, re-solve.   (AUTOMATIC; report what was bent)
  3. still gaps? compute the minimal tier-1 ("Strong") relaxation set that would close them
     (greedy / hitting-set over the blocker→fix map), and PRESENT it for approval.   (ASK)
  4. still gaps after owner declines/accepts? return best partial + gap report + fixes.   (NEVER fail)
```

- Step 2 is silent-but-reported: a "Relaxed to fit" summary lists every preferred rule bent and where (e.g. "Maths in P4 twice instead of P1–P3 — needed to free Anita").
- Step 3 is the only place the engine touches a strong/hard rule, and it always asks. It frames it as your example would read: *"To finish Class 1's Maths I can let {Y} take 2 periods instead of {X} (breaks 'same teacher for Class 1 Maths'). Accept?"*
- This is a **MaxSAT-style minimal-relaxation** mindset: don't ask "is it satisfiable?", ask "what is the least I must give up?" That question always has an answer, which is why the loop can't get stuck.

---

## 5. Engine power — making "stuck" rare at the algorithm level

The flexibility layer reduces *false* impossibilities. These items reduce *real* search failures.

### 5.1 In-browser solver upgrades (default path, no backend)

- **Conflict-directed restarts + targeted re-fill.** When the bounded repair stalls, instead of giving up, identify the *most-contended* cells (the ones blocking the most coverage) and re-run construction with those holes ordered first under a fresh seed. Cheap, deterministic, and often escapes the single greedy basin. (Extends the `while (progressing)` loop in `solve()`.)
- **Min-conflicts local search as a second repair stage.** After eviction-relocation exhausts, run a bounded min-conflicts / simulated-annealing pass over the soft score: pick a random violated cell, move it to its least-conflicting legal slot, accept by the `validate()` gate. This is the standard technique that gets timetabling solvers "unstuck" and it composes with the existing oracle.
- **Smarter early-exit & budget use.** `generate()` already early-exits on a perfect solution. Add: stop a seed early once it provably can't beat the incumbent's shortfall (bound check), and reallocate that budget to more promising seeds.
- **Bigger exact window.** `PROVE_UNIT_LIMIT = 18` is conservative. With better pruning (forward-checking + most-constrained-variable, both already implied by the domain builder) this can rise, letting the exact solver *prove* small sub-instances complete or genuinely impossible rather than guessing.

### 5.2 Optional free, open-source backend solver (accelerator for the hardest cases)

Default stays in-browser. For the genuinely brutal instances, offer an **optional** solver that the owner can self-host for free. All options below are free and open-source; none require a paid API.

| Option | What it is | License / cost | How it plugs in | Recommendation |
|--------|-----------|----------------|-----------------|----------------|
| **Google OR-Tools CP-SAT (WASM)** | World-class constraint/SAT solver compiled to WebAssembly, runs *in the browser Web Worker* | Apache-2.0, free | Encode the timetable as CP-SAT (bool var per (event, day, slot, teacher)); run in the existing worker. **No server at all.** | **Primary recommendation** — keeps zero-backend, massively stronger search, supports true minimal-relaxation via soft constraints/objective. Heaviest build effort. |
| **MiniZinc (WASM build)** | High-level constraint modelling language; has experimental WASM/JS builds | MPL-2.0, free | Same in-worker pattern; model is easier to write/maintain than raw CP-SAT | Strong alternative if CP-SAT WASM proves too heavy; very readable models. |
| **FET (Free Evolutionary Timetabling)** | Mature, school-focused timetabling engine; battle-tested on exactly this kind of problem | AGPL-3.0, free | Self-hosted CLI/service: export project → FET XML → run → import result. Optional local companion, not required. | Best *ready-made* school solver; use as an optional "heavy generate" you shell out to locally. Data export/import only — no live coupling. |
| **Timefold Solver** (OptaPlanner's successor) | Java constraint-solver, strong on employee/school rostering, great soft-constraint/relaxation model | Apache-2.0, free (self-host) | Run as a small local Spring service; POST project JSON, receive solution | Good if you ever want a real backend; heavier ops (JVM). Document, don't build yet. |
| **OptaPlanner** | The well-known predecessor, still maintained forks | Apache-2.0, free | Same as Timefold | Listed for completeness; prefer Timefold. |

**Architecture for the backend path** (kept clean so the app never *depends* on it):
- A `SolverAdapter` interface: `solve(project, timetableId, options) → CandidateResult`. Current TS solver is the default adapter; CP-SAT-WASM / FET / Timefold are alternate adapters behind the same interface. The UI just sees candidates.
- **Recommended order:** (1) ship the TS-engine upgrades in 5.1, (2) add **OR-Tools CP-SAT compiled to WASM** as an in-worker adapter — this preserves the zero-backend promise while giving you a real solver, (3) only if you ever outgrow the browser, document the **FET** export/import companion as the optional local backend.
- Hosting stays free either way: static app on **GitHub Pages / Cloudflare Pages / Firebase Hosting free tier**; the WASM solver ships *with* the static bundle (no server). FET/Timefold, if ever used, run on the owner's own machine.

---

## 6. Milestones (work in order; each ships independently)

> Follows the repo convention: every milestone ends with `npm test` + `npm run build` green, a HANDOFF update, and a DECISIONS entry for non-obvious choices.

**M-A — Partial-fill is first-class.** Make `solve`/`plan`/`deepSearch` always return best-partial + `CoverageReport`; never surface a bare "impossible." New "What's left & why" panel. *Acceptance:* an over-constrained fixture returns a usable timetable with a non-empty, accurate gap report and at least one fix per gap. (Lowest risk, highest felt value.)

**M-B — `Fix` framework + one-click apply.** Standardise the `Fix` type; wire every existing `feasibility` relaxation and every gap reason to ranked fixes with preview-diff-then-apply. Add "Auto-fix to feasible" (soft/tier 2–3 only). *Acceptance:* clicking a suggested fix on the hard VPPS fixture moves feasibility from `blocked` to `ready`; diff preview matches the applied change.

**M-C — Constraint priority tiers.** Add `tier` to the model + migration + per-rule UI control; solver respects tier 0/1 as hard, auto-relaxes 2/3. *Acceptance:* re-running a previously-blocked instance auto-relaxes tier-2 rules and completes, with a "Relaxed to fit" summary listing exactly what bent.

**M-D — Flexible qualified swaps.** Add the three new candidate generators (same-subject teacher substitution, qualification-widening fix, load rebalancing) to `gapCandidates`, all behind the `validate()` gate and continuity preference. *Acceptance:* the X/Y Maths scenario auto-completes by letting Y cover Class 1 Maths periods, reported as a relaxation, with continuity preferred when a no-swap solution exists.

**M-E — Relaxation engine.** Implement `solveWithRelaxation` (auto soft, ask on tier-1/hard) as the new front-door generate action, returning the minimal relaxation set for approval. *Acceptance:* on an instance solvable only by bending one strong rule, the app asks once with a clear plain-language choice and completes on accept.

**M-F — In-browser search upgrades.** Conflict-directed restarts, min-conflicts second repair stage, tighter bounds, larger exact window. *Acceptance:* measurable drop in residual shortfall and soft score on the real fixture within the same time budget; still < 5s for auto-complete at VPPS scale.

**M-G (optional) — CP-SAT-WASM adapter.** Add OR-Tools CP-SAT compiled to WASM as an alternate in-worker `SolverAdapter` with native minimal-relaxation objective. *Acceptance:* on the hardest fixture it matches or beats the TS engine within budget; app still works with the adapter disabled (offline, zero backend).

**M-H (optional, document-only first) — FET/Timefold companion.** Export/import bridge for a self-hosted free solver, for instances beyond the browser. Spec it; build only if M-G proves insufficient.

---

## 7. Risks & guardrails

- **Silent over-relaxation.** Mitigation: tier 0 is *never* auto-bent; every automatic relaxation is reported; hard/strong bends always ask. The "Relaxed to fit" summary is mandatory output, not optional.
- **Determinism drift from new move types.** Mitigation: every new candidate passes the single `validate()` gate; all randomness stays seeded; add property tests that a relaxed solve with relaxations re-applied reproduces bit-for-bit.
- **Performance regression.** Mitigation: keep the budget split; new stages are bounded and only run when the cheap path leaves gaps; benchmark on `docs/sources/rawData.vpps.txt` each milestone.
- **CP-SAT-WASM bundle size / build complexity.** Mitigation: it's optional and lazy-loaded; the TS engine remains the default; ship M-A…M-F first and treat M-G as a power-up.
- **Qualification-widening changing reality.** Mitigation: never silent — it's always an owner-confirmed `Fix` that edits the qualification table explicitly.

---

## 8. Why this makes the generator "rarely get stuck"

1. It **stops failing**: best-partial + gap report means there's always a result.
2. It **bends in a controlled order you set**: priority tiers + auto-relax-soft mean the easy compromises happen automatically.
3. It **finds your X/Y-style escapes**: flexible qualified swaps + load rebalancing unlock solutions the same-teacher repair couldn't reach.
4. It **tells you the one cheap change** that turns "almost" into "done", one click away.
5. It **asks, not guesses**, on the rules you care about most.
6. And for the rare genuinely-hard instance, an **optional free CP-SAT engine** does the heavy lifting — without giving up offline, zero-cost, or determinism.

The throughline: reframe timetabling from *satisfy-or-fail* to *optimise-and-explain*. That question always has an answer.
