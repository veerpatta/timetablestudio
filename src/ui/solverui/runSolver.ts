// UI-side wrapper around the solver worker. Browser-only. Returns a promise for
// the result plus a cancel() that terminates the worker (rejecting the promise).

import SolverWorker from "../../worker/solver.worker?worker";
import type { DoneResponse, ProgressResponse, SolveRequest } from "../../worker/protocol";

export interface RunHandle {
  promise: Promise<DoneResponse>;
  cancel: () => void;
}

export function runSolver(
  req: Omit<SolveRequest, "type">,
  onProgress?: (p: ProgressResponse) => void,
): RunHandle {
  const worker = new SolverWorker();
  let settle: { reject: (e: Error) => void } | null = null;

  const promise = new Promise<DoneResponse>((resolve, reject) => {
    settle = { reject };
    worker.onmessage = (e: MessageEvent<DoneResponse | ProgressResponse | { type: "error"; message: string }>) => {
      const msg = e.data;
      if (msg.type === "progress") onProgress?.(msg);
      else if (msg.type === "done") {
        resolve(msg);
        worker.terminate();
      } else if (msg.type === "error") {
        reject(new Error(msg.message));
        worker.terminate();
      }
    };
    worker.onerror = (e) => {
      reject(new Error(e.message || "Solver worker error"));
      worker.terminate();
    };
    worker.postMessage({ type: "solve", ...req } satisfies SolveRequest);
  });

  const cancel = () => {
    worker.terminate();
    settle?.reject(new Error("cancelled"));
  };

  return { promise, cancel };
}
