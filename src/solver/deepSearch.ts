import { totalShortfall } from "../domain/coverage";
import { placeNormalLesson } from "../domain/edit";
import type { Id, Project } from "../domain/types";
import { generate } from "./generate";
import { planTimetable } from "./plan";
import { analyzeFeasibility } from "./feasibility";
import { betterProject, candidateResult, scoreProject } from "./candidateScoring";
import { buildSearchDomains, outstandingUnits, type SearchOption } from "./domains";
import type { CandidateResult, SolverRequest } from "./types";

const DEFAULT_BUDGET = 5000;
const PROVE_UNIT_LIMIT = 18;

interface ExactResult {
  project: Project;
  tried: number;
  timedOut: boolean;
  exhausted: boolean;
}

interface SolveTimetableOptions {
  onCandidate?: (candidate: CandidateResult) => void;
}

function applyOption(project: Project, timetableId: Id, option: SearchOption): Project {
  return placeNormalLesson(project, timetableId, option.unit.classId, option.day, option.slot, option.unit.subjectId, [option.teacherId]);
}

function exactSearch(project: Project, timetableId: Id, budgetMs: number): ExactResult {
  const startedAt = Date.now();
  let tried = 0;
  let best = project;
  let timedOut = false;

  const visit = (current: Project): Project | null => {
    if (Date.now() - startedAt >= budgetMs) {
      timedOut = true;
      return null;
    }
    const tt = current.timetables.find((t) => t.id === timetableId);
    if (!tt) return null;
    if (totalShortfall(current, tt) === 0) return current;
    if (betterProject(current, best, timetableId)) best = current;

    const domains = buildSearchDomains(current, timetableId);
    const next = domains[0];
    if (!next || next.options.length === 0) return null;
    for (const option of next.options) {
      tried++;
      const found = visit(applyOption(current, timetableId, option));
      if (found) return found;
      if (timedOut) return null;
    }
    return null;
  };

  const found = visit(project);
  return { project: found ?? best, tried, timedOut, exhausted: !timedOut && !found };
}

export function solveTimetable(project: Project, timetableId: Id, request: SolverRequest, options: SolveTimetableOptions = {}): CandidateResult {
  const startedAt = Date.now();
  const budgetMs = Math.max(250, request.budgetMs ?? DEFAULT_BUDGET);
  const feasibility = analyzeFeasibility(project, timetableId);
  if (feasibility.status === "blocked") {
    const blocked = candidateResult(project, project, timetableId, {
      mode: request.mode,
      proofLevel: "impossible",
      feasibility,
      triedCandidates: 0,
      startedAt,
      blockers: feasibility.blockers,
      relaxationSuggestions: feasibility.relaxationSuggestions,
    });
    options.onCandidate?.(blocked);
    return blocked;
  }

  const currentScore = scoreProject(project, timetableId);
  const startingCandidate = candidateResult(project, project, timetableId, {
    mode: request.mode,
    proofLevel: currentScore.hardCount === 0 && currentScore.remainingShortfall === 0 ? "complete" : "best_found",
    feasibility,
    triedCandidates: 0,
    startedAt,
  });
  options.onCandidate?.(startingCandidate);

  if (currentScore.hardCount === 0 && currentScore.remainingShortfall === 0) {
    return startingCandidate;
  }

  if (request.mode === "fast") {
    const generated = planTimetable(project, timetableId, { seeds: request.seeds ?? 8, budgetMs });
    const fastResult = candidateResult(project, generated.project, timetableId, {
      mode: "fast",
      proofLevel: generated.remainingShortfall === 0 && generated.hardCount === 0 ? "complete" : "best_found",
      feasibility,
      triedCandidates: generated.triedSeeds,
      startedAt,
      blockers: generated.blockers,
    });
    options.onCandidate?.(fastResult);
    return fastResult;
  }

  const units = outstandingUnits(project, timetableId);
  if (request.mode === "prove" && units.length <= PROVE_UNIT_LIMIT) {
    const exact = exactSearch(project, timetableId, budgetMs);
    const score = scoreProject(exact.project, timetableId);
    const exactResult = candidateResult(project, exact.project, timetableId, {
      mode: "prove",
      proofLevel: score.hardCount === 0 && score.remainingShortfall === 0 ? "complete" : exact.exhausted ? "impossible" : "timeout",
      feasibility,
      triedCandidates: exact.tried,
      startedAt,
      timedOut: exact.timedOut,
      blockers: exact.exhausted ? ["No legal timetable exists for the current small search space under these rules."] : [],
      relaxationSuggestions: exact.exhausted ? ["Relax one strict rule or reduce the required weekly periods, then try again."] : [],
    });
    options.onCandidate?.(exactResult);
    return exactResult;
  }

  const fast = generate(project, timetableId, { seeds: request.seeds ?? request.maxCandidates ?? 8, budgetMs: Math.floor(budgetMs / 2) });
  let best = fast.project;
  let tried = fast.triedSeeds;
  const remainingBudget = Math.max(250, budgetMs - (Date.now() - startedAt));
  if (units.length <= PROVE_UNIT_LIMIT) {
    const exact = exactSearch(project, timetableId, remainingBudget);
    tried += exact.tried;
    if (betterProject(exact.project, best, timetableId)) best = exact.project;
  } else {
    const repaired = planTimetable(project, timetableId, { seeds: request.maxCandidates ?? 12, budgetMs: remainingBudget });
    tried += repaired.triedSeeds;
    if (betterProject(repaired.project, best, timetableId)) best = repaired.project;
  }
  const score = scoreProject(best, timetableId);
  const deepResult = candidateResult(project, best, timetableId, {
    mode: request.mode,
    proofLevel: score.hardCount === 0 && score.remainingShortfall === 0 ? "complete" : Date.now() - startedAt >= budgetMs ? "timeout" : "best_found",
    feasibility,
    triedCandidates: tried,
    startedAt,
    timedOut: Date.now() - startedAt >= budgetMs,
  });
  options.onCandidate?.(deepResult);
  return deepResult;
}
