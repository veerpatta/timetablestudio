# Revamp Plan — v7: Rules vs Preferences, Honest Feasibility & Pros/Cons

> Master implementation plan for the next phase of Time Table Studio.
> Audience: Claude Code (and the owner). Style follows `docs/ROADMAP.md` — **strict
> order, acceptance‑criteria (AC) gated, doc‑first, `npm test` + `npm run build` +
> `npm run lint` green at every milestone.** Reuse the existing engine; do **not**
> rebuild what is already here.
>
> Owner decisions baked in (2026‑06‑20): (1) two clearly‑named tiers — **Rules**
> (strict) and **Preferences** (soft); (2) **honest‑hybrid** impossibility verdict;
> (3) generate **several candidates**, each annotated, with side‑by‑side compare;
> (4) judge timetables on **teacher fairness, student/pedagogy, board‑class
> protection, and stability vs the current timetable** — all four matter.

---

## 1. Why this revamp

The true use case (owner, confirmed): **iterate on the real working timetable across
a session** — absorb staff requests, react when a teacher leaves, and experiment to
find the *best* timetable for the school. The product already generates and edits;
this phase makes it **decision‑grade**:

1. **A crisp mental model.** A non‑technical owner must instantly understand the
   difference between "this can never be broken" (Rules) and "do this if you can"
   (Preferences). Today both live in one `constraints` list with a `must`/`prefer`
   chip — correct underneath, muddy on the surface (the Dashboard even calls them
   "Rules", the code calls them "constraints", the severity is "must/prefer").

2. **An honest verdict.** When no timetable can satisfy the Rules, the app must say
   so plainly **and name the exact tweak** that would unblock it — not silently leave
   gaps. The scaffolding exists (`proofLevel: "impossible"`, `relaxationSuggestions`)
   but the diagnosis is generic and the proof only runs for tiny scopes.

3. **Trade‑off transparency.** Every generated timetable must show **Advantages** and
   **Disadvantages** in plain language ("Bindu gets 6 periods more than average";
   "Maths is in P1–P3 for all classes") so the owner *chooses* rather than *accepts*.
   This does not exist yet.

This mirrors how mature timetablers work: hard constraints guarantee feasibility while
soft constraints are optimisation objectives that may be relaxed (FET); aSc's
*constraint relaxation* reports "how many times constraints were relaxed and how
important they are" and helps "identify which constraints are probably too hard"; Untis
"generates different timetables… and selects the best from several possibilities" and
ships an integrated diagnosis tool. We adopt these ideas with a sentence‑first,
zero‑jargon UI. (Sources in §9.)

---

## 2. What ALREADY exists (reuse — do not rebuild)

A precise audit so milestones extend rather than duplicate:

| Capability | Where it lives | Status |
|---|---|---|
| Strict vs soft severity | `domain/types.ts` → `ConstraintSeverity = "must" \| "prefer"`, `Constraint` union (24 templates), `Project.constraints` | ✅ solid |
| One‑oracle validation | `domain/validate.ts` (must→hard, prefer→soft); `domain/constraintAggregates.ts`, `domain/constraints.ts` | ✅ solid |
| Coverage / shortfall | `domain/coverage.ts` (`requirementCoverage`, `coverageGaps`, `totalShortfall`) | ✅ |
| Greedy + repair solver | `solver/fill.ts`, `solver/schedule.ts` (`solve`), `solver/plan.ts` (`planTimetable`) | ✅ |
| Best‑of‑N generator | `solver/generate.ts` (`generate`) — fixed seed list, deterministic | ✅ single best |
| Cap pre‑respect + blockers | `solver/caps.ts` (`buildCapGuard`) | ✅ |
| Feasibility analyzer | `solver/feasibility.ts` (`analyzeFeasibility` → `blockers`, `relaxationSuggestions`, `status`) | ⚠️ shallow (only teacher week‑cap math) |
| Deep/exact search + proof | `solver/deepSearch.ts` (`solveTimetable`, modes `fast`/`deep`/`prove`, `exactSearch`, `PROVE_UNIT_LIMIT=18`) | ⚠️ exact only for ≤18 units |
| Candidate result shape | `solver/candidateScoring.ts` (`candidateResult` → `CandidateResult`); `solver/types.ts` (`ProofLevel`, `FeasibilityReport`, `SolverRequest`, `CandidateResult`) | ✅ good base |
| Worker + client | `solver/fillWorker.ts`, `solver/fillClient.ts` (`runPlanTimetable`, `runSolveTimetable`, `startSolveTimetable` with progress) | ✅ |
| Diff / change ledger | `domain/diffTimetables.ts` (`diffProjects` → `CellDiff[]`) | ✅ |
| Teacher load insights | `domain/insights.ts` (`teacherLoad`, `allTeacherLoads`, `loadBalance`, `freeTeachers`) | ✅ feeds pros/cons |
| Generate/Review UI | `ui/app/GenerateView.tsx` (proof copy, blockers, relaxation, metrics), `ui/app/App.tsx` (`makeBestTimetable` → `runPlanTimetable`) | ⚠️ single result, no pros/cons, no compare |
| Constraints UI | `ui/panels/ConstraintsPanel.tsx`, `domain/constraintCatalog.ts`, `domain/constraintText.ts`, `domain/suggestConstraints.ts` | ⚠️ one list, no tier split |

**Implication:** the data model and engine are ~70% of the way to the owner's vision.
This plan is mostly **surfacing, sharpening, and adding the pros/cons layer** — not a
rewrite. Key new pure modules: `domain/assessment.ts` (pros/cons), a richer
`solver/feasibility.ts`, and a multi‑candidate `solver/generate.ts`.

---

## 3. Target concepts & vocabulary (do this consistently everywhere)

- **Rule** = a `Constraint` with `severity: "must"`. Strict. Generation **must**
  satisfy every enabled Rule or declare the result impossible. Shown red.
- **Preference** = a `Constraint` with `severity: "prefer"`. Soft. Applied when
  possible; relaxable; contributes to the quality score. Shown amber.
- **Hard clash** = a structural double‑booking (HE1/HE2 etc.) — always a Rule
  violation, never optional.
- **Coverage gap** = a required weekly period that couldn't be placed.
- **Verdict** (per generation): `Complete` · `Best found` · `Likely impossible` ·
  `Proven impossible` · `Timed out` (maps to `ProofLevel` + feasibility, see §5).
- **Candidate** = one generated timetable + its assessment + its verdict.
- **Assessment** = the **Advantages / Disadvantages** report + a 0–100 health score.

Keep `severity: "must" | "prefer"` as the stored value (no schema churn); "Rule" and
"Preference" are the **presentation** of `must`/`prefer`. Add one tiny pure helper
`tierLabel(severity)` so the words live in exactly one place.

---

## 4. The four workstreams

### W1 — Rules vs Preferences split (UI + small domain helpers)
Make the two tiers unmistakable without touching the schema.

- `domain/constraintText.ts`: add `tierLabel(severity): "Rule" | "Preference"` and a
  one‑line tier description. Single source of truth for the words.
- `ui/panels/ConstraintsPanel.tsx` (or a new `RulesView`): render **two sections** —
  **Rules (strict)** and **Preferences (try if possible)** — each with its own
  "Add" button that pre‑sets severity. Moving an item between sections flips
  `severity`. Each item is the existing fill‑in‑the‑blank sentence + on/off toggle.
- Add‑constraint flow asks **"Must this always hold, or is it a preference?"** as the
  first step (two big choices), then the template picker.
- Dashboard + nav: rename the counter to show **"Rules: N · Preferences: M"** and
  fix the mislabelled "Rules" stat in `ui/app/Dashboard.tsx`.
- Validation/issues panels group by tier: "Rule broken" (red, must fix) vs "Could be
  better" (amber, optional) — extend the existing soft section in `ui/panels/Issues.tsx`.

**AC W1:** every constraint appears under exactly one of two clearly‑titled sections;
adding one forces an explicit Rule/Preference choice; flipping the choice moves it and
re‑scores; no raw `must`/`prefer`/`Sx`/`Rx` codes appear outside Advanced (regression
test on rendered strings); existing constraint tests stay green.

### W2 — Honest‑hybrid feasibility & relaxation engine (`solver/feasibility.ts`)
Turn the shallow analyzer into a real **bottleneck finder** that names the exact Rule
or quota to relax, with numbers. This is the heart of "clearly state not possible +
suggest little tweaks."

Add deterministic, pure **capacity‑vs‑demand checks** (each returns a structured
`Blocker` with a concrete, one‑click‑ready relaxation):

1. **Teacher demand vs capacity.** For each teacher, Σ required periods they're the
   only qualified teacher for vs their week cap and available slots →
   *"Bindu must teach 33 periods but her weekly limit is 30. Raise the limit to 33, or
   move 3 periods to another qualified teacher."*
2. **Class slot capacity.** Σ required periods for a class vs teaching slots in the
   week → *"Class 7 needs 41 periods but the week has 40 teaching slots. Drop 1
   period or add a period to the day."*
3. **Subject qualified‑teacher capacity.** Σ required periods for a subject across
   classes vs total capacity of its qualified teachers in available slots.
4. **Single‑slot contention.** A required event (block/joint) whose members are
   over‑subscribed on its only allowed day/slot (e.g. ELGA Mon–Thu).
5. **Pinned/locked over‑constraint.** Locked cells that themselves force a Rule
   violation → *"Unlock Tue P4 for Class 9, or change the locked lesson."*
6. **Cap‑sum musts.** Existing teacher‑cap math, generalised to day/consecutive/
   days‑per‑week caps.

Return type upgrade (keep `FeasibilityReport` back‑compat; add structure alongside):

```ts
interface Blocker {
  kind: "teacher_capacity" | "class_capacity" | "subject_capacity"
      | "slot_contention" | "locked_conflict" | "cap_sum";
  message: string;              // plain language, names entities + numbers
  entityRefs: { type: "teacher"|"class"|"subject"|"slot"; id: string }[];
  relaxation: RelaxationSuggestion;
}
interface RelaxationSuggestion {
  message: string;              // "Raise Bindu's weekly limit from 30 to 33"
  apply?: (p: Project) => Project; // optional one-click fix (pure)
  severity: "small" | "moderate" | "large"; // how disruptive
}
```

`analyzeFeasibility` returns `status: "ready" | "blocked"` plus `Blocker[]`. A `blocked`
status with ≥1 capacity blocker ⇒ **`Proven impossible`** (it is a counting argument,
not a search). No capacity blocker but search exhausts/struggles ⇒ **`Likely
impossible`** with the tightest bottleneck surfaced.

**AC W2:** unit tests for each of the 6 checks (a satisfied case + a blocked case that
names the entity and the exact number, e.g. `/Bindu/` and `/33/`); on a deliberately
over‑quota'd VPPS fixture the report names the bottleneck class/teacher and a numeric
relaxation; `apply` (where present) produces a project that then passes the same check.

### W3 — Multi‑candidate generation (`solver/generate.ts`, worker, client)
Produce **2–3 meaningfully different** feasible candidates instead of one, so pros/cons
are a real choice. Diversity comes from **emphasis presets**, which also explains *why*
candidates differ (each preset naturally yields different advantages):

- **Balanced** — current default weighting.
- **Teacher‑friendly** — up‑weight compact days, fair loads, fair first/last duties.
- **Student‑focused** — up‑weight heavy‑subject‑early, subject spread, daily variety.
- **(Iteration mode) Minimal‑change** — up‑weight stability vs the current timetable
  (fewest moved cells); used when the owner is absorbing a single staff request.

Implementation: a preset is **data** — a weight multiplier map over Preference
templates (reuse the "weight presets" idea already noted for R16–R24 in CONSTRAINTS.md).
`generate()` runs the existing best‑of‑N **once per active preset**, scoring with the
preset's weights, and returns `Candidate[]` (each: project, seed, scores, assessment,
verdict, feasibility). Dedupe identical results (same `diffProjects` hash). Keep it
deterministic (fixed seed lists; no `Math.random`) and inside the wall‑clock budget
(split across presets; early‑exit on a complete+zero‑soft candidate).

**AC W3:** `generate` returns ≥2 candidates on the bundled project; candidates are
distinct (different `changes`/scores) and each is feasible (0 hard); a preset that
favours teacher comfort yields lower teacher‑gap totals than the student‑focused one
(asserted); deterministic across runs; total time within budget (test with a small
budget).

### W4 — Advantages / Disadvantages assessment (`domain/assessment.ts` — new, pure)
The headline feature. One pure function turns a timetable into plain‑language pros/cons
across the four owner‑chosen dimensions, plus a 0–100 health score.

```ts
type Dimension = "teacherFairness" | "pedagogy" | "boardProtection" | "stability" | "coverage";
interface Highlight {
  dimension: Dimension;
  polarity: "advantage" | "disadvantage";
  weight: number;               // contribution to score / sort order
  message: string;              // "Bindu teaches 6 periods more than average"
  entityRefs: { type: string; id: string }[]; // for click-to-jump
}
interface Assessment {
  score: number;                // 0–100, plain band: Great / Good / Fair / Poor
  advantages: Highlight[];      // sorted by weight desc
  disadvantages: Highlight[];
}
function assessTimetable(project, timetableId, opts?: { baseline?: Timetable }): Assessment;
```

Signal sources (all already computable — reuse, don't recompute conflictingly):

- **Teacher fairness** ← `domain/insights.ts` (`allTeacherLoads`, `loadBalance`):
  spread of weekly loads, max‑vs‑mean outliers, idle‑gap totals, first/last‑period
  duty distribution. Pros: "Loads are even (range 24–27)." Cons: "Bindu has 4 idle
  gaps this week"; "Ravi teaches 6 more periods than average."
- **Pedagogy** ← soft‑constraint evaluators in `constraintAggregates.ts` + profile:
  heavy‑subjects‑early hit rate, subject spread across days, longest same‑subject run,
  per‑day variety. Pros/cons stated per pattern, naming classes.
- **Board protection** ← `SchoolClass` board flag + core‑subject placement: "All
  Class 12 Science core subjects are in the morning" (pro) / "Class 10 Maths lands in
  P8 twice" (con).
- **Stability** ← `diffProjects(baseline, project)` when a baseline is given: "Only 7
  cells differ from your current timetable" (pro) / "This moves 41 cells — large
  disruption" (con). Omitted when generating from scratch.
- **Coverage** ← `coverage.ts`: any shortfall is a prominent disadvantage.

Score = 100 − weighted penalties (coverage gaps and Rule breaks dominate; Preference
misses are lighter). Use the **same weights** the candidate was generated under so the
score is consistent with the preset. Provide a plain band + one‑sentence summary
("Good — teachers are balanced, but two classes get Maths late").

**AC W4:** `assessment.test.ts` — every number in a Highlight equals an independent
recompute from `derive()`/`insights()` (property test); a timetable with a known
overloaded teacher surfaces that exact disadvantage with the right entity ref; adding a
baseline produces stability highlights, omitting it omits them; messages contain no
constraint codes.

### W5 — Generate & Compare UI (`ui/app/GenerateView.tsx` + new compare component)
Surface W2–W4 in the existing review screen.

- **Verdict banner** (reuse `proofCopy`, extend for `Likely impossible` vs `Proven
  impossible`): green Complete, amber Best found/Timed out, red Impossible.
- **Impossible path**: show the bottleneck blockers and, under "What to change", the
  relaxation suggestions — each with an **"Apply this tweak"** button (calls
  `relaxation.apply`, undoable via the existing backup flow) then auto‑re‑runs.
- **Candidate cards** (W3): 2–3 cards, each titled by its preset ("Teacher‑friendly
  option"), showing the health band, top 2 advantages, top 1 disadvantage, and a
  "Use this one" button. A **Compare** toggle opens a side‑by‑side table: score,
  clashes, gaps, key fairness/pedagogy/stability metrics per candidate, with the diff
  grid for the highlighted one (reuse the change‑ledger from `diffProjects`).
- **Click‑to‑jump** on every Highlight/blocker entity ref → grid cell highlight (reuse
  the existing "Show me" plumbing from `ui/panels/Issues.tsx`).
- Keep advanced numbers (seed, soft score, candidates checked) behind an "Advanced"
  disclosure.
- Wire `App.makeBestTimetable` to `runSolveTimetable`/`startSolveTimetable` (modes +
  progress) instead of the single `runPlanTimetable`, so the worker streams candidates
  and the verdict.

**AC W5:** generating on the bundled project shows ≥2 candidate cards each with pros/cons
and a working "Use this one" (applies as a reviewed draft, undoable, with an auto
restore point); an over‑constrained project shows the red verdict + a named relaxation
whose "Apply this tweak" unblocks a re‑run; every pros/cons line and blocker jumps to
the right cell; nothing changes until the owner applies.

---

## 5. Verdict taxonomy (single source of truth)

Compute in the worker, render in `GenerateView`:

| Verdict | When | Tone |
|---|---|---|
| **Complete** | 0 hard, 0 coverage gaps | green |
| **Proven impossible** | feasibility has a capacity/locked blocker (counting proof) **or** targeted `exactSearch` exhausted the space | red |
| **Likely impossible** | no capacity proof, but search couldn't reach 0 gaps and the tightest bottleneck is identified | red‑amber |
| **Best found** | feasible but gaps/soft remain; search not exhaustive | amber |
| **Timed out** | budget hit before any of the above settled | amber |

For **targeted scopes** (one class, one day, one teacher — units ≤ `PROVE_UNIT_LIMIT`)
the exact search gives a genuine **Proven impossible**. For the **whole school** we lean
on the capacity proof (W2) for hard "impossible" claims and otherwise say **Best found /
Likely impossible** with the bottleneck — never a false mathematical certainty. This is
the "honest hybrid" the owner chose.

---

## 6. Milestones (strict order, AC‑gated)

Follow `docs/ROADMAP.md` conventions; doc‑first for any `types.ts`/`DATA_MODEL.md`
change in the **same commit**; update `docs/HANDOFF.md` after each.

- **M23 — Tiering & vocabulary (W1).** Two‑section Rules/Preferences UI, `tierLabel`,
  Dashboard fix, tier‑grouped issues. *No engine change.* AC = W1.
- **M24 — Feasibility & relaxation engine (W2).** Capacity checks + structured
  `Blocker`/`RelaxationSuggestion` with optional pure `apply`. AC = W2.
- **M25 — Assessment engine (W4).** `domain/assessment.ts` pros/cons + score, fully
  tested against independent recompute. *Pure, no UI yet.* AC = W4.
- **M26 — Multi‑candidate generation (W3).** Emphasis presets (data), `generate`
  returns `Candidate[]` with assessment + verdict; worker/client stream them. AC = W3.
- **M27 — Generate & Compare UI (W5).** Verdict banner, candidate cards, compare table,
  "Apply this tweak", click‑to‑jump, wired to the mode‑based solver. AC = W5.
- **M28 — Targeted regenerate + verdict polish.** "Re‑plan just this class/day/teacher"
  (freeze the rest) using the exact‑search path for a genuine Proven‑impossible on the
  small scope; relaxation one‑click apply hardened; full keyboard/mobile pass.
  AC: a deliberately impossible single‑class scope returns Proven impossible naming the
  bottleneck; targeted regenerate changes only the unfrozen scope (property test).

Each milestone leaves `npm test` + `npm run build` + `npm run lint` green and is
live‑verified in the browser (the project's standing rule).

---

## 7. Brainstormed ideas (owner to pick — not all in scope of v7)

High‑value, low‑risk, ordered by bang‑for‑buck:

1. **"Apply this tweak" one‑click relaxations** (in v7 via W2/W5) — the single most
   useful idea: every impossibility names a fix the owner can take with one click.
2. **Staff‑change wizard.** "A teacher is leaving / on leave" → pick the teacher → app
   lists their periods, finds qualified+free replacements per period (reuse
   `freeTeachers` + `substitute.ts`), shows the pros/cons delta, applies as a reviewed
   draft. This is the owner's literal "if a teacher leaves, easily apply the new
   timetable" use case — strong candidate for a v7.1 fast‑follow.
3. **Request inbox.** A lightweight list where the owner types a staff request ("Kusum
   wants Friday off") → app proposes the matching Rule/Preference + a regenerate. Turns
   ad‑hoc asks into tracked, reversible changes.
4. **Scenario A/B keep.** Save 2–3 generated candidates as named scenarios and switch
   between them (the `versions` store already supports save/restore) — "experiment on
   the best possible timetable" made literal.
5. **What‑if hover preview.** Before a drag/drop, show the pros/cons delta it would
   cause (speculative `validate` + mini `assessTimetable`). The editor already has the
   speculative‑copy plumbing.
6. **Explain‑this‑cell.** Click any cell → "why is this here / what would break if I
   moved it" using `legalMoves` + the assessment dimensions.
7. **Fairness leaderboard.** A teacher‑load heatmap with a fairness meter (insights
   already computes the numbers) shown next to each candidate.
8. **Preference presets as one‑click bundles** ("Indian K‑12 defaults", "Board‑exam
   mode") — already sketched in CONSTRAINTS.md §v5; the W3 emphasis presets are the
   engine half of this.
9. **Printable "decision sheet."** Export the chosen candidate's pros/cons + compare
   table to PDF so the owner can circulate *why* this timetable was chosen.
10. **Constraint conflict detector.** Before generating, warn when two enabled Rules
    are mutually exclusive (e.g. "Maths only P1–P3" + "Bindu unavailable P1–P3 but is
    the only Maths teacher for Class 4") — a static pre‑flight that prevents wasted
    runs. Overlaps with W2; surface it in the pre‑flight.

Recommended v7 scope: **W1–W5 (M23–M28) + idea #1**, with #2 and #4 as the immediate
fast‑follows.

---

## 8. Risks, boundaries, non‑goals

- **No true global exhaustive proof at school scale.** Stated honestly (§5). Don't
  promise mathematical certainty the browser can't deliver in seconds; the capacity
  proof gives certainty where it legitimately applies.
- **Keep it pure & deterministic.** `assessment.ts`, `feasibility.ts`, `generate.ts`
  stay framework‑free and seed‑deterministic (no `Math.random`, no Date‑based scoring).
  Layering rule holds: `domain` ← `solver` ← (`worker`, `store`) ← `ui`.
- **No schema churn for tiers.** Rules/Preferences are presentation of `must`/`prefer`.
  Any new persisted field (e.g. an emphasis preset choice) is doc‑first in
  `DATA_MODEL.md` + migrated in `normalizeProject`.
- **Performance budgets** (ARCHITECTURE.md): validation < 16 ms/edit; a full multi‑
  candidate generate within the worker budget (default ~4 s, split across presets);
  bundle stays lean (no solver libraries).
- **Out of scope for v7:** rooms/labs, accounts/multi‑school, server sync, a CP/SAT
  solver rewrite. Revisit only if the honest‑hybrid verdict proves insufficient in use.

---

## 9. External references (design inputs)

- aSc Timetables — *Constraint relaxation*: partially violates soft constraints to
  complete the timetable, reports how often/important the relaxations were, and helps
  "identify which constraints are probably too hard."
  https://help.asctimetables.com/text.php?id=113&lang=en
- Untis — *Timetable optimisation*: weights criteria, generates several timetables and
  selects the best; integrated diagnosis tool; gap‑weighting redistributes teacher gaps.
  https://platform.untis.at/HTML/WebHelp/uk/untis/kp_stundenplan-optimierung.htm
- FET / general — hard constraints guarantee feasibility; soft constraints are
  optimisation objectives that may be relaxed when no better option exists.
  https://educationspaceconsultancy.com/hard-and-soft-timetabling-constraints-not-only-a-working-timetable-but-a-great-timetable/

---

## 10. First steps for the implementing agent

1. Read `docs/HANDOFF.md`, `docs/CONSTRAINTS.md` (§v6.1), `docs/DATA_MODEL.md`, and the
   files in the §2 table. Confirm current wiring of `App.makeBestTimetable` (today it
   calls `runPlanTimetable`; M27 moves it to `runSolveTimetable`).
2. Start **M23**. Doc‑first: note the Rule/Preference vocabulary in `CONSTRAINTS.md`,
   then implement `tierLabel` + the two‑section UI, then tests, then live‑verify.
3. Do not advance a milestone until its AC pass and `test`/`build`/`lint` are green.
4. Update `docs/HANDOFF.md` "Current state" + `docs/DECISIONS.md` after each milestone.
