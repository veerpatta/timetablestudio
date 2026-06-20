// Best-of-N generator (PURE, deterministic) — C6 + OVERHAUL A3 + M26.
//
// generate()           — original single-best-result API; callers (deepSearch, plan, worker) keep it.
// generateCandidates() — M26: runs one best-of-N per emphasis preset, returns Candidate[].
//   Each preset re-scores soft violations with its own multiplier map so different presets
//   genuinely optimise different objectives. Candidates are deduped by placement hash; any
//   two presets that converge to the same timetable produce only one candidate.

import { assessTimetable } from "../domain/assessment";
import { diffProjects } from "../domain/diffTimetables";
import { validate } from "../domain/validate";
import type { ConstraintTemplate, Id, Placement, Project, Violation } from "../domain/types";
import type { FillResult } from "./fill";
import { DEFAULT_PRESETS, type Preset } from "./presets";
import { solve } from "./schedule";
import type { Candidate, Verdict } from "./types";

const DEFAULT_SEEDS = 8;
const DEFAULT_BUDGET_MS = 4000;

export interface GenerateResult extends FillResult {
  seed: number; // the winning seed (reproduces this exact fill)
  softScore: number; // soft (prefer) violations of the chosen fill — lower is better
  triedSeeds: number; // how many seeds were actually compared (honest "best of N")
}

function better(a: GenerateResult, b: GenerateResult): boolean {
  if (a.remainingShortfall !== b.remainingShortfall) return a.remainingShortfall < b.remainingShortfall;
  if (a.softScore !== b.softScore) return a.softScore < b.softScore;
  return a.seed < b.seed;
}

/** Run up to `seeds` solves (seed 1..N) within `budgetMs` and return the best. */
export function generate(project: Project, timetableId: Id, opts?: { seeds?: number; budgetMs?: number }): GenerateResult {
  const n = Math.max(1, opts?.seeds ?? DEFAULT_SEEDS);
  const budgetMs = Math.max(500, opts?.budgetMs ?? DEFAULT_BUDGET_MS);
  const startedAt = Date.now();
  let best: GenerateResult | null = null;
  let tried = 0;
  for (let seed = 1; seed <= n; seed++) {
    const elapsed = Date.now() - startedAt;
    if (best && elapsed >= budgetMs) break;
    const perSeed = Math.max(400, Math.floor((budgetMs - elapsed) / (n - seed + 1)));
    const res = solve(project, timetableId, { seed, budgetMs: perSeed });
    tried++;
    const table = res.project.timetables.find((t) => t.id === timetableId);
    const softScore = table ? validate(res.project, table).filter((v) => v.severity === "soft").length : 0;
    const cand: GenerateResult = { ...res, seed, softScore, triedSeeds: tried };
    if (!best || better(cand, best)) best = cand;
    if (best.remainingShortfall === 0 && best.softScore === 0) break; // can't do better
  }
  // n ≥ 1 guarantees the loop ran at least once, so best is set; stamp the true tried count.
  return { ...best!, triedSeeds: tried };
}

// ── Multi-candidate generation (M26) ─────────────────────────────────────────

/** Weighted soft score: Σ(constraint.weight × preset.multiplier[template]) per soft violation. */
function weightedSoft(
  violations: Violation[],
  project: Project,
  multipliers: Partial<Record<ConstraintTemplate, number>>,
): number {
  const cmap = new Map(project.constraints.map((c) => [c.id, c]));
  return violations
    .filter((v) => v.severity === "soft")
    .reduce((sum, v) => {
      const c = cmap.get(v.constraintId);
      if (!c) return sum + 1;
      return sum + c.weight * (multipliers[c.template] ?? 1);
    }, 0);
}

function placementHash(placements: Placement[]): string {
  return [...placements]
    .sort((a, b) => {
      const ka = `${a.eventId}|${a.day}|${a.slot}`;
      const kb = `${b.eventId}|${b.day}|${b.slot}`;
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    })
    .map((p) => `${p.eventId}|${p.day}|${p.slot}`)
    .join(",");
}

function verdictOf(remainingShortfall: number, hardCount: number): Verdict {
  if (remainingShortfall === 0 && hardCount === 0) return "Complete";
  return "Best found";
}

interface SeedEval {
  res: FillResult;
  seed: number;
  violations: Violation[];
  hardCount: number;
  softScore: number;
  wSoft: number;
}

function betterByPreset(a: SeedEval, b: SeedEval): boolean {
  if (a.res.remainingShortfall !== b.res.remainingShortfall) return a.res.remainingShortfall < b.res.remainingShortfall;
  if (a.hardCount !== b.hardCount) return a.hardCount < b.hardCount;
  if (a.wSoft !== b.wSoft) return a.wSoft < b.wSoft;
  return a.seed < b.seed;
}

/**
 * Run one best-of-N per emphasis preset and return up to one Candidate per preset.
 * Candidates with identical placement hashes are deduped (only the first is kept).
 * Total wall-clock time is split evenly across presets; early-exit if a seed is
 * complete and zero-weighted-soft.
 */
export function generateCandidates(
  project: Project,
  timetableId: Id,
  opts?: { presets?: Preset[]; seeds?: number; budgetMs?: number },
): Candidate[] {
  const presets = opts?.presets ?? DEFAULT_PRESETS;
  const n = Math.max(1, opts?.seeds ?? DEFAULT_SEEDS);
  const totalBudget = Math.max(500, opts?.budgetMs ?? DEFAULT_BUDGET_MS);
  const budgetPerPreset = Math.max(400, Math.floor(totalBudget / presets.length));

  const seen = new Set<string>();
  const candidates: Candidate[] = [];

  for (const [pi, preset] of presets.entries()) {
    // Each preset gets its own non-overlapping seed range so different presets genuinely
    // explore different parts of the search space and produce distinct timetables.
    const seedStart = pi * n + 1;
    const seedEnd = pi * n + n;
    const startedAt = Date.now();
    let best: SeedEval | null = null;

    for (let seed = seedStart; seed <= seedEnd; seed++) {
      const elapsed = Date.now() - startedAt;
      if (best && elapsed >= budgetPerPreset) break;
      const remaining = seedEnd - seed + 1;
      const perSeed = Math.max(400, Math.floor((budgetPerPreset - elapsed) / remaining));
      const res = solve(project, timetableId, { seed, budgetMs: perSeed });

      const table = res.project.timetables.find((t) => t.id === timetableId);
      const violations: Violation[] = table ? validate(res.project, table) : [];
      const ev: SeedEval = {
        res,
        seed,
        violations,
        hardCount: violations.filter((v) => v.severity === "hard").length,
        softScore: violations.filter((v) => v.severity === "soft").length,
        wSoft: weightedSoft(violations, res.project, preset.multipliers),
      };

      if (!best || betterByPreset(ev, best)) best = ev;
      if (best.res.remainingShortfall === 0 && best.hardCount === 0 && best.wSoft === 0) break;
    }

    if (!best) continue;

    const table = best.res.project.timetables.find((t) => t.id === timetableId);
    if (!table) continue;

    const hash = placementHash(table.placements);
    if (seen.has(hash)) continue;
    seen.add(hash);

    // Ensure activeTimetableId is set so diffProjects can compare correctly.
    const before = { ...project, activeTimetableId: timetableId };
    const after = { ...best.res.project, activeTimetableId: timetableId };

    candidates.push({
      presetLabel: preset.label,
      project: best.res.project,
      changes: diffProjects(before, after),
      seed: best.seed,
      hardCount: best.hardCount,
      remainingShortfall: best.res.remainingShortfall,
      softScore: best.softScore,
      weightedSoftScore: best.wSoft,
      assessment: assessTimetable(best.res.project, timetableId),
      verdict: verdictOf(best.res.remainingShortfall, best.hardCount),
    });
  }

  return candidates;
}
