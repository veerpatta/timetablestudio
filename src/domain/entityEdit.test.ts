import { describe, expect, it } from "vitest";
import { buildBundledProject } from "../fixtures/bundled";
import {
  addClass,
  addPeriod,
  addSubject,
  addTeacher,
  editPeriod,
  removeClass,
  removePeriod,
  removeSubject,
  removeTeacher,
  renameClass,
  renameSubject,
  renameTeacher,
} from "./entityEdit";
import { findDanglingRefs, referencesOf } from "./references";
import { validate } from "./validate";

const activeTT = (p: ReturnType<typeof buildBundledProject>) =>
  p.timetables.find((t) => t.id === p.activeTimetableId)!;
const hard = (p: ReturnType<typeof buildBundledProject>) =>
  validate(p, activeTT(p)).filter((v) => v.severity === "hard").length;

describe("entityEdit — the bundled project starts consistent", () => {
  it("findDanglingRefs is empty and validate is clean to begin with", () => {
    const p = buildBundledProject();
    expect(findDanglingRefs(p)).toEqual([]);
    expect(hard(p)).toBe(0);
  });
});

describe("add", () => {
  it("adds a teacher with no dangling refs", () => {
    const { project, id } = addTeacher(buildBundledProject(), "Mr New");
    expect(project.teachers.find((t) => t.id === id)?.name).toBe("Mr New");
    expect(findDanglingRefs(project)).toEqual([]);
    expect(hard(project)).toBe(0);
  });

  it("adds a subject and a class with opaque, collision-free ids", () => {
    let p = buildBundledProject();
    const s = addSubject(p, "Astronomy");
    p = s.project;
    const c = addClass(p, "Class 13 Space", { band: "senior" });
    p = c.project;
    expect(s.id).not.toBe(c.id);
    expect(p.subjects.find((x) => x.id === s.id)?.name).toBe("Astronomy");
    expect(p.classes.find((x) => x.id === c.id)?.name).toBe("Class 13 Space");
    expect(findDanglingRefs(p)).toEqual([]);
  });
});

describe("rename is non-destructive (id stable, references intact)", () => {
  it("renaming a subject keeps every reference and the timetable valid", () => {
    const before = buildBundledProject();
    const refsBefore = referencesOf(before, "subject", "Maths");
    const after = renameSubject(before, "Maths", "Mathematics");
    expect(after.subjects.find((s) => s.id === "Maths")?.name).toBe("Mathematics");
    // id is unchanged, so every event/qual/requirement still resolves
    expect(referencesOf(after, "subject", "Maths").placements).toBe(refsBefore.placements);
    expect(findDanglingRefs(after)).toEqual([]);
    expect(hard(after)).toBe(0);
  });

  it("renaming a teacher and a class is also non-destructive", () => {
    let p = renameTeacher(buildBundledProject(), "Bindu", "Bindu Sharma");
    p = renameClass(p, "Class 7", "Grade 7");
    expect(p.teachers.find((t) => t.id === "Bindu")?.name).toBe("Bindu Sharma");
    expect(p.classes.find((c) => c.id === "Class 7")?.name).toBe("Grade 7");
    expect(findDanglingRefs(p)).toEqual([]);
    expect(hard(p)).toBe(0);
  });
});

describe("remove cascades with no dangling reference (the C1 guarantee)", () => {
  it("removes a class that participates in a joint event (the hard case)", () => {
    const p0 = buildBundledProject();
    // Class 11 Commerce is in a 2-class Economics joint AND a 3-class English/Hindi joint.
    const jointsWithCom = p0.events.filter(
      (e) => e.type === "joint_class" && e.classIds.includes("Class 11 Commerce"),
    );
    expect(jointsWithCom.length).toBeGreaterThan(0);

    const p = removeClass(p0, "Class 11 Commerce");
    expect(p.classes.some((c) => c.id === "Class 11 Commerce")).toBe(false);
    // No event, qual, requirement or rule still names the removed class.
    expect(findDanglingRefs(p)).toEqual([]);
    // A 2-class joint dropped to 1 class must have been demoted to a normal lesson.
    for (const e of p.events) {
      if (e.type === "joint_class") expect(e.classIds.length).toBeGreaterThanOrEqual(2);
      if (e.type === "normal") expect(e.classIds.length).toBe(1);
    }
    expect(hard(p)).toBe(0);
  });

  it("removes a primary class from the ELGA team block, keeping the block valid", () => {
    const p = removeClass(buildBundledProject(), "Class 1");
    const elga = p.events.find((e) => e.subjectId === "ELGA");
    expect(elga?.type).toBe("team_block");
    expect(elga?.classIds).not.toContain("Class 1");
    expect(elga?.classIds.length).toBeGreaterThanOrEqual(2);
    expect(findDanglingRefs(p)).toEqual([]);
    expect(hard(p)).toBe(0);
  });

  it("removes a teacher, reassigning their lessons to another teacher", () => {
    const p0 = buildBundledProject();
    const p = removeTeacher(p0, "Bindu", { reassignTo: "Anita" });
    expect(p.teachers.some((t) => t.id === "Bindu")).toBe(false);
    expect(p.events.some((e) => e.teacherIds.includes("Bindu"))).toBe(false);
    expect(findDanglingRefs(p)).toEqual([]);
  });

  it("removes a teacher without a replacement (lessons go teacher-less, no dangling)", () => {
    const p = removeTeacher(buildBundledProject(), "Bindu");
    expect(p.teachers.some((t) => t.id === "Bindu")).toBe(false);
    expect(findDanglingRefs(p)).toEqual([]);
  });

  it("removes a subject, deleting its lessons and references", () => {
    const p = removeSubject(buildBundledProject(), "Maths");
    expect(p.subjects.some((s) => s.id === "Maths")).toBe(false);
    expect(p.events.some((e) => e.subjectId === "Maths")).toBe(false);
    expect(p.qualifications.some((q) => q.subjectId === "Maths")).toBe(false);
    expect(findDanglingRefs(p)).toEqual([]);
  });
});

describe("periods", () => {
  const profileId = buildBundledProject().profiles[0]!.id;

  it("renames / re-times a slot without touching placements", () => {
    const p = editPeriod(buildBundledProject(), profileId, 1, { label: "First", start: "08:35" });
    const slot = p.profiles[0]!.slots.find((s) => s.index === 1)!;
    expect(slot.label).toBe("First");
    expect(slot.start).toBe("08:35");
    expect(hard(p)).toBe(0);
  });

  it("appends a teaching period at the end", () => {
    const before = buildBundledProject().profiles[0]!.slots.length;
    const p = addPeriod(buildBundledProject(), profileId);
    expect(p.profiles[0]!.slots.length).toBe(before + 1);
    expect(p.profiles[0]!.slots.at(-1)!.teaching).toBe(true);
    expect(hard(p)).toBe(0);
  });

  it("removes a period, dropping placements on it and unavailability for it", () => {
    const p = removePeriod(buildBundledProject(), profileId, 9); // P8 (highest teaching slot)
    expect(p.profiles[0]!.slots.some((s) => s.index === 9)).toBe(false);
    expect(activeTT(p).placements.some((pl) => pl.slot === 9)).toBe(false);
    expect(p.teachers.every((t) => t.unavailable.every((u) => u.slot !== 9))).toBe(true);
    expect(hard(p)).toBe(0);
  });
});
