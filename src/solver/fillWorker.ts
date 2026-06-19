// Web Worker entry for the auto-fill / generate solver (RB5 + C6) — the solver MUST run off
// the main thread (AGENTS §1). Thin marshalling shell: it receives a Project + timetable id
// + seed (and an optional `seeds` count for best-of-N generate), runs the PURE solver, and
// posts the result back. All logic lives in fill.ts / generate.ts; Node tests call those
// directly, never this worker.

import type { Id, Project } from "../domain/types";
import { fill } from "./fill";
import { generate } from "./generate";
import { planTimetable } from "./plan";

interface FillRequest {
  mode?: "fill" | "generate" | "plan";
  project: Project;
  timetableId: Id;
  seed: number;
  seeds?: number; // > 1 → best-of-N generate (optimise prefers); else single greedy fill
}

self.onmessage = (e: MessageEvent<FillRequest>): void => {
  const { mode, project, timetableId, seed, seeds } = e.data;
  const kind = mode ?? (seeds && seeds > 1 ? "generate" : "fill");
  const result =
    kind === "plan"
      ? planTimetable(project, timetableId, { seeds })
      : kind === "generate"
        ? generate(project, timetableId, { seeds })
        : fill(project, timetableId, { seed });
  (self as unknown as { postMessage: (m: unknown) => void }).postMessage(result);
};
