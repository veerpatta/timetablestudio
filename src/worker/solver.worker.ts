// Web Worker host for the solver (AGENTS.md §1: never solve on the main thread).
// Cancel is handled on the UI side by terminating the worker (the solve loop is
// synchronous within the worker thread, which is itself off the UI thread).

import { solve } from "../solver/engine";
import type { SolverRequest, SolverResponse } from "./protocol";

const post = (msg: SolverResponse) => (self as DedicatedWorkerGlobalScope).postMessage(msg);

self.onmessage = (e: MessageEvent<SolverRequest>) => {
  const msg = e.data;
  if (msg.type !== "solve") return;
  try {
    const result = solve(msg.project, msg.timetableId, {
      mode: msg.mode,
      seed: msg.seed,
      maxMillis: msg.maxMillis,
      onProgress: (p) =>
        post({
          type: "progress",
          iteration: p.iteration,
          bestScore: p.bestScore,
          hardViolations: p.hardViolations,
        }),
    });
    post({
      type: "done",
      placements: result.placements,
      score: result.score,
      violations: result.violations,
      seed: result.seed,
      feasible: result.feasible,
      complete: result.complete,
    });
  } catch (err) {
    post({ type: "error", message: (err as Error).message });
  }
};
