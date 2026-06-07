// Client for the auto-fill / generate solver (RB5 + C6). Runs the solver in a Web Worker so
// the main thread never blocks (AGENTS §1); falls back to a direct call when Worker is
// unavailable (Node / jsdom tests, or an environment without module workers). The result is
// identical either way — the solver is pure and deterministic per seed (and per seed-list).

import type { Id, Project } from "../domain/types";
import { fill, type FillResult } from "./fill";
import { generate, type GenerateResult } from "./generate";

function runInWorker<R extends FillResult>(project: Project, timetableId: Id, seed: number, seeds?: number): Promise<R> {
  return new Promise<R>((resolve, reject) => {
    const worker = new Worker(new URL("./fillWorker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<R>) => {
      resolve(e.data);
      worker.terminate();
    };
    worker.onerror = (e) => {
      worker.terminate();
      reject(e);
    };
    worker.postMessage({ project, timetableId, seed, seeds });
  });
}

/** Single greedy fill at one seed (used where a specific seed must be reproduced). */
export async function runFill(project: Project, timetableId: Id, seed: number): Promise<FillResult> {
  if (typeof Worker !== "undefined") {
    try {
      return await runInWorker<FillResult>(project, timetableId, seed);
    } catch {
      // Worker construction failed (e.g. unsupported) — fall back to the main thread.
    }
  }
  return fill(project, timetableId, { seed });
}

/** Best-of-N generate: legal every seed, returns the fill with the fewest prefer violations. */
export async function runGenerate(project: Project, timetableId: Id, seeds = 8): Promise<GenerateResult> {
  if (typeof Worker !== "undefined") {
    try {
      return await runInWorker<GenerateResult>(project, timetableId, 1, seeds);
    } catch {
      // fall back to the main thread
    }
  }
  return generate(project, timetableId, { seeds });
}
