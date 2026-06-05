import { describe, it, expect } from "vitest";
import { teacherImpact, reassignTeacher } from "./lifecycle";
import { removeTeacher } from "./projectEdit";
import { validate } from "./validate";
import { makeRealVppsProject } from "../fixtures/vppsReal";
import type { Project, Id } from "./types";

/** Count every reference to a teacher id anywhere in the project. */
function referencesTo(project: Project, id: Id): number {
  let n = 0;
  for (const a of project.activities) if (a.teacherIds.includes(id)) n++;
  for (const c of project.classes) if (c.classTeacherId === id) n++;
  for (const r of project.requirements.curriculum) if (r.teacherIds.includes(id)) n++;
  for (const r of project.rules) if ("teacherId" in r && r.teacherId === id) n++;
  if (project.teachers.some((t) => t.id === id)) n++;
  return n;
}

describe("entity lifecycle — teacher reassignment (M18 AC#2)", () => {
  it("counts a teacher's footprint for the impact preview", () => {
    const project = makeRealVppsProject();
    const impact = teacherImpact(project, "Maya");
    expect(impact.lessons + impact.requirements).toBeGreaterThan(0);
    expect(impact.placements).toBeGreaterThan(0);
  });

  it("reassigning then removing leaves ZERO dangling references", () => {
    const project = makeRealVppsProject();
    expect(referencesTo(project, "Maya")).toBeGreaterThan(0); // present to start

    const reassigned = reassignTeacher(project, "Maya", "Anjana");
    // Every reference moved off Maya, and Maya is no longer a teacher.
    expect(referencesTo(reassigned, "Maya")).toBe(0);
    // Anjana inherited Maya's subjects, so she's qualified for the moved lessons.
    const anjana = reassigned.teachers.find((t) => t.id === "Anjana")!;
    expect(anjana.subjects).toEqual(expect.arrayContaining(["CCS"]));

    // A plain removeTeacher AFTER reassign is a no-op for dangling refs (none left).
    const removed = removeTeacher(reassigned, "Maya");
    expect(referencesTo(removed, "Maya")).toBe(0);
    // No qualification (H6) regressions from the reassignment.
    const tt = removed.timetables.find((t) => t.id === removed.activeTimetableId)!;
    expect(validate(removed, tt).filter((v) => v.constraintId === "H6")).toHaveLength(0);
  });

  it("is a no-op when the target teacher doesn't exist or equals the source", () => {
    const project = makeRealVppsProject();
    expect(reassignTeacher(project, "Maya", "Maya")).toBe(project);
    expect(reassignTeacher(project, "Maya", "Nobody")).toBe(project);
  });
});
