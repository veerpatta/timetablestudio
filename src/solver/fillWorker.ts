// Web Worker entry for the auto-fill solver (RB5) — the solver MUST run off the main
// thread (AGENTS §1). This is a thin marshalling shell: it receives a Project + timetable
// id + seed, runs the PURE fill(), and posts the FillResult back. All logic lives in
// fill.ts; the Node AC test calls fill() directly, never this worker.

import type { Id, Project } from "../domain/types";
import { fill } from "./fill";

interface FillRequest {
  project: Project;
  timetableId: Id;
  seed: number;
}

self.onmessage = (e: MessageEvent<FillRequest>): void => {
  const { project, timetableId, seed } = e.data;
  const result = fill(project, timetableId, { seed });
  (self as unknown as { postMessage: (m: unknown) => void }).postMessage(result);
};
