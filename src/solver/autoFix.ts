// Auto-fix to feasible (M-B) — greedily applies SAFE project tweaks until
// analyzeFeasibility returns "ready" or no more tweaks can be applied.
//
// "Safe" means: only structural cap raises (teacher_capacity and cap_sum blockers
// whose relaxation.apply is present). Coverage-gap fixes (reduce_requirement,
// qualify_teacher) require explicit owner approval and are NOT applied here.

import type { Id, Project } from "../domain/types";
import { analyzeFeasibility } from "./feasibility";

export interface AutoFixResult {
  project: Project;
  appliedLabels: string[]; // human-readable description of each fix applied
}

/** Greedily apply safe feasibility tweaks until the project is feasible or
 *  no more tweaks are available. Runs synchronously on the main thread. */
export function autoFixToFeasible(project: Project, timetableId: Id): AutoFixResult {
  const appliedLabels: string[] = [];
  let current = project;

  for (let i = 0; i < 20; i++) {
    const feas = analyzeFeasibility(current, timetableId);
    if (feas.status === "ready") break;

    let madeProgress = false;
    for (const blocker of feas.structuredBlockers ?? []) {
      if (!blocker.relaxation.apply) continue;
      const after = blocker.relaxation.apply(current);
      if (after !== current) {
        madeProgress = true;
        current = after;
        appliedLabels.push(blocker.relaxation.message);
      }
    }

    if (!madeProgress) break;
  }

  return { project: current, appliedLabels };
}
