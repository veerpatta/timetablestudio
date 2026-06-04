import { describe, it, expect } from "vitest";
import { importLegacyRawData } from "./legacyImport";
import { exportLegacyRawData } from "./legacyExport";
import { validate } from "./validate";
import { legacyRawSample } from "../fixtures/legacyRaw.sample";

describe("legacy round-trip (M1 AC)", () => {
  it("import → export reproduces the rawData text exactly", () => {
    const project = importLegacyRawData(legacyRawSample);
    const out = exportLegacyRawData(project, project.activeTimetableId!);
    expect(out).toBe(legacyRawSample);
  });

  it("ELGA is detected as ONE block: 5 classes, 5 teachers, length 3", () => {
    const project = importLegacyRawData(legacyRawSample);
    const blocks = project.activities.filter((a) => a.kind === "block");
    expect(blocks).toHaveLength(1);
    const elga = blocks[0]!;
    if (elga.kind !== "block") throw new Error("expected block");
    expect(elga.name).toBe("ELGA");
    expect(elga.length).toBe(3);
    expect(elga.classIds).toEqual(["Class 1", "Class 2", "Class 3", "Class 4", "Class 5"]);
    expect(elga.teacherIds).toEqual(["Bindu", "Anita", "Rashmita", "Kusum", "Ravina"]);
  });

  it("places the single ELGA block on both days (P3 start each)", () => {
    const project = importLegacyRawData(legacyRawSample);
    const elga = project.activities.find((a) => a.kind === "block")!;
    const blockPlacements = project.timetables[0]!.placements.filter(
      (p) => p.activityId === elga.id,
    );
    expect(blockPlacements).toHaveLength(2);
    expect(blockPlacements.every((p) => p.period === 3)).toBe(true);
    expect(blockPlacements.map((p) => p.day).sort()).toEqual(["Mon", "Tue"]);
  });

  it("infers class groups (primary / middle / senior)", () => {
    const project = importLegacyRawData(legacyRawSample);
    const byName = new Map(project.classes.map((c) => [c.name, c.group]));
    expect(byName.get("Class 1")).toBe("primary");
    expect(byName.get("Class 7")).toBe("middle");
    expect(byName.get("Class 11 Science")).toBe("senior");
  });

  it("the imported fixture is feasible (0 hard violations)", () => {
    const project = importLegacyRawData(legacyRawSample);
    expect(validate(project, project.timetables[0]!)).toEqual([]);
  });
});
