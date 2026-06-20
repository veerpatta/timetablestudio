// Web Worker entry for the timetable solver. Legacy fill/generate calls stay supported;
// the deep planner uses structured progress/done/error messages.

import type { Id, Project } from "../domain/types";
import { solveTimetable } from "./deepSearch";
import { fill } from "./fill";
import { generate } from "./generate";
import type { SolverProgress, SolverRequest } from "./types";

interface LegacyRequest {
  mode?: "fill" | "generate";
  project: Project;
  timetableId: Id;
  seed: number;
  seeds?: number;
}

interface SolveRequestMessage {
  type: "solve";
  project: Project;
  timetableId: Id;
  request: SolverRequest;
}

type WorkerRequest = LegacyRequest | SolveRequestMessage;

function post(message: unknown): void {
  (self as unknown as { postMessage: (m: unknown) => void }).postMessage(message);
}

function postProgress(progress: SolverProgress): void {
  post({ type: "progress", progress });
}

self.onmessage = (e: MessageEvent<WorkerRequest>): void => {
  if ("type" in e.data && e.data.type === "solve") {
    const startedAt = Date.now();
    postProgress({ phase: "preflight", triedCandidates: 0, bestHard: 0, bestMissing: 0, bestSoft: 0, elapsedMs: 0 });
    try {
      const result = solveTimetable(e.data.project, e.data.timetableId, e.data.request, {
        onCandidate: (candidate) => post({ type: "candidate", result: candidate }),
      });
      postProgress({
        phase: "done",
        triedCandidates: result.stats.triedCandidates,
        bestHard: result.hardCount,
        bestMissing: result.remainingShortfall,
        bestSoft: result.softScore,
        elapsedMs: Date.now() - startedAt,
      });
      post({ type: "done", result });
    } catch (err) {
      post({ type: "error", message: err instanceof Error ? err.message : "The solver could not finish." });
    }
    return;
  }

  const legacy = e.data as LegacyRequest;
  const { mode, project, timetableId, seed, seeds } = legacy;
  const kind = mode ?? (seeds && seeds > 1 ? "generate" : "fill");
  post(kind === "generate" ? generate(project, timetableId, { seeds }) : fill(project, timetableId, { seed }));
};
