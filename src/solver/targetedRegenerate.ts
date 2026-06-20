// Targeted regenerate (M28). Freezes everything outside the given scope, then runs the
// prove-mode exact search on just the unfrozen area. On small scopes (≤ 18 outstanding
// units after pinning) the exact search either finds a solution or exhausts all options,
// giving a genuine "Proven impossible" verdict rather than a heuristic "Likely impossible".

import type { Day, Id, Placement, Project } from "../domain/types";
import { solveTimetable } from "./deepSearch";
import type { CandidateResult } from "./types";

export type ScopeType = "class" | "teacher" | "day";

export interface TargetedScope {
  type: ScopeType;
  /** classId, teacherId, or Day string depending on type */
  id: string;
}

function inScope(p: Placement, project: Project, scope: TargetedScope): boolean {
  const event = project.events.find((e) => e.id === p.eventId);
  if (!event) return false;
  if (scope.type === "class") {
    // Only re-plan events that belong EXCLUSIVELY to the target class. Multi-class
    // (shared/team) events are kept pinned so the other classes' schedules are not
    // disturbed — moving a shared event would leave the other class with a gap.
    return event.classIds.length === 1 && event.classIds[0] === scope.id;
  }
  if (scope.type === "teacher") return event.teacherIds.includes(scope.id);
  if (scope.type === "day") return p.day === (scope.id as Day);
  return false;
}

/**
 * Re-plan just the given scope. Pins all out-of-scope placements, clears in-scope
 * placements, then runs the prove-mode solver. Returns a CandidateResult whose
 * `changes` contains ONLY cells inside the scope.
 *
 * AC: an impossible scope returns proofLevel "impossible" naming the bottleneck.
 * Property: result.changes every c is inside the scope.
 */
export function targetedRegenerate(
  project: Project,
  timetableId: Id,
  scope: TargetedScope,
  opts?: { budgetMs?: number },
): CandidateResult {
  const table = project.timetables.find((t) => t.id === timetableId);
  if (!table) throw new Error(`Timetable ${timetableId} not found.`);

  // Keep only out-of-scope placements, all pinned so the solver cannot move them.
  const frozenPlacements: Placement[] = table.placements
    .filter((p) => !inScope(p, project, scope))
    .map((p) => ({ ...p, pinned: true }));

  const scopedProject: Project = {
    ...project,
    timetables: project.timetables.map((t) =>
      t.id !== timetableId ? t : { ...t, placements: frozenPlacements },
    ),
  };

  return solveTimetable(scopedProject, timetableId, {
    mode: "prove",
    budgetMs: opts?.budgetMs ?? 5000,
  });
}
