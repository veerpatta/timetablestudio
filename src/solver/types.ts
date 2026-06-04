// Solver public types. PURE.

import type { Placement, Violation } from "../domain/types";

export type SolveMode = "complete" | "generate";

export interface SolveOptions {
  mode: SolveMode;
  seed: number;
  /** Wall-clock budget; always returns best-so-far when hit. Default 4000. */
  maxMillis?: number;
  /** Hard cap on backtracking steps. Default 200_000. */
  maxIterations?: number;
  /** Throttled progress callback (~4/s). */
  onProgress?: (p: SolveProgress) => void;
  /** Cooperative cancel: return true to stop and yield best-so-far. */
  shouldCancel?: () => boolean;
}

export interface SolveProgress {
  iteration: number;
  bestScore: number;
  hardViolations: number;
}

export interface SolveResult {
  placements: Placement[];
  score: number;
  violations: Violation[];
  seed: number;
  /** true iff hard violations === 0. */
  feasible: boolean;
  iterations: number;
  millis: number;
  /** false if stopped by budget/cancel before placing everything. */
  complete: boolean;
}
