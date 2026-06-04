import { describe, it, expect } from "vitest";
import { buildClassRows, buildTeacherRows } from "./gridModel";
import { makeSampleProject } from "../../store/projectStore";
import { validate } from "../../domain/validate";
import { addPlacement } from "../../domain/edit";
import { lesson } from "../../fixtures/synthetic";
import type { Project, Timetable } from "../../domain/types";

const active = (p: Project): Timetable =>
  p.timetables.find((t) => t.id === p.activeTimetableId)!;

describe("gridModel", () => {
  it("class view: ELGA cells share the block's START-period ref across P3–P5", () => {
    const p = makeSampleProject();
    const rows = buildClassRows(p, active(p), "Mon", []);
    const class1 = rows.find((r) => r.label === "Class 1")!;
    const p3 = class1.cells[2]!; // P3
    const p5 = class1.cells[4]!; // P5
    expect(p3.isBlock).toBe(true);
    expect(p3.label).toMatch(/^ELGA/);
    expect(p3.ref).toEqual(p5.ref); // dragging any block cell moves the whole block
    expect(p3.ref!.period).toBe(3);
    // a normal lesson cell
    expect(class1.cells[0]!.label).toBe("Maths (Bindu)");
  });

  it("marks a hard-conflict cell with severity 'hard'", () => {
    const p = makeSampleProject();
    const tt = active(p);
    const clash = lesson("L-clash", "Class 7", "Hindi", ["Kusum"]);
    const res = addPlacement(p.activities, tt.placements, clash, "Mon", 4);
    p.activities = res.activities;
    tt.placements = res.placements;
    const violations = validate(p, tt);
    const rows = buildClassRows(p, tt, "Mon", violations);
    const class7 = rows.find((r) => r.label === "Class 7")!;
    expect(class7.cells[3]!.severity).toBe("hard"); // P4 Kusum clash
  });

  it("teacher view: a teacher row shows their occupied periods", () => {
    const p = makeSampleProject();
    const rows = buildTeacherRows(p, active(p), "Mon", []);
    const bindu = rows.find((r) => r.label === "Bindu")!;
    expect(bindu.cells[2]!.isBlock).toBe(true); // ELGA P3
    expect(bindu.cells[2]!.label).toBe("ELGA");
  });
});
