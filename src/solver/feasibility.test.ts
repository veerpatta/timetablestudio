import { describe, expect, it } from "vitest";
import type { Constraint, Project, Requirement, TimetableEvent } from "../domain/types";
import { makeMiniSchool } from "../fixtures/synthetic";
import { analyzeFeasibility } from "./feasibility";

function withRequirements(project: Project, requirements: Requirement[]): Project {
  return { ...project, requirements };
}

describe("analyzeFeasibility", () => {
  it("blocks a required subject when no qualified teacher can teach it", () => {
    const project = withRequirements(
      { ...makeMiniSchool(), qualifications: [] },
      [{ id: "req-c1-maths", classId: "c1", subjectId: "Maths", teacherIds: [], periodsPerWeek: 1 }],
    );

    const report = analyzeFeasibility(project, "tt");

    expect(report.status).toBe("blocked");
    expect(report.blockers.join(" ")).toMatch(/qualified/i);
    expect(report.relaxationSuggestions.join(" ")).toMatch(/teacher/i);
  });

  it("blocks class demand that exceeds the available teaching slots", () => {
    const project = withRequirements(makeMiniSchool(), [
      { id: "req-too-many", classId: "c1", subjectId: "Maths", teacherIds: ["mMaths"], periodsPerWeek: 49 },
    ]);

    const report = analyzeFeasibility(project, "tt");

    expect(report.status).toBe("blocked");
    expect(report.blockers.join(" ")).toMatch(/Class 1/i);
    expect(report.blockers.join(" ")).toMatch(/49/i);
  });

  it("blocks a must-rule that is violated by a locked lesson", () => {
    const event: TimetableEvent = {
      id: "evt-locked-maths",
      type: "normal",
      subjectId: "Maths",
      classIds: ["c1"],
      teacherIds: ["mMaths"],
      duration: 1,
      source: "imported",
    };
    const mustFirstHalf: Constraint = {
      id: "must-first-half",
      scope: "subject",
      severity: "must",
      weight: 1,
      enabled: true,
      template: "subject_half_of_day",
      params: { subjectIds: ["Maths"], classIds: ["c1"], half: "first" },
    };
    const project: Project = {
      ...makeMiniSchool(),
      constraints: [mustFirstHalf],
      requirements: [{ id: "req-c1-maths", classId: "c1", subjectId: "Maths", teacherIds: ["mMaths"], periodsPerWeek: 1 }],
      events: [...makeMiniSchool().events, event],
      timetables: [{ id: "tt", name: "Draft", profileId: makeMiniSchool().profiles[0]!.id, placements: [{ eventId: event.id, day: "Mon", slot: 9, pinned: true }] }],
    };

    const report = analyzeFeasibility(project, "tt");

    expect(report.status).toBe("blocked");
    expect(report.blockers.join(" ")).toMatch(/locked/i);
    expect(report.relaxationSuggestions.join(" ")).toMatch(/Unlock/i);
  });
});

// --- Structured blockers: 2 cases (satisfied + blocked) per check, plus apply round-trips ---

describe("structuredBlockers — subject_capacity", () => {
  it("satisfied when all requirements have a qualified teacher", () => {
    const project = withRequirements(makeMiniSchool(), [
      { id: "r1", classId: "c1", subjectId: "Maths", teacherIds: ["mMaths"], periodsPerWeek: 2 },
    ]);
    const report = analyzeFeasibility(project, "tt");
    expect(report.structuredBlockers?.some((b) => b.kind === "subject_capacity")).toBe(false);
  });

  it("blocked — names the subject and class in the message", () => {
    const project: Project = {
      ...makeMiniSchool(),
      qualifications: [],
      requirements: [{ id: "r1", classId: "c1", subjectId: "Maths", teacherIds: [], periodsPerWeek: 1 }],
    };
    const report = analyzeFeasibility(project, "tt");
    const b = report.structuredBlockers?.find((x) => x.kind === "subject_capacity");
    expect(b).toBeDefined();
    expect(b!.message).toMatch(/Maths/);
    expect(b!.message).toMatch(/Class 1/);
  });
});

describe("structuredBlockers — class_capacity", () => {
  it("satisfied when demand fits within the week", () => {
    const project = withRequirements(makeMiniSchool(), [
      { id: "r1", classId: "c1", subjectId: "Maths", teacherIds: ["mMaths"], periodsPerWeek: 5 },
    ]);
    const report = analyzeFeasibility(project, "tt");
    expect(report.structuredBlockers?.some((b) => b.kind === "class_capacity")).toBe(false);
  });

  it("blocked — names the class and exact demand count", () => {
    const project = withRequirements(makeMiniSchool(), [
      { id: "r1", classId: "c1", subjectId: "Maths", teacherIds: ["mMaths"], periodsPerWeek: 49 },
    ]);
    const report = analyzeFeasibility(project, "tt");
    const b = report.structuredBlockers?.find((x) => x.kind === "class_capacity");
    expect(b).toBeDefined();
    expect(b!.message).toMatch(/Class 1/);
    expect(b!.message).toMatch(/49/);
  });
});

describe("structuredBlockers — teacher_capacity", () => {
  // Nidhika (mMaths) qualifies for Maths × c1 and Maths × c2; maxPerWeek = 48.
  it("satisfied when sole-qualifier demand does not exceed maxPerWeek", () => {
    const project = withRequirements(makeMiniSchool(), [
      { id: "r1", classId: "c1", subjectId: "Maths", teacherIds: ["mMaths"], periodsPerWeek: 5 },
    ]);
    const report = analyzeFeasibility(project, "tt");
    expect(report.structuredBlockers?.some((b) => b.kind === "teacher_capacity")).toBe(false);
  });

  it("blocked — names Nidhika and the exact forced-demand total", () => {
    // 30 + 20 = 50 forced periods > 48 maxPerWeek
    const project = withRequirements(makeMiniSchool(), [
      { id: "r1", classId: "c1", subjectId: "Maths", teacherIds: ["mMaths"], periodsPerWeek: 30 },
      { id: "r2", classId: "c2", subjectId: "Maths", teacherIds: ["mMaths"], periodsPerWeek: 20 },
    ]);
    const report = analyzeFeasibility(project, "tt");
    const b = report.structuredBlockers?.find((x) => x.kind === "teacher_capacity");
    expect(b).toBeDefined();
    expect(b!.message).toMatch(/Nidhika/);
    expect(b!.message).toMatch(/50/);
  });
});

describe("structuredBlockers — slot_contention", () => {
  // Regular profile: 6 days × 8 teaching slots = 48 slots per week.
  const onlySlot1: Constraint = {
    id: "only-slot1",
    scope: "subject",
    severity: "must",
    weight: 1,
    enabled: true,
    template: "subject_only_periods",
    params: { subjectIds: ["Maths"], classIds: ["c1"], slots: [1] },
  };

  it("satisfied when the allowed slots can fit all periods", () => {
    // 1 slot × 6 days = 6 available; need 5 — fine.
    const project: Project = {
      ...makeMiniSchool(),
      constraints: [onlySlot1],
      requirements: [{ id: "r1", classId: "c1", subjectId: "Maths", teacherIds: ["mMaths"], periodsPerWeek: 5 }],
    };
    const report = analyzeFeasibility(project, "tt");
    expect(report.structuredBlockers?.some((b) => b.kind === "slot_contention")).toBe(false);
  });

  it("blocked — names subject, class, exact need, and exact available count", () => {
    // 1 slot × 6 days = 6 available; need 7 — blocked.
    const project: Project = {
      ...makeMiniSchool(),
      constraints: [onlySlot1],
      requirements: [{ id: "r1", classId: "c1", subjectId: "Maths", teacherIds: ["mMaths"], periodsPerWeek: 7 }],
    };
    const report = analyzeFeasibility(project, "tt");
    const b = report.structuredBlockers?.find((x) => x.kind === "slot_contention");
    expect(b).toBeDefined();
    expect(b!.message).toMatch(/Maths/);
    expect(b!.message).toMatch(/Class 1/);
    expect(b!.message).toMatch(/7/);
    expect(b!.message).toMatch(/6/);
  });
});

describe("structuredBlockers — locked_conflict", () => {
  const lockedEvent: TimetableEvent = {
    id: "evt-locked",
    type: "normal",
    subjectId: "Maths",
    classIds: ["c1"],
    teacherIds: ["mMaths"],
    duration: 1,
    source: "imported",
  };

  it("satisfied when a pinned event does not violate any hard constraint", () => {
    // Pinned to slot 1 (first half) with no constraint — no conflict.
    const project: Project = {
      ...makeMiniSchool(),
      events: [...makeMiniSchool().events, lockedEvent],
      requirements: [{ id: "r1", classId: "c1", subjectId: "Maths", teacherIds: ["mMaths"], periodsPerWeek: 1 }],
      timetables: [{ id: "tt", name: "Draft", profileId: makeMiniSchool().profiles[0]!.id, placements: [{ eventId: "evt-locked", day: "Mon", slot: 1, pinned: true }] }],
    };
    const report = analyzeFeasibility(project, "tt");
    expect(report.structuredBlockers?.some((b) => b.kind === "locked_conflict")).toBe(false);
  });

  it("blocked — message mentions locked and the violated rule", () => {
    const mustFirstHalf: Constraint = {
      id: "must-first-half",
      scope: "subject",
      severity: "must",
      weight: 1,
      enabled: true,
      template: "subject_half_of_day",
      params: { subjectIds: ["Maths"], classIds: ["c1"], half: "first" },
    };
    // Slot 9 is in the second half — violates the must-first-half constraint.
    const project: Project = {
      ...makeMiniSchool(),
      constraints: [mustFirstHalf],
      requirements: [{ id: "r1", classId: "c1", subjectId: "Maths", teacherIds: ["mMaths"], periodsPerWeek: 1 }],
      events: [...makeMiniSchool().events, lockedEvent],
      timetables: [{ id: "tt", name: "Draft", profileId: makeMiniSchool().profiles[0]!.id, placements: [{ eventId: "evt-locked", day: "Mon", slot: 9, pinned: true }] }],
    };
    const report = analyzeFeasibility(project, "tt");
    const b = report.structuredBlockers?.find((x) => x.kind === "locked_conflict");
    expect(b).toBeDefined();
    expect(b!.message).toMatch(/locked/i);
  });
});

describe("structuredBlockers — cap_sum", () => {
  // cap_sum fires when a teacher_max_per_week MUST constraint cap < sole-qualifier demand.
  it("satisfied when the must cap exceeds forced demand", () => {
    const project: Project = {
      ...makeMiniSchool(),
      constraints: [{ id: "cap1", scope: "teacher", severity: "must", weight: 1, enabled: true, template: "teacher_max_per_week", params: { teacherId: "mMaths", max: 30 } }],
      requirements: [{ id: "r1", classId: "c1", subjectId: "Maths", teacherIds: ["mMaths"], periodsPerWeek: 5 }],
    };
    const report = analyzeFeasibility(project, "tt");
    expect(report.structuredBlockers?.some((b) => b.kind === "cap_sum")).toBe(false);
  });

  it("blocked — names Nidhika, the forced total, and the cap", () => {
    // 15 + 10 = 25 forced > cap 20
    const project: Project = {
      ...makeMiniSchool(),
      constraints: [{ id: "cap1", scope: "teacher", severity: "must", weight: 1, enabled: true, template: "teacher_max_per_week", params: { teacherId: "mMaths", max: 20 } }],
      requirements: [
        { id: "r1", classId: "c1", subjectId: "Maths", teacherIds: ["mMaths"], periodsPerWeek: 15 },
        { id: "r2", classId: "c2", subjectId: "Maths", teacherIds: ["mMaths"], periodsPerWeek: 10 },
      ],
    };
    const report = analyzeFeasibility(project, "tt");
    const b = report.structuredBlockers?.find((x) => x.kind === "cap_sum");
    expect(b).toBeDefined();
    expect(b!.message).toMatch(/Nidhika/);
    expect(b!.message).toMatch(/25/);
    expect(b!.message).toMatch(/20/);
  });
});

describe("structuredBlockers — apply round-trips", () => {
  it("teacher_capacity apply raises maxPerWeek so the same check no longer fires", () => {
    // 30 + 20 = 50 > 48 maxPerWeek → apply sets maxPerWeek = 50
    const project = withRequirements(makeMiniSchool(), [
      { id: "r1", classId: "c1", subjectId: "Maths", teacherIds: ["mMaths"], periodsPerWeek: 30 },
      { id: "r2", classId: "c2", subjectId: "Maths", teacherIds: ["mMaths"], periodsPerWeek: 20 },
    ]);
    const report = analyzeFeasibility(project, "tt");
    const b = report.structuredBlockers?.find((x) => x.kind === "teacher_capacity");
    expect(b?.relaxation.apply).toBeDefined();
    const fixed = b!.relaxation.apply!(project);
    const fixedReport = analyzeFeasibility(fixed, "tt");
    expect(fixedReport.structuredBlockers?.some((x) => x.kind === "teacher_capacity")).toBe(false);
  });

  it("cap_sum apply raises the constraint cap so the same check no longer fires", () => {
    // 15 + 10 = 25 > cap 20 → apply sets constraint max = 25
    const project: Project = {
      ...makeMiniSchool(),
      constraints: [{ id: "cap1", scope: "teacher", severity: "must", weight: 1, enabled: true, template: "teacher_max_per_week", params: { teacherId: "mMaths", max: 20 } }],
      requirements: [
        { id: "r1", classId: "c1", subjectId: "Maths", teacherIds: ["mMaths"], periodsPerWeek: 15 },
        { id: "r2", classId: "c2", subjectId: "Maths", teacherIds: ["mMaths"], periodsPerWeek: 10 },
      ],
    };
    const report = analyzeFeasibility(project, "tt");
    const b = report.structuredBlockers?.find((x) => x.kind === "cap_sum");
    expect(b?.relaxation.apply).toBeDefined();
    const fixed = b!.relaxation.apply!(project);
    const fixedReport = analyzeFeasibility(fixed, "tt");
    expect(fixedReport.structuredBlockers?.some((x) => x.kind === "cap_sum")).toBe(false);
  });
});
