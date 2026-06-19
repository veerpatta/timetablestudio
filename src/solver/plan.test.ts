import { describe, expect, it } from "vitest";
import { validate } from "../domain/validate";
import { makeMiniSchool } from "../fixtures/synthetic";
import type { Constraint, Project, Requirement, TimetableEvent } from "../domain/types";
import { planTimetable } from "./plan";

function oneLessonProject(opts?: { pinned?: boolean; noQualifiedTeacher?: boolean }): Project {
  const p = makeMiniSchool();
  const event: TimetableEvent = {
    id: "evt-maths-c1-only",
    type: "normal",
    subjectId: "Maths",
    classIds: ["c1"],
    teacherIds: ["mMaths"],
    duration: 1,
    source: "imported",
  };
  const req: Requirement = {
    id: "req-maths-c1",
    classId: "c1",
    subjectId: "Maths",
    teacherIds: ["mMaths"],
    periodsPerWeek: 1,
  };
  const constraint: Constraint = {
    id: "must-first-half",
    scope: "subject",
    severity: "must",
    weight: 1,
    enabled: true,
    template: "subject_half_of_day",
    params: { subjectIds: ["Maths"], classIds: ["c1"], half: "first" },
  };
  return {
    ...p,
    qualifications: opts?.noQualifiedTeacher ? [] : p.qualifications,
    requirements: [req],
    constraints: [constraint],
    events: [...p.events, event],
    timetables: [{ id: "tt", name: "Draft", profileId: p.profiles[0]!.id, placements: [{ eventId: event.id, day: "Mon", slot: 7, pinned: opts?.pinned ?? false }] }],
    activeTimetableId: "tt",
  };
}

describe("planTimetable", () => {
  it("replans an already-filled unlocked timetable to satisfy a strict request", () => {
    const project = oneLessonProject();
    const result = planTimetable(project, "tt", { seeds: 4 });
    const tt = result.project.timetables.find((t) => t.id === "tt")!;

    expect(result.changes.length).toBeGreaterThan(0);
    expect(result.added).toHaveLength(1);
    expect(result.added[0]!.slot).toBeLessThanOrEqual(4);
    expect(validate(result.project, tt).filter((v) => v.severity === "hard")).toEqual([]);
    expect(result.requestStatuses[0]).toMatchObject({ status: "satisfied" });
  });

  it("keeps pinned lessons fixed and explains when a strict request remains blocked", () => {
    const project = oneLessonProject({ pinned: true });
    const result = planTimetable(project, "tt", { seeds: 4 });
    const placement = result.project.timetables.find((t) => t.id === "tt")!.placements[0]!;

    expect(placement).toMatchObject({ eventId: "evt-maths-c1-only", day: "Mon", slot: 7, pinned: true });
    expect(result.hardCount).toBeGreaterThan(0);
    expect(result.blockers.join(" ")).toMatch(/locked/i);
    expect(result.requestStatuses[0]).toMatchObject({ status: "blocked" });
  });

  it("returns a plain blocker when no qualified teacher can meet demand", () => {
    const project = oneLessonProject({ noQualifiedTeacher: true });
    const result = planTimetable(project, "tt", { seeds: 4 });

    expect(result.remainingShortfall).toBeGreaterThan(0);
    expect(result.blockers.join(" ")).toMatch(/qualified/i);
  });
});
