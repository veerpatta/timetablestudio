import { afterEach, describe, expect, it, vi } from "vitest";
import { buildBundledProject } from "../fixtures/bundled";
import { runPlanTimetable, runSolveTimetable, startSolveTimetable } from "./fillClient";
import type { CandidateResult, SolverProgress } from "./types";

describe("solver client wiring", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("runs timetable planning through the worker when workers are available", async () => {
    const project = buildBundledProject();
    const timetableId = project.activeTimetableId!;
    const sentinel = { proofLevel: "complete", stats: { mode: "deep" } } as unknown as CandidateResult;
    let posted: unknown = null;
    let terminated = false;

    class FakeWorker {
      onmessage: ((event: MessageEvent<{ type: "done"; result: CandidateResult }>) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;

      postMessage(message: unknown): void {
        posted = message;
        queueMicrotask(() => this.onmessage?.({ data: { type: "done", result: sentinel } } as MessageEvent<{ type: "done"; result: CandidateResult }>));
      }

      terminate(): void {
        terminated = true;
      }
    }

    vi.stubGlobal("Worker", FakeWorker);

    const result = await runPlanTimetable(project, timetableId, 9);

    expect(result).toBe(sentinel);
    expect(posted).toMatchObject({ type: "solve", project, timetableId, request: { mode: "deep", maxCandidates: 9 } });
    expect(terminated).toBe(true);
  });

  it("passes worker progress messages to the caller before resolving", async () => {
    const project = buildBundledProject();
    const timetableId = project.activeTimetableId!;
    const progress: SolverProgress = { phase: "search", triedCandidates: 2, bestHard: 0, bestMissing: 1, bestSoft: 3, elapsedMs: 50 };
    const sentinel = { proofLevel: "best_found", stats: { mode: "deep" } } as unknown as CandidateResult;
    const seen: SolverProgress[] = [];

    class FakeWorker {
      onmessage: ((event: MessageEvent<{ type: "progress"; progress: SolverProgress } | { type: "done"; result: CandidateResult }>) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;

      postMessage(): void {
        queueMicrotask(() => {
          this.onmessage?.({ data: { type: "progress", progress } } as MessageEvent<{ type: "progress"; progress: SolverProgress }>);
          this.onmessage?.({ data: { type: "done", result: sentinel } } as MessageEvent<{ type: "done"; result: CandidateResult }>);
        });
      }

      terminate(): void {}
    }

    vi.stubGlobal("Worker", FakeWorker);

    const result = await runSolveTimetable(project, timetableId, { mode: "deep" }, { onProgress: (p) => seen.push(p) });

    expect(result).toBe(sentinel);
    expect(seen).toEqual([progress]);
  });

  it("can cancel a worker solve and resolve with the latest reported candidate", async () => {
    const project = buildBundledProject();
    const timetableId = project.activeTimetableId!;
    const sentinel = {
      proofLevel: "best_found",
      stats: { mode: "deep", triedCandidates: 3, elapsedMs: 25, timedOut: false },
      blockers: [],
    } as unknown as CandidateResult;
    let terminated = false;

    class FakeWorker {
      onmessage: ((event: MessageEvent<{ type: "candidate"; result: CandidateResult }>) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;

      postMessage(): void {
        queueMicrotask(() => {
          this.onmessage?.({ data: { type: "candidate", result: sentinel } } as MessageEvent<{ type: "candidate"; result: CandidateResult }>);
        });
      }

      terminate(): void {
        terminated = true;
      }
    }

    vi.stubGlobal("Worker", FakeWorker);

    const handle = startSolveTimetable(project, timetableId, { mode: "deep" });
    await Promise.resolve();
    handle.cancel();
    const result = await handle.promise;

    expect(terminated).toBe(true);
    expect(result.proofLevel).toBe("timeout");
    expect(result.stats.timedOut).toBe(true);
    expect(result.stats.triedCandidates).toBe(3);
  });
});
