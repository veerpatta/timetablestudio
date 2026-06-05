import { describe, it, expect } from "vitest";
import {
  addClass,
  removeClass,
  addTeacher,
  removeTeacher,
  addQuota,
  removeQuota,
  setSchoolName,
  setActiveProfile,
} from "./projectEdit";
import { makeDemoProject } from "../store/projectStore";

describe("projectEdit (cascading CRUD)", () => {
  it("addClass / removeClass cascades to requirements, lessons and placements", () => {
    let p = makeDemoProject();
    p = addClass(p, "Class 99", "senior");
    expect(p.classes.some((c) => c.id === "Class 99")).toBe(true);

    const before = p.requirements.curriculum.filter((r) => r.classId === "Class 6").length;
    expect(before).toBeGreaterThan(0);
    p = removeClass(p, "Class 6");
    expect(p.classes.some((c) => c.id === "Class 6")).toBe(false);
    expect(p.requirements.curriculum.some((r) => r.classId === "Class 6")).toBe(false);
    expect(p.activities.some((a) => a.kind === "lesson" && a.classId === "Class 6")).toBe(false);
    const tt = p.timetables.find((t) => t.id === p.activeTimetableId)!;
    expect(tt.placements.some((pl) => pl.activityId.includes("Class 6|"))).toBe(false);
  });

  it("removeTeacher drops their single-teacher lessons and quotas", () => {
    let p = makeDemoProject();
    expect(p.requirements.curriculum.some((r) => r.teacherIds.includes("Nidhika"))).toBe(true);
    p = removeTeacher(p, "Nidhika");
    expect(p.teachers.some((t) => t.id === "Nidhika")).toBe(false);
    expect(p.requirements.curriculum.some((r) => r.teacherIds.includes("Nidhika"))).toBe(false);
    // ELGA block teachers untouched
    const elga = p.activities.find((a) => a.kind === "block")!;
    if (elga.kind === "block") expect(elga.teacherIds).toContain("Bindu");
  });

  it("addQuota adds a requirement + canonical lesson + subject; removeQuota reverses it", () => {
    let p = addTeacher(makeDemoProject(), "Zoya", ["Art"]);
    p = addQuota(p, { classId: "Class 7", subjectId: "Art", teacher: "Zoya", periodsPerWeek: 2 });
    expect(p.subjects.some((s) => s.id === "Art")).toBe(true);
    const req = p.requirements.curriculum.find((r) => r.subjectId === "Art" && r.classId === "Class 7")!;
    expect(req.periodsPerWeek).toBe(2);
    expect(p.activities.some((a) => a.kind === "lesson" && a.subjectId === "Art")).toBe(true);

    p = removeQuota(p, req.id);
    expect(p.requirements.curriculum.some((r) => r.id === req.id)).toBe(false);
    expect(p.activities.some((a) => a.kind === "lesson" && a.subjectId === "Art")).toBe(false);
  });

  it("setSchoolName and setActiveProfile update meta", () => {
    let p = setSchoolName(makeDemoProject(), "New Name");
    expect(p.school.name).toBe("New Name");
    p = setActiveProfile(p, { days: ["Mon", "Tue"], periods: 4 });
    const prof = p.profiles.find((pr) => pr.id === p.timetables[0]!.profileId)!;
    expect(prof.days).toEqual(["Mon", "Tue"]);
    expect(prof.periods).toHaveLength(4);
  });
});
