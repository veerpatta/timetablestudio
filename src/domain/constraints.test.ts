import { describe, expect, it } from "vitest";
import { buildBundledProject } from "../fixtures/bundled";
import { fill } from "../solver/fill";
import { setClassTeacher } from "./assign";
import { constraintSentence, evaluateConstraints, localMustForbids, localViolates } from "./constraints";
import { findProfile } from "./derive";
import { placeNormalLesson } from "./edit";
import { teachingSlots } from "./profile";
import { validate } from "./validate";
import type { Constraint, Project } from "./types";

const ttOf = (p: Project) => p.timetables.find((t) => t.id === p.activeTimetableId)!;
const withConstraints = (p: Project, ...cs: Constraint[]): Project => ({ ...p, constraints: [...p.constraints, ...cs] });

const halfMaths7 = (severity: Constraint["severity"] = "must"): Constraint => ({
  id: "c-half", scope: "subject", severity, weight: 5, enabled: true,
  template: "subject_half_of_day", params: { subjectIds: ["Maths"], classIds: ["Class 7"], half: "first" },
});

describe("subject_half_of_day — the C3 gate (a constraint that changes nothing is a bug)", () => {
  it("flags the exact afternoon cell, with a plain (no-code) message", () => {
    const base = buildBundledProject();
    const tt = ttOf(base);
    const profile = findProfile(base, tt)!;
    const afternoon = teachingSlots(profile).slice(Math.ceil(teachingSlots(profile).length / 2))[0]!; // first 2nd-half slot
    const mathsTeacher = base.qualifications.find((q) => q.subjectId === "Maths" && q.classId === "Class 7")!.teacherId;

    // Put a Maths lesson for Class 7 in an afternoon slot, then turn the constraint on.
    const placed = placeNormalLesson(base, tt.id, "Class 7", "Mon", afternoon, "Maths", [mathsTeacher]);
    const p = withConstraints(placed, halfMaths7());

    const vios = validate(p, ttOf(p)).filter((v) => v.constraintId === "subject_half_of_day");
    expect(vios.length).toBeGreaterThan(0);
    const v = vios.find((x) => x.slots.some((s) => s.classId === "Class 7" && s.day === "Mon" && s.slot === afternoon))!;
    expect(v).toBeDefined();
    expect(v.severity).toBe("hard");
    expect(v.message).not.toMatch(/HE\d|R\d|subject_half_of_day/); // no codes on the surface

    // Disabling it clears the flag.
    const disabled = { ...p, constraints: p.constraints.map((c) => ({ ...c, enabled: false })) };
    expect(validate(disabled, ttOf(disabled)).filter((x) => x.constraintId === "subject_half_of_day")).toEqual([]);
  });

  it("satisfied instance produces no violation (Maths in the morning)", () => {
    const base = buildBundledProject();
    const tt = ttOf(base);
    const morning = teachingSlots(findProfile(base, tt)!)[0]!;
    const mathsTeacher = base.qualifications.find((q) => q.subjectId === "Maths" && q.classId === "Class 7")!.teacherId;
    const placed = placeNormalLesson(base, tt.id, "Class 7", "Mon", morning, "Maths", [mathsTeacher]);
    const p = withConstraints(placed, halfMaths7());
    expect(evaluateConstraints(p, ttOf(p)).filter((v) => v.constraintId === "subject_half_of_day" && v.slots.some((s) => s.day === "Mon"))).toEqual([]);
  });

  it("fill respects it — no Maths lands in a Class 7 afternoon slot", () => {
    const base = buildBundledProject();
    const tt = ttOf(base);
    const profile = findProfile(base, tt)!;
    const secondHalf = new Set(teachingSlots(profile).slice(Math.ceil(teachingSlots(profile).length / 2)));
    const eventIndex = new Map(base.events.map((e) => [e.id, e]));
    // Empty Class 7 entirely → full shortfall, holes in every slot.
    const cleared: Project = {
      ...base,
      timetables: base.timetables.map((t) =>
        t.id === tt.id ? { ...t, placements: t.placements.filter((p) => !eventIndex.get(p.eventId)?.classIds.includes("Class 7")) } : t,
      ),
    };

    const free = fill(cleared, tt.id, { seed: 1 });
    const constrained = fill(withConstraints(cleared, halfMaths7()), tt.id, { seed: 1 });

    const maths7 = (r: typeof free) => r.added.filter((a) => a.classId === "Class 7" && a.subjectId === "Maths");
    expect(maths7(free).length).toBeGreaterThan(0); // fill DOES place Maths (non-vacuous)
    expect(maths7(constrained).length).toBeGreaterThan(0); // still placed (in the morning)
    expect(maths7(constrained).every((a) => !secondHalf.has(a.slot))).toBe(true); // never an afternoon slot
  });
});

describe("teacher_max_per_week — aggregate template", () => {
  const cap = (teacherId: string, max: number): Constraint => ({
    id: "c-cap", scope: "teacher", severity: "must", weight: 5, enabled: true,
    template: "teacher_max_per_week", params: { teacherId, max },
  });

  it("flags a teacher over the weekly cap with a plain message", () => {
    const base = buildBundledProject();
    // Bindu is a busy primary teacher; cap her low to force a violation.
    const p = withConstraints(base, cap("Bindu", 5));
    const vios = evaluateConstraints(p, ttOf(p)).filter((v) => v.constraintId === "teacher_max_per_week");
    expect(vios.length).toBe(1);
    expect(vios[0]!.message).toMatch(/Bindu/);
    expect(vios[0]!.message).not.toMatch(/teacher_max_per_week/);
  });

  it("is aggregate — fill does NOT pre-respect it (localViolates is null)", () => {
    const base = buildBundledProject();
    const profile = findProfile(base, ttOf(base))!;
    const c = cap("Bindu", 5);
    expect(localViolates(c, profile, { classId: "Class 1", subjectId: "Maths", teacherIds: ["Bindu"], day: "Mon", slot: 1 })).toBeNull();
    expect(localMustForbids(withConstraints(base, c), profile, { classId: "Class 1", subjectId: "Maths", teacherIds: ["Bindu"], day: "Mon", slot: 1 })).toBe(false);
  });

  it("satisfied when under the cap", () => {
    const base = buildBundledProject();
    const p = withConstraints(base, cap("Bindu", 100));
    expect(evaluateConstraints(p, ttOf(p)).filter((v) => v.constraintId === "teacher_max_per_week")).toEqual([]);
  });
});

describe("class_teacher_p1 — reads classTeacherId", () => {
  const ctp1 = (classId: string): Constraint => ({
    id: "c-p1", scope: "class", severity: "prefer", weight: 3, enabled: true,
    template: "class_teacher_p1", params: { classId },
  });

  it("is a no-op until a class teacher is set, then it flags days", () => {
    const base = withConstraints(buildBundledProject(), ctp1("Class 7"));
    expect(evaluateConstraints(base, ttOf(base)).filter((v) => v.constraintId === "class_teacher_p1")).toEqual([]);
    const withCt = setClassTeacher(base, "Class 7", "Bindu");
    expect(evaluateConstraints(withCt, ttOf(withCt)).filter((v) => v.constraintId === "class_teacher_p1").length).toBeGreaterThan(0);
  });
});

describe("constraintSentence — plain language, names entities", () => {
  it("renders each template as a readable sentence", () => {
    const p = buildBundledProject();
    expect(constraintSentence(p, halfMaths7())).toContain("Maths");
    expect(constraintSentence(p, halfMaths7())).toContain("first half");
  });
});
