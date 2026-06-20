// Client for the auto-fill / generate solver. Legacy fill/generate calls still return the
// raw worker result; the deep planner uses structured progress/done messages so the UI can
// honestly show proof level and best-found state.

import type { Id, Project } from "../domain/types";
import { candidateResult } from "./candidateScoring";
import { solveTimetable } from "./deepSearch";
import { fill, type FillResult } from "./fill";
import { generate, generateCandidates, type GenerateResult } from "./generate";
import { targetedRegenerate, type TargetedScope } from "./targetedRegenerate";
import type { Candidate, CandidateResult, SolverProgress, SolverRequest } from "./types";

type LegacyMode = "fill" | "generate";

function runLegacyInWorker<R>(project: Project, timetableId: Id, mode: LegacyMode, seed: number, seeds?: number): Promise<R> {
  return new Promise<R>((resolve, reject) => {
    const worker = new Worker(new URL("./fillWorker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<R>) => {
      worker.terminate();
      resolve(e.data);
    };
    worker.onerror = (e) => {
      worker.terminate();
      reject(e);
    };
    worker.postMessage({ mode, project, timetableId, seed, seeds });
  });
}

type WorkerOutbound =
  | { type: "progress"; progress: SolverProgress }
  | { type: "candidate"; result: CandidateResult }
  | { type: "done"; result: CandidateResult }
  | { type: "error"; message: string };

export interface SolverCallbacks {
  onProgress?: (progress: SolverProgress) => void;
}

export interface CancelableSolve {
  promise: Promise<CandidateResult>;
  cancel: () => void;
}

function cancelledResult(project: Project, timetableId: Id, request: SolverRequest, latest: CandidateResult | null, startedAt: number): CandidateResult {
  if (latest) {
    return {
      ...latest,
      proofLevel: "timeout",
      stats: { ...latest.stats, timedOut: true, elapsedMs: Date.now() - startedAt },
      blockers: latest.blockers.length > 0 ? latest.blockers : ["Planning was stopped before it finished."],
    };
  }
  return candidateResult(project, project, timetableId, {
    mode: request.mode,
    proofLevel: "timeout",
    feasibility: { status: "unknown", blockers: [], relaxationSuggestions: [] },
    triedCandidates: 0,
    startedAt,
    timedOut: true,
    blockers: ["Planning was stopped before it finished."],
  });
}

function startSolveInWorker(project: Project, timetableId: Id, request: SolverRequest, callbacks?: SolverCallbacks): CancelableSolve {
  const startedAt = Date.now();
  const worker = new Worker(new URL("./fillWorker.ts", import.meta.url), { type: "module" });
  let latest: CandidateResult | null = null;
  let settled = false;
  let resolvePromise: (value: CandidateResult) => void = () => {};
  let rejectPromise: (reason?: unknown) => void = () => {};

  const promise = new Promise<CandidateResult>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
    worker.onmessage = (e: MessageEvent<WorkerOutbound>) => {
      if (settled) return;
      if (e.data.type === "progress") {
        callbacks?.onProgress?.(e.data.progress);
        return;
      }
      if (e.data.type === "candidate") {
        latest = e.data.result;
        return;
      }
      worker.terminate();
      settled = true;
      if (e.data.type === "done") resolvePromise(e.data.result);
      else rejectPromise(new Error(e.data.message));
    };
    worker.onerror = (e) => {
      if (settled) return;
      worker.terminate();
      settled = true;
      rejectPromise(e);
    };
    worker.postMessage({ type: "solve", project, timetableId, request });
  });

  return {
    promise,
    cancel: () => {
      if (settled) return;
      worker.terminate();
      settled = true;
      resolvePromise(cancelledResult(project, timetableId, request, latest, startedAt));
    },
  };
}

export function startSolveTimetable(project: Project, timetableId: Id, request: SolverRequest, callbacks?: SolverCallbacks): CancelableSolve {
  if (typeof Worker !== "undefined") {
    try {
      return startSolveInWorker(project, timetableId, request, callbacks);
    } catch {
      // Worker construction failed (e.g. unsupported) - fall back to the main thread.
    }
  }

  const startedAt = Date.now();
  let cancelled = false;
  const promise = Promise.resolve().then(() => {
    if (cancelled) return cancelledResult(project, timetableId, request, null, startedAt);
    callbacks?.onProgress?.({ phase: "preflight", triedCandidates: 0, bestHard: 0, bestMissing: 0, bestSoft: 0, elapsedMs: 0 });
    const result = solveTimetable(project, timetableId, request);
    callbacks?.onProgress?.({
      phase: "done",
      triedCandidates: result.stats.triedCandidates,
      bestHard: result.hardCount,
      bestMissing: result.remainingShortfall,
      bestSoft: result.softScore,
      elapsedMs: result.stats.elapsedMs,
    });
    return cancelled ? cancelledResult(project, timetableId, request, result, startedAt) : result;
  });
  return { promise, cancel: () => { cancelled = true; } };
}

/** Single greedy fill at one seed (used where a specific seed must be reproduced). */
export async function runFill(project: Project, timetableId: Id, seed: number): Promise<FillResult> {
  if (typeof Worker !== "undefined") {
    try {
      return await runLegacyInWorker<FillResult>(project, timetableId, "fill", seed);
    } catch {
      // Worker construction failed (e.g. unsupported) - fall back to the main thread.
    }
  }
  return fill(project, timetableId, { seed });
}

/** Best-of-N generate: legal every seed, returns the fill with the fewest prefer violations. */
export async function runGenerate(project: Project, timetableId: Id, seeds = 8): Promise<GenerateResult> {
  if (typeof Worker !== "undefined") {
    try {
      return await runLegacyInWorker<GenerateResult>(project, timetableId, "generate", 1, seeds);
    } catch {
      // Fall back to the main thread.
    }
  }
  return generate(project, timetableId, { seeds });
}

export async function runSolveTimetable(project: Project, timetableId: Id, request: SolverRequest, callbacks?: SolverCallbacks): Promise<CandidateResult> {
  return startSolveTimetable(project, timetableId, request, callbacks).promise;
}

export async function runPlanTimetable(project: Project, timetableId: Id, maxCandidates = 8): Promise<CandidateResult> {
  return runSolveTimetable(project, timetableId, { mode: "deep", maxCandidates, budgetMs: 5000 });
}

/** Targeted regenerate for a specific scope (M28). Falls back to main thread if Worker unavailable. */
export async function runTargetedRegenerate(
  project: Project,
  timetableId: Id,
  scope: TargetedScope,
  opts?: { budgetMs?: number },
): Promise<CandidateResult> {
  if (typeof Worker !== "undefined") {
    try {
      return await new Promise<CandidateResult>((resolve, reject) => {
        const worker = new Worker(new URL("./fillWorker.ts", import.meta.url), { type: "module" });
        type OutMsg = { type: "done_targeted"; result: CandidateResult } | { type: "error"; message: string };
        worker.onmessage = (e: MessageEvent<OutMsg>) => {
          worker.terminate();
          if (e.data.type === "done_targeted") resolve(e.data.result);
          else reject(new Error(e.data.message));
        };
        worker.onerror = (e) => { worker.terminate(); reject(e); };
        worker.postMessage({ type: "targetedRegenerate", project, timetableId, scope, opts });
      });
    } catch {
      // Worker unavailable — fall back to main thread.
    }
  }
  return targetedRegenerate(project, timetableId, scope, opts);
}

/** Multi-preset candidate generation (M27). Falls back to main thread if Worker unavailable. */
export async function runGenerateCandidates(
  project: Project,
  timetableId: Id,
  opts?: { seeds?: number; budgetMs?: number },
): Promise<Candidate[]> {
  if (typeof Worker !== "undefined") {
    try {
      return await new Promise<Candidate[]>((resolve, reject) => {
        const worker = new Worker(new URL("./fillWorker.ts", import.meta.url), { type: "module" });
        type OutMsg = { type: "done_candidates"; candidates: Candidate[] } | { type: "error"; message: string };
        worker.onmessage = (e: MessageEvent<OutMsg>) => {
          worker.terminate();
          if (e.data.type === "done_candidates") resolve(e.data.candidates);
          else reject(new Error(e.data.message));
        };
        worker.onerror = (e) => { worker.terminate(); reject(e); };
        worker.postMessage({ type: "generateCandidates", project, timetableId, opts });
      });
    } catch {
      // Worker unavailable or threw — fall back to main thread.
    }
  }
  return generateCandidates(project, timetableId, opts);
}
