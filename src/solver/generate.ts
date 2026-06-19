// Best-of-N generator (PURE, deterministic) — C6 + OVERHAUL A3. Each seed now runs the full
// `solve` (greedy construct + validate-gated repair), so every seed is legal AND as complete
// as the budget allows. generate() runs a fixed seed list and keeps the BEST by completeness
// first (fewest unmet required periods), then fewest SOFT (prefer) violations — completeness
// is the owner's stated priority ("subjects compulsory per week"). No Math.random: the seed
// list is fixed, so the result reproduces. A shared wall-clock budget is split across the
// remaining seeds, and the loop stops early once a seed is fully complete with zero soft.

import { validate } from "../domain/validate";
import type { Id, Project } from "../domain/types";
import type { FillResult } from "./fill";
import { solve } from "./schedule";

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
