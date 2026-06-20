import { totalShortfall } from "../domain/coverage";
import { diffProjects } from "../domain/diffTimetables";
import type { Project, Timetable } from "../domain/types";
import { validate } from "../domain/validate";
import type { CandidateResult, FeasibilityReport, ProofLevel, SolveMode } from "./types";

function activeTable(project: Project, timetableId: string): Timetable | undefined {
  return project.timetables.find((t) => t.id === timetableId);
}

export function scoreProject(project: Project, timetableId: string): { hardCount: number; remainingShortfall: number; softScore: number } {
  const timetable = activeTable(project, timetableId);
  if (!timetable) return { hardCount: 1, remainingShortfall: 0, softScore: 0 };
  const violations = validate(project, timetable);
  return {
    hardCount: violations.filter((v) => v.severity === "hard").length,
    remainingShortfall: totalShortfall(project, timetable),
    softScore: violations.filter((v) => v.severity === "soft").length,
  };
}

export function betterProject(a: Project, b: Project, timetableId: string): boolean {
  const sa = scoreProject(a, timetableId);
  const sb = scoreProject(b, timetableId);
  if (sa.hardCount !== sb.hardCount) return sa.hardCount < sb.hardCount;
  if (sa.remainingShortfall !== sb.remainingShortfall) return sa.remainingShortfall < sb.remainingShortfall;
  return sa.softScore < sb.softScore;
}

export function candidateResult(
  original: Project,
  project: Project,
  timetableId: string,
  opts: {
    mode: SolveMode;
    proofLevel: ProofLevel;
    feasibility: FeasibilityReport;
    triedCandidates: number;
    startedAt: number;
    timedOut?: boolean;
    blockers?: string[];
    relaxationSuggestions?: string[];
  },
): CandidateResult {
  const score = scoreProject(project, timetableId);
  const blockers = [...new Set([...(opts.blockers ?? []), ...opts.feasibility.blockers])];
  const relaxationSuggestions = [...new Set([...(opts.relaxationSuggestions ?? []), ...opts.feasibility.relaxationSuggestions])];
  return {
    project,
    changes: diffProjects(original, project),
    ...score,
    proofLevel: opts.proofLevel,
    feasibility: opts.feasibility,
    stats: {
      mode: opts.mode,
      triedCandidates: opts.triedCandidates,
      elapsedMs: Date.now() - opts.startedAt,
      timedOut: opts.timedOut ?? false,
    },
    blockers,
    relaxationSuggestions,
  };
}
