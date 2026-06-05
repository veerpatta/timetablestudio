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
  setClassSubjectQuota,
  copyClassQuotas,
  fillSubjectColumn,
  addBlock,
  removeBlock,
} from "./projectEdit";
import { makeDemoProject } from "../store/projectStore";
import { validate } from "./validate";

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

  it("setClassSubjectQuota replaces a cell even when the teacher changes", () => {
    let p = addTeacher(makeDemoProject(), "Zoya", ["Art"]);
    p = addTeacher(p, "Yara", ["Art"]);
    p = setClassSubjectQuota(p, "Class 7", "Art", { teacher: "Zoya", periodsPerWeek: 3 });
    let cells = p.requirements.curriculum.filter((r) => r.classId === "Class 7" && r.subjectId === "Art");
    expect(cells).toHaveLength(1);
    expect(cells[0]!.teacherIds).toEqual(["Zoya"]);
    // Change the teacher for the SAME cell — must replace, not duplicate.
    p = setClassSubjectQuota(p, "Class 7", "Art", { teacher: "Yara", periodsPerWeek: 4 });
    cells = p.requirements.curriculum.filter((r) => r.classId === "Class 7" && r.subjectId === "Art");
    expect(cells).toHaveLength(1);
    expect(cells[0]!.teacherIds).toEqual(["Yara"]);
    expect(cells[0]!.periodsPerWeek).toBe(4);
    // periods 0 clears the cell.
    p = setClassSubjectQuota(p, "Class 7", "Art", { teacher: "Yara", periodsPerWeek: 0 });
    expect(p.requirements.curriculum.some((r) => r.classId === "Class 7" && r.subjectId === "Art")).toBe(false);
  });

  it("copyClassQuotas and fillSubjectColumn are bulk shortcuts", () => {
    let p = addTeacher(makeDemoProject(), "Zoya", ["Art"]);
    p = setClassSubjectQuota(p, "Class 6", "Art", { teacher: "Zoya", periodsPerWeek: 2 });
    p = copyClassQuotas(p, "Class 6", ["Class 7", "Class 8"]);
    expect(p.requirements.curriculum.some((r) => r.classId === "Class 7" && r.subjectId === "Art")).toBe(true);
    expect(p.requirements.curriculum.some((r) => r.classId === "Class 8" && r.subjectId === "Art")).toBe(true);

    p = fillSubjectColumn(p, "Art", "Zoya", 1, ["Class 9", "Class 10"]);
    const nine = p.requirements.curriculum.find((r) => r.classId === "Class 9" && r.subjectId === "Art")!;
    expect(nine.periodsPerWeek).toBe(1);
  });

  it("addBlock pins a multi-class block; removeBlock reverses it; stays feasible", () => {
    let p = makeDemoProject();
    const ttId = p.activeTimetableId!;
    const before = validate(p, p.timetables.find((t) => t.id === ttId)!).filter((v) => v.severity === "hard").length;
    p = addBlock(p, {
      name: "Assembly",
      classIds: ["Class 9", "Class 10"],
      teacherIds: ["Nidhika"],
      length: 1,
      days: ["Sat"],
      startPeriod: 6,
    });
    expect(p.activities.some((a) => a.kind === "block" && a.name === "Assembly")).toBe(true);
    expect(p.subjects.some((s) => s.id === "Assembly")).toBe(true);
    const block = p.activities.find((a) => a.kind === "block" && a.name === "Assembly")!;
    expect(p.timetables.find((t) => t.id === ttId)!.placements.some((pl) => pl.activityId === block.id)).toBe(true);

    p = removeBlock(p, block.id);
    expect(p.activities.some((a) => a.id === block.id)).toBe(false);
    expect(p.requirements.blocks.some((b) => b.blockActivityId === block.id)).toBe(false);
    const after = validate(p, p.timetables.find((t) => t.id === ttId)!).filter((v) => v.severity === "hard").length;
    expect(after).toBe(before);
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
