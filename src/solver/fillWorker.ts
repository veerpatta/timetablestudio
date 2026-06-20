// Web Worker entry for the timetable solver. Legacy fill/generate calls stay supported;
// the deep planner uses structured progress/done/error messages.
// M27: generateCandidates message type added for multi-preset candidate generation.

import type { Id, Project } from "../domain/types";
import { solveTimetable } from "./deepSearch";
import { fill } from "./fill";
import { generate, generateCandidates } from "./generate";
import type { Candidate, SolverProgress, SolverRequest } from "./types";

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

interface GenerateCandidatesMessage {
  type: "generateCandidates";
  project: Project;
  timetableId: Id;
  opts?: { seeds?: number; budgetMs?: number };
}

type WorkerOutbound =
  | { type: "done"; result: unknown }
  | { type: "done_candidates"; candidates: Candidate[] }
  | { type: "progress"; progress: SolverProgress }
  | { type: "candidate"; result: unknown }
  | { type: "error"; message: string };

type WorkerRequest = LegacyRequest | SolveRequestMessage | GenerateCandidatesMessage;

function post(message: WorkerOutbound | unknown): void {
  (self as unknown as { postMessage: (m: unknown) => void }).postMessage(message);
}

function postProgress(progress: SolverProgress): void {
  post({ type: "progress", progress });
}

self.onmessage = (e: MessageEvent<WorkerRequest>): void => {
  if ("type" in e.data && e.data.type === "generateCandidates") {
    try {
      const candidates = generateCandidates(e.data.project, e.data.timetableId, e.data.opts);
      post({ type: "done_candidates", candidates });
    } catch (err) {
      post({ type: "error", message: err instanceof Error ? err.message : "generateCandidates failed." });
    }
    return;
  }

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
