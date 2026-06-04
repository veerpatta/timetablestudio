// Typed message protocol between the UI and the solver worker (ARCHITECTURE.md).
// Shared by both sides so requests/responses stay in sync.

import type { Project, Violation, Placement } from "../domain/types";
import type { SolveMode } from "../solver/types";

export interface SolveRequest {
  type: "solve";
  project: Project;
  timetableId: string;
  mode: SolveMode;
  seed: number;
  maxMillis?: number;
}

export type SolverRequest = SolveRequest;

export interface ProgressResponse {
  type: "progress";
  iteration: number;
  bestScore: number;
  hardViolations: number;
}

export interface DoneResponse {
  type: "done";
  placements: Placement[];
  score: number;
  violations: Violation[];
  seed: number;
  feasible: boolean;
  complete: boolean;
}

export interface ErrorResponse {
  type: "error";
  message: string;
}

export type SolverResponse = ProgressResponse | DoneResponse | ErrorResponse;
