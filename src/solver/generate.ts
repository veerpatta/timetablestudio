// Best-of-N generator (PURE, deterministic) — C6 part 2/2. fill() pre-respects every hard
// must it can (qualifications, availability, local musts, monotone caps — caps.ts), so EVERY
// seed it produces is legal. What a single greedy seed can't do is OPTIMISE the prefer
// constraints it can't pre-respect (spread/order/compact/balance/variety). generate() runs a
// fixed list of seeds and keeps the fill with the fewest SOFT (prefer) violations — the
// generator honouring the prefers as far as a fast greedy allows, with no Math.random (the
// seed list is fixed, so the result is reproducible).

import { validate } from "../domain/validate";
import type { Id, Project } from "../domain/types";
import { fill, type FillResult } from "./fill";

const DEFAULT_SEEDS = 8;

export interface GenerateResult extends FillResult {
  seed: number; // the winning seed (reproduces this exact fill)
  softScore: number; // soft (prefer) violations of the chosen fill — lower is better
  triedSeeds: number; // how many seeds were compared (for an honest "best of N" note)
}

/** Run `seeds` greedy fills (seed 1..N) and return the one with the fewest soft violations.
 *  Ties break on fewer remaining gaps, then lowest seed — fully deterministic. */
export function generate(project: Project, timetableId: Id, opts?: { seeds?: number }): GenerateResult {
  const n = Math.max(1, opts?.seeds ?? DEFAULT_SEEDS);
  let best: GenerateResult | null = null;
  for (let seed = 1; seed <= n; seed++) {
    const res = fill(project, timetableId, { seed });
    const table = res.project.timetables.find((t) => t.id === timetableId);
    const softScore = table ? validate(res.project, table).filter((v) => v.severity === "soft").length : 0;
    const cand: GenerateResult = { ...res, seed, softScore, triedSeeds: n };
    if (
      !best ||
      softScore < best.softScore ||
      (softScore === best.softScore && res.remainingShortfall < best.remainingShortfall)
    ) {
      best = cand;
    }
  }
  // n ≥ 1 guarantees the loop ran at least once, so best is set.
  return best!;
}
