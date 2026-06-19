import { afterEach, describe, expect, it, vi } from "vitest";
import { buildBundledProject } from "../fixtures/bundled";
import { runPlanTimetable } from "./fillClient";
import type { PlanResult } from "./plan";

describe("solver client wiring", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("runs timetable planning through the worker when workers are available", async () => {
    const project = buildBundledProject();
    const timetableId = project.activeTimetableId!;
    const sentinel = { requestStatuses: [] } as unknown as PlanResult;
    let posted: unknown = null;
    let terminated = false;

    class FakeWorker {
      onmessage: ((event: MessageEvent<PlanResult>) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;

      postMessage(message: unknown): void {
        posted = message;
        queueMicrotask(() => this.onmessage?.({ data: sentinel } as MessageEvent<PlanResult>));
      }

      terminate(): void {
        terminated = true;
      }
    }

    vi.stubGlobal("Worker", FakeWorker);

    const result = await runPlanTimetable(project, timetableId, 9);

    expect(result).toBe(sentinel);
    expect(posted).toMatchObject({ mode: "plan", project, timetableId, seeds: 9 });
    expect(terminated).toBe(true);
  });
});
