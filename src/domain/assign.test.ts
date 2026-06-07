import { describe, expect, it } from "vitest";
import { addSubject, addTeacher } from "./entityEdit";
import { addQualification, isQualified, removeQualification, setClassTeacher } from "./assign";
import { legalOptions } from "./legalMoves";
import { evaluateRules } from "./rules";
import { buildBundledProject } from "../fixtures/bundled";
import type { R4Rule } from "./types";

const activeTT = (p: ReturnType<typeof buildBundledProject>) => p.timetables.find((t) => t.id === p.activeTimetableId)!;
const r4Count = (p: ReturnType<typeof buildBundledProject>) =>
  evaluateRules(p, activeTT(p)).filter((v) => v.constraintId === "R4").length;

describe("qualifications drive the cell picker (C2 AC)", () => {
  it("adding a qualification makes the picker offer that teacher+subject", () => {
    // a fresh teacher (free everywhere) + subject, not yet qualified for Class 1
    let p = buildBundledProject();
    const t = addTeacher(p, "Newt");
    p = t.project;
    const s = addSubject(p, "Newsub");
    p = s.project;
    const ttId = p.activeTimetableId!;

    const has = (proj: typeof p) =>
      legalOptions(proj, ttId, "Class 1", "Mon", 1).some(
        (o) => o.subjectId === s.id && o.teacherIds.includes(t.id),
      );

    expect(has(p)).toBe(false); // no qualification yet → not offered
    const qualified = addQualification(p, t.id, s.id, "Class 1");
    expect(isQualified(qualified, t.id, s.id, "Class 1")).toBe(true);
    expect(has(qualified)).toBe(true); // now offered

    const removed = removeQualification(qualified, t.id, s.id, "Class 1");
    expect(has(removed)).toBe(false); // removed again → no longer offered
  });
});

describe("class teacher enables the 'takes period 1 daily' constraint (C2 AC)", () => {
  const r4 = (classId: string): R4Rule => ({ id: `R4:${classId}`, template: "R4", classId, enabled: true, severity: "prefer", weight: 3 });

  it("the R4 rule is a no-op until a class teacher is set, then it applies", () => {
    const base = buildBundledProject();
    const withRule = { ...base, rules: [...base.rules, r4("Class 7")] };
    expect(r4Count(withRule)).toBe(0); // no class teacher → nothing to check

    const withTeacher = setClassTeacher(withRule, "Class 7", "Bindu");
    expect(withTeacher.classes.find((c) => c.id === "Class 7")?.classTeacherId).toBe("Bindu");
    // Bindu (a primary teacher) never takes Class 7's first period → every day flags
    expect(r4Count(withTeacher)).toBeGreaterThan(0);
  });

  it("clearing the class teacher disables the constraint again", () => {
    let p = setClassTeacher(buildBundledProject(), "Class 7", "Bindu");
    p = { ...p, rules: [...p.rules, r4("Class 7")] };
    expect(r4Count(p)).toBeGreaterThan(0);
    const cleared = setClassTeacher(p, "Class 7", undefined);
    expect(cleared.classes.find((c) => c.id === "Class 7")?.classTeacherId).toBeUndefined();
    expect(r4Count(cleared)).toBe(0);
  });
});
