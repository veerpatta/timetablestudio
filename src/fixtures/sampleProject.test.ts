import { describe, it, expect } from "vitest";
import sample from "./vpps.sample.ttproj.json";
import { deserializeProject } from "../persistence/projectFile";
import { exportLegacyRawData } from "../domain/legacyExport";
import { validate } from "../domain/validate";
import { legacyRawSample } from "./legacyRaw.sample";

describe("vpps.sample.ttproj.json", () => {
  // Guards against drift between the checked-in fixture and the import logic.
  // Regenerate with: npx vite-node scripts/buildSampleFixture.ts
  it("parses, is feasible, and re-exports to the canonical rawData", () => {
    const project = deserializeProject(JSON.stringify(sample));
    expect(validate(project, project.timetables[0]!)).toEqual([]);
    expect(exportLegacyRawData(project, project.activeTimetableId!)).toBe(legacyRawSample);
  });
});
