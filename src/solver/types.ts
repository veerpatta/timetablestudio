import type { Assessment } from "../domain/assessment";
import type { CellDiff } from "../domain/diffTimetables";
import type { Project } from "../domain/types";

export type SolveMode = "fast" | "deep" | "prove";
export type ProofLevel = "best_found" | "complete" | "impossible" | "timeout";

export interface RelaxationSuggestion {
  message: string;
  apply?: (p: Project) => Project;
  severity: "small" | "moderate" | "large";
}

export interface Blocker {
  kind:
    | "teacher_capacity"
    | "class_capacity"
    | "subject_capacity"
    | "slot_contention"
    | "locked_conflict"
    | "cap_sum";
  message: string;
  entityRefs: { type: "teacher" | "class" | "subject" | "slot"; id: string }[];
  relaxation: RelaxationSuggestion;
}

export interface FeasibilityReport {
  status: "ready" | "blocked" | "unknown";
  blockers: string[];
  relaxationSuggestions: string[];
  structuredBlockers?: Blocker[];
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

// --- Multi-candidate generation (M26) ---

/** Human-readable generation outcome, derived from proofLevel + feasibility. */
export type Verdict =
  | "Complete"
  | "Best found"
  | "Likely impossible"
  | "Proven impossible"
  | "Timed out";

/**
 * One generated timetable option produced by generateCandidates().
 * Each Candidate corresponds to one emphasis preset run (Balanced, Teacher-friendly,
 * Student-focused). Fields are sufficient to render the M27 candidate card and compare
 * table without further recompute.
 */
export interface Candidate {
  presetLabel: string;    // "Balanced" | "Teacher-friendly" | "Student-focused"
  project: Project;
  changes: CellDiff[];
  seed: number;
  hardCount: number;
  remainingShortfall: number;
  softScore: number;           // raw count (sum of soft violations, all weight 1)
  weightedSoftScore: number;   // Σ(constraint.weight × preset.multiplier[template]) for soft violations
  assessment: Assessment;
  verdict: Verdict;
}
