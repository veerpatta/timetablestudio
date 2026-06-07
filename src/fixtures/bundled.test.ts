import { describe, expect, it } from "vitest";
import { validate } from "../domain/validate";
import { buildBundledProject, BUNDLED_DATA_VERSION } from "./bundled";

describe("bundled real 2026-27 project", () => {
  const project = buildBundledProject();
  const tt = project.timetables.find((t) => t.id === project.activeTimetableId)!;

  it("opens with ZERO real clashes (the RB1 headline)", () => {
    const violations = validate(project, tt);
    expect(violations).toEqual([]);
  });

  it("has the 16 classes and the full staff roster (incl. non-schedulable Director)", () => {
    expect(project.classes).toHaveLength(16);
    expect(project.teachers.map((t) => t.name)).toContain("Director");
    expect(project.teachers.find((t) => t.name === "Director")!.schedulable).toBe(false);
    expect(project.schemaVersion).toBe(6);
    expect(project.bundledDataVersion).toBe(BUNDLED_DATA_VERSION);
  });

  it("renders ELGA as ONE team_block event: 5 classes × 5 teachers, Mon–Thu, duration 3", () => {
    const teamBlocks = project.events.filter((e) => e.type === "team_block");
    expect(teamBlocks).toHaveLength(1);
    const elga = teamBlocks[0]!;
    expect(elga.subjectId).toBe("ELGA");
    expect(elga.classIds.sort()).toEqual(["Class 1", "Class 2", "Class 3", "Class 4", "Class 5"]);
    expect(elga.teacherIds.sort()).toEqual(["Anita", "Bindu", "Kusum", "Rashmita", "Ravina"]);
    expect(elga.duration).toBe(3);
    const elgaPlacements = tt.placements.filter((p) => p.eventId === elga.id);
    expect(elgaPlacements.map((p) => p.day).sort()).toEqual(["Mon", "Thu", "Tue", "Wed"]);
  });

  it("renders senior combined classes as single joint_class events (English/Hindi/Economics × 11 and 12)", () => {
    const joints = project.events.filter((e) => e.type === "joint_class");
    // English (11,12), Hindi (11,12), Economics (11,12) = 6 joint events.
    expect(joints).toHaveLength(6);
    const eng11 = joints.find(
      (e) => e.subjectId === "English compulsory" && e.classIds.includes("Class 11 Science"),
    )!;
    expect(eng11.classIds.sort()).toEqual(["Class 11 Arts", "Class 11 Commerce", "Class 11 Science"]);
    expect(eng11.teacherIds).toEqual(["Pradhyuman"]);
    const econ11 = joints.find(
      (e) => e.subjectId === "Economics" && e.classIds.includes("Class 11 Arts"),
    )!;
    expect(econ11.classIds.sort()).toEqual(["Class 11 Arts", "Class 11 Commerce"]);
  });

  it("models the Science split: Physics/Chemistry/Biology in middle+senior, combined Science in secondary", () => {
    const science = project.subjects.find((s) => s.id === "Science")!;
    expect(science.bands).toEqual(["secondary"]);
    const physics = project.subjects.find((s) => s.id === "Physics")!;
    expect(physics.bands.sort()).toEqual(["middle", "senior"]);
  });

  it("encodes the hard availability windows (Mahesh early-only, Anjana after-recess)", () => {
    const mahesh = project.teachers.find((t) => t.name === "Mahesh")!;
    // unavailable P4–P8 → regular slots 4,6,7,8,9 each day (Mahesh teaches only P1–P3).
    expect(new Set(mahesh.unavailable.map((u) => u.slot))).toEqual(new Set([4, 6, 7, 8, 9]));
    const anjana = project.teachers.find((t) => t.name === "Anjana")!;
    expect(new Set(anjana.unavailable.map((u) => u.slot))).toEqual(new Set([1, 2, 3, 4]));
  });
});
