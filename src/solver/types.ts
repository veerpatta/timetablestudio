import type { Project } from "../domain/types";
import type { CellDiff } from "../domain/diffTimetables";

export type SolveMode = "fast" | "deep" | "prove";
export type ProofLevel = "best_found" | "complete" | "impossible" | "timeout";

export interface FeasibilityReport {
  status: "ready" | "blocked" | "unknown";
  blockers: string[];
  relaxationSuggestions: string[];
}

export interface SolverStats {
  mode: SolveMode;
  triedCandidates: number;
  elapsedMs: number;
  timedOut: boolean;
}

export interface SolverRequest {
  mode: SolveMode;
  budgetMs?: number;
  maxCandidates?: number;
  seeds?: number;
}

export interface SolverProgress {
  phase: "preflight" | "search" | "repair" | "done";
  triedCandidates: number;
  bestHard: number;
  bestMissing: number;
  bestSoft: number;
  elapsedMs: number;
}

export interface CandidateResult {
  project: Project;
  changes: CellDiff[];
  hardCount: number;
  remainingShortfall: number;
  softScore: number;
  proofLevel: ProofLevel;
  feasibility: FeasibilityReport;
  stats: SolverStats;
  blockers: string[];
  relaxationSuggestions: string[];
}
