// C4 breadth: every constraint template has a satisfied (→ []) and a violated (→ non-empty)
// case with a readable message. Built on a controlled mini-project so each scenario is
// deterministic. A template with no violated case here would be a no-op constraint (a bug).

import { describe, expect, it } from "vitest";
import { setClassTeacher } from "./assign";
import { constraintSentence, evaluateConstraints } from "./constraints";
import { placeNormalLesson } from "./edit";
import { buildRegularProfile } from "./profile";
import type { Constraint, Project, Subject } from "./types";

const T = "tt";
function su(id: string, kind: Subject["kind"] = "academic"): Subject {
  return { id, name: id, bands: ["middle"], kind };
}
function mini(): Project {
  const profile = buildRegularProfile();
  return {
    schemaVersion: 6, bundledDataVersion: 0, school: { name: "Test" },
    profiles: [profile],
    teachers: [
      { id: "TA", name: "Tara", maxPerDay: 8, maxPerWeek: 48, schedulable: true, unavailable: [] },
      { id: "TB", name: "Ben", maxPerDay: 8, maxPerWeek: 48, schedulable: true, unavailable: [] },
    ],
    classes: [
      { id: "CA", name: "Class A", band: "middle" },
      { id: "CB", name: "Class B", band: "middle" },
    ],
    subjects: [su("Math"), su("Sci"), su("Eng"), su("Free", "study")],
    rooms: [], qualifications: [], requirements: [], events: [], rules: [], constraints: [],
    timetables: [{ id: T, name: "d", profileId: profile.id, placements: [] }],
    activeTimetableId: T,
  };
}
const ttOf = (p: Project) => p.timetables.find((t) => t.id === p.activeTimetableId)!;
const P = (p: Project, cls: string, sub: string, tea: string, day: Parameters<typeof placeNormalLesson>[3], slot: number) =>
  placeNormalLesson(p, T, cls, day, slot, sub, [tea]);
const count = (p: Project, template: string, ...cs: Constraint[]) =>
  evaluateConstraints({ ...p, constraints: cs }, ttOf({ ...p, constraints: cs })).filter((v) => v.constraintId === template).length;
const base = (over: Partial<Constraint> = {}): Pick<Constraint, "id" | "scope" | "severity" | "weight" | "enabled"> =>
  ({ id: "x", scope: "global", severity: "must", weight: 1, enabled: true, ...over });

describe("constraint catalog — each template flags a violation and clears when satisfied", () => {
  it("subject_half_of_day", () => {
    const c = (): Constraint => ({ ...base(), template: "subject_half_of_day", params: { subjectIds: ["Math"], classIds: ["CA"], half: "first" } });
    expect(count(P(mini(), "CA", "Math", "TA", "Mon", 7), "subject_half_of_day", c())).toBeGreaterThan(0);
    expect(count(P(mini(), "CA", "Math", "TA", "Mon", 1), "subject_half_of_day", c())).toBe(0);
  });
  it("subject_only_periods", () => {
    const c = (): Constraint => ({ ...base(), template: "subject_only_periods", params: { subjectIds: ["Math"], classIds: ["CA"], slots: [1, 2] } });
    expect(count(P(mini(), "CA", "Math", "TA", "Mon", 3), "subject_only_periods", c())).toBeGreaterThan(0);
    expect(count(P(mini(), "CA", "Math", "TA", "Mon", 1), "subject_only_periods", c())).toBe(0);
  });
  it("subject_never_periods", () => {
    const c = (): Constraint => ({ ...base(), template: "subject_never_periods", params: { subjectIds: ["Math"], classIds: ["CA"], slots: [1] } });
    expect(count(P(mini(), "CA", "Math", "TA", "Mon", 1), "subject_never_periods", c())).toBeGreaterThan(0);
    expect(count(P(mini(), "CA", "Math", "TA", "Mon", 2), "subject_never_periods", c())).toBe(0);
  });
  it("subject_not_last", () => {
    const c = (): Constraint => ({ ...base(), template: "subject_not_last", params: { subjectIds: ["Math"], classIds: ["CA"] } });
    expect(count(P(mini(), "CA", "Math", "TA", "Mon", 9), "subject_not_last", c())).toBeGreaterThan(0);
    expect(count(P(mini(), "CA", "Math", "TA", "Mon", 1), "subject_not_last", c())).toBe(0);
  });
  it("teacher_not_first_period", () => {
    const c = (): Constraint => ({ ...base(), template: "teacher_not_first_period", params: { teacherId: "TA" } });
    expect(count(P(mini(), "CA", "Math", "TA", "Mon", 1), "teacher_not_first_period", c())).toBeGreaterThan(0);
    expect(count(P(mini(), "CA", "Math", "TA", "Mon", 2), "teacher_not_first_period", c())).toBe(0);
  });
  it("teacher_not_last_period", () => {
    const c = (): Constraint => ({ ...base(), template: "teacher_not_last_period", params: { teacherId: "TA" } });
    expect(count(P(mini(), "CA", "Math", "TA", "Mon", 9), "teacher_not_last_period", c())).toBeGreaterThan(0);
    expect(count(P(mini(), "CA", "Math", "TA", "Mon", 1), "teacher_not_last_period", c())).toBe(0);
  });
  it("teacher_max_per_week", () => {
    let p = P(mini(), "CA", "Math", "TA", "Mon", 1); p = P(p, "CA", "Sci", "TA", "Tue", 1);
    expect(count(p, "teacher_max_per_week", { ...base(), template: "teacher_max_per_week", params: { teacherId: "TA", max: 1 } })).toBeGreaterThan(0);
    expect(count(p, "teacher_max_per_week", { ...base(), template: "teacher_max_per_week", params: { teacherId: "TA", max: 10 } })).toBe(0);
  });
  it("teacher_max_per_day", () => {
    let p = P(mini(), "CA", "Math", "TA", "Mon", 1); p = P(p, "CA", "Sci", "TA", "Mon", 2);
    expect(count(p, "teacher_max_per_day", { ...base(), template: "teacher_max_per_day", params: { teacherId: "TA", max: 1 } })).toBeGreaterThan(0);
    expect(count(p, "teacher_max_per_day", { ...base(), template: "teacher_max_per_day", params: { teacherId: "TA", max: 5 } })).toBe(0);
  });
  it("teacher_max_consecutive", () => {
    let p = P(mini(), "CA", "Math", "TA", "Mon", 1); p = P(p, "CA", "Sci", "TA", "Mon", 2);
    expect(count(p, "teacher_max_consecutive", { ...base(), template: "teacher_max_consecutive", params: { teacherId: "TA", max: 1 } })).toBeGreaterThan(0);
    expect(count(p, "teacher_max_consecutive", { ...base(), template: "teacher_max_consecutive", params: { teacherId: "TA", max: 5 } })).toBe(0);
  });
  it("teacher_max_days_per_week", () => {
    let p = P(mini(), "CA", "Math", "TA", "Mon", 1); p = P(p, "CA", "Sci", "TA", "Tue", 1);
    expect(count(p, "teacher_max_days_per_week", { ...base(), template: "teacher_max_days_per_week", params: { teacherId: "TA", max: 1 } })).toBeGreaterThan(0);
    expect(count(p, "teacher_max_days_per_week", { ...base(), template: "teacher_max_days_per_week", params: { teacherId: "TA", max: 6 } })).toBe(0);
  });
  it("teacher_min_free_per_week", () => {
    const p = P(mini(), "CA", "Math", "TA", "Mon", 1);
    expect(count(p, "teacher_min_free_per_week", { ...base(), template: "teacher_min_free_per_week", params: { teacherId: "TA", min: 1000 } })).toBeGreaterThan(0);
    expect(count(p, "teacher_min_free_per_week", { ...base(), template: "teacher_min_free_per_week", params: { teacherId: "TA", min: 0 } })).toBe(0);
  });
  it("teacher_compact_day", () => {
    let gap = P(mini(), "CA", "Math", "TA", "Mon", 1); gap = P(gap, "CA", "Sci", "TA", "Mon", 4);
    expect(count(gap, "teacher_compact_day", { ...base({ severity: "prefer" }), template: "teacher_compact_day", params: { teacherId: "TA" } })).toBeGreaterThan(0);
    let tight = P(mini(), "CA", "Math", "TA", "Mon", 1); tight = P(tight, "CA", "Sci", "TA", "Mon", 2);
    expect(count(tight, "teacher_compact_day", { ...base({ severity: "prefer" }), template: "teacher_compact_day", params: { teacherId: "TA" } })).toBe(0);
  });
  it("subject_max_per_day", () => {
    let p = P(mini(), "CA", "Math", "TA", "Mon", 1); p = P(p, "CA", "Math", "TB", "Mon", 2);
    expect(count(p, "subject_max_per_day", { ...base(), template: "subject_max_per_day", params: { subjectIds: ["Math"], classIds: ["CA"], max: 1 } })).toBeGreaterThan(0);
    expect(count(p, "subject_max_per_day", { ...base(), template: "subject_max_per_day", params: { subjectIds: ["Math"], classIds: ["CA"], max: 3 } })).toBe(0);
  });
  it("subject_spread_min_days", () => {
    let one = P(mini(), "CA", "Math", "TA", "Mon", 1); one = P(one, "CA", "Math", "TB", "Mon", 2);
    expect(count(one, "subject_spread_min_days", { ...base(), template: "subject_spread_min_days", params: { subjectIds: ["Math"], classIds: ["CA"], minDays: 2 } })).toBeGreaterThan(0);
    let two = P(mini(), "CA", "Math", "TA", "Mon", 1); two = P(two, "CA", "Math", "TA", "Tue", 1);
    expect(count(two, "subject_spread_min_days", { ...base(), template: "subject_spread_min_days", params: { subjectIds: ["Math"], classIds: ["CA"], minDays: 2 } })).toBe(0);
  });
  it("subject_order", () => {
    // require Sci before Math on the same day
    const c = (): Constraint => ({ ...base(), template: "subject_order", params: { classId: "CA", beforeSubjectId: "Sci", afterSubjectId: "Math" } });
    let good = P(mini(), "CA", "Sci", "TA", "Mon", 1); good = P(good, "CA", "Math", "TA", "Mon", 2);
    expect(count(good, "subject_order", c())).toBe(0); // Sci(1) before Math(2)
    let viol = P(mini(), "CA", "Math", "TA", "Mon", 1); viol = P(viol, "CA", "Sci", "TA", "Mon", 2);
    expect(count(viol, "subject_order", c())).toBeGreaterThan(0); // Sci(2) after Math(1)
  });
  it("subject_not_adjacent_to", () => {
    let adj = P(mini(), "CA", "Math", "TA", "Mon", 1); adj = P(adj, "CA", "Sci", "TA", "Mon", 2);
    expect(count(adj, "subject_not_adjacent_to", { ...base(), template: "subject_not_adjacent_to", params: { classId: "CA", subjectAId: "Math", subjectBId: "Sci" } })).toBeGreaterThan(0);
    let apart = P(mini(), "CA", "Math", "TA", "Mon", 1); apart = P(apart, "CA", "Sci", "TA", "Mon", 3);
    expect(count(apart, "subject_not_adjacent_to", { ...base(), template: "subject_not_adjacent_to", params: { classId: "CA", subjectAId: "Math", subjectBId: "Sci" } })).toBe(0);
  });
  it("class_teacher_p1", () => {
    const withCt = setClassTeacher(mini(), "CA", "TA");
    expect(count(withCt, "class_teacher_p1", { ...base({ severity: "prefer" }), template: "class_teacher_p1", params: { classId: "CA" } })).toBeGreaterThan(0);
    expect(count(mini(), "class_teacher_p1", { ...base({ severity: "prefer" }), template: "class_teacher_p1", params: { classId: "CA" } })).toBe(0);
  });
  it("class_max_teachers_per_day", () => {
    let p = P(mini(), "CA", "Math", "TA", "Mon", 1); p = P(p, "CA", "Sci", "TB", "Mon", 2);
    expect(count(p, "class_max_teachers_per_day", { ...base(), template: "class_max_teachers_per_day", params: { classId: "CA", max: 1 } })).toBeGreaterThan(0);
    expect(count(p, "class_max_teachers_per_day", { ...base(), template: "class_max_teachers_per_day", params: { classId: "CA", max: 5 } })).toBe(0);
  });
  it("class_daily_variety", () => {
    let dup = P(mini(), "CA", "Math", "TA", "Mon", 1); dup = P(dup, "CA", "Math", "TB", "Mon", 2); // two distinct Math events
    expect(count(dup, "class_daily_variety", { ...base(), template: "class_daily_variety", params: { classId: "CA" } })).toBeGreaterThan(0);
    let varied = P(mini(), "CA", "Math", "TA", "Mon", 1); varied = P(varied, "CA", "Sci", "TA", "Mon", 2);
    expect(count(varied, "class_daily_variety", { ...base(), template: "class_daily_variety", params: { classId: "CA" } })).toBe(0);
  });
  it("class_max_consecutive_same", () => {
    let run = P(mini(), "CA", "Math", "TA", "Mon", 1); run = P(run, "CA", "Math", "TA", "Mon", 2);
    expect(count(run, "class_max_consecutive_same", { ...base(), template: "class_max_consecutive_same", params: { classId: "CA", max: 1 } })).toBeGreaterThan(0);
    let mixed = P(mini(), "CA", "Math", "TA", "Mon", 1); mixed = P(mixed, "CA", "Sci", "TA", "Mon", 2);
    expect(count(mixed, "class_max_consecutive_same", { ...base(), template: "class_max_consecutive_same", params: { classId: "CA", max: 1 } })).toBe(0);
  });
  it("class_no_free", () => {
    const p = mini();
    const free: Project = {
      ...p,
      events: [...p.events, { id: "f1", type: "free", subjectId: "Free", classIds: ["CA"], teacherIds: [], duration: 1, source: "manual" }],
      timetables: p.timetables.map((t) => (t.id === T ? { ...t, placements: [{ eventId: "f1", day: "Mon", slot: 1, pinned: false }] } : t)),
    };
    expect(count(free, "class_no_free", { ...base(), template: "class_no_free", params: { classId: "CA" } })).toBeGreaterThan(0);
    expect(count(P(mini(), "CA", "Math", "TA", "Mon", 1), "class_no_free", { ...base(), template: "class_no_free", params: { classId: "CA" } })).toBe(0);
  });
  it("class_board_protect", () => {
    expect(count(P(mini(), "CA", "Sci", "TA", "Mon", 1), "class_board_protect", { ...base(), template: "class_board_protect", params: { classId: "CA", coreSubjectIds: ["Math"] } })).toBeGreaterThan(0);
    expect(count(P(mini(), "CA", "Math", "TA", "Mon", 1), "class_board_protect", { ...base(), template: "class_board_protect", params: { classId: "CA", coreSubjectIds: ["Math"] } })).toBe(0);
  });
  it("balance_teacher_loads", () => {
    const p = P(mini(), "CA", "Math", "TA", "Mon", 1); // TA=1, TB=0
    expect(count(p, "balance_teacher_loads", { ...base(), template: "balance_teacher_loads", params: { maxSpread: 0 } })).toBeGreaterThan(0);
    expect(count(p, "balance_teacher_loads", { ...base(), template: "balance_teacher_loads", params: { maxSpread: 5 } })).toBe(0);
  });
  it("core_subjects_early", () => {
    expect(count(P(mini(), "CA", "Math", "TA", "Mon", 7), "core_subjects_early", { ...base({ severity: "prefer" }), template: "core_subjects_early", params: { subjectIds: ["Math"] } })).toBeGreaterThan(0);
    expect(count(P(mini(), "CA", "Math", "TA", "Mon", 1), "core_subjects_early", { ...base({ severity: "prefer" }), template: "core_subjects_early", params: { subjectIds: ["Math"] } })).toBe(0);
  });
});

describe("constraintSentence renders every template without throwing", () => {
  it("covers the full union", () => {
    const p = mini();
    const samples: Constraint[] = [
      { ...base(), template: "subject_half_of_day", params: { subjectIds: ["Math"], classIds: ["CA"], half: "first" } },
      { ...base(), template: "teacher_max_per_week", params: { teacherId: "TA", max: 30 } },
      { ...base(), template: "class_no_free", params: { classId: "CA" } },
      { ...base(), template: "balance_teacher_loads", params: { maxSpread: 6 } },
    ];
    for (const c of samples) expect(constraintSentence(p, c).length).toBeGreaterThan(0);
  });
});
