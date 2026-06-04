import { describe, it, expect } from "vitest";
import { deriveRequirements, normalizeProject } from "./requirements";
import { importLegacyRawData } from "./legacyImport";
import { validate } from "./validate";
import { legacyRawSample } from "../fixtures/legacyRaw.sample";

describe("deriveRequirements", () => {
  it("groups repeated lessons into requirements with correct periodsPerWeek", () => {
    const project = importLegacyRawData(legacyRawSample, "VPPS");
    const d = deriveRequirements(project, project.activeTimetableId!);
    // Class 1 Maths (Bindu) appears once Mon + once Tue → 2/week.
    const req = d.curriculum.find(
      (r) => r.classId === "Class 1" && r.subjectId === "Maths",
    );
    expect(req?.periodsPerWeek).toBe(2);
    expect(req?.teacherIds).toEqual(["Bindu"]);
  });

  it("emits one BlockRequirement for ELGA with both occurrences", () => {
    const project = importLegacyRawData(legacyRawSample, "VPPS");
    const d = deriveRequirements(project, project.activeTimetableId!);
    expect(d.blocks).toHaveLength(1);
    expect(d.blocks[0]!.occurrences).toHaveLength(2);
    expect(d.blocks[0]!.occurrences.every((o) => o.startPeriod === 3)).toBe(true);
  });

  it("normalizeProject stays feasible and equivalent", () => {
    const project = importLegacyRawData(legacyRawSample, "VPPS");
    const norm = normalizeProject(project, project.activeTimetableId!);
    const tt = norm.timetables.find((t) => t.id === norm.activeTimetableId)!;
    expect(validate(norm, tt)).toEqual([]);
    // every curriculum requirement has a matching canonical lesson activity
    for (const r of norm.requirements.curriculum) {
      expect(
        norm.activities.some(
          (a) => a.kind === "lesson" && a.classId === r.classId && a.subjectId === r.subjectId,
        ),
      ).toBe(true);
    }
  });
});
