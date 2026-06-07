// Client for the auto-fill solver (RB5). Runs fill() in a Web Worker so the main thread
// never blocks (AGENTS §1); falls back to a direct call when Worker is unavailable (Node /
// jsdom tests, or an environment without module workers). The result is identical either
// way — fill() is pure and deterministic per seed.

import type { Id, Project } from "../domain/types";
import { fill, type FillResult } from "./fill";

function runInWorker(project: Project, timetableId: Id, seed: number): Promise<FillResult> {
  return new Promise<FillResult>((resolve, reject) => {
    const worker = new Worker(new URL("./fillWorker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<FillResult>) => {
      resolve(e.data);
      worker.terminate();
    };
    worker.onerror = (e) => {
      worker.terminate();
      reject(e);
    };
    worker.postMessage({ project, timetableId, seed });
  });
}

export async function runFill(project: Project, timetableId: Id, seed: number): Promise<FillResult> {
  if (typeof Worker !== "undefined") {
    try {
      return await runInWorker(project, timetableId, seed);
    } catch {
      // Worker construction failed (e.g. unsupported) — fall back to the main thread.
    }
  }
  return fill(project, timetableId, { seed });
}
