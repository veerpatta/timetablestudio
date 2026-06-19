import { describe, expect, it } from "vitest";
import { validate } from "../domain/validate";
import { buildBundledProject } from "../fixtures/bundled";
import { makeMiniSchool } from "../fixtures/synthetic";
import type { Constraint, Id, Project, Requirement, Timetable, TimetableEvent } from "../domain/types";
import { planTimetable } from "./plan";

const ARTS_ELECTIVES = ["Political Science", "Geography", "Economics", "English Literature"];

/** Count placements of `subject` attended by `classId` (any student group). */
function subjectPlacements(project: Project, timetable: Timetable, classId: Id, subject: Id): number {
  const byId = new Map(project.events.map((e) => [e.id, e]));
  return timetable.placements.filter((p) => {
    const e = byId.get(p.eventId);
    return e?.subjectId === subject && e.classIds.includes(classId);
  }).length;
}

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

  it("keeps Arts electives intact on re-plan (no Self Study collapse)", () => {
    const project = buildBundledProject();
    const ttId = project.activeTimetableId!;
    const before = project.timetables.find((t) => t.id === ttId)!;

    // Sanity: the bundled Arts classes really do run the four electives.
    for (const cls of ["Class 11 Arts", "Class 12 Arts"]) {
      for (const sub of ARTS_ELECTIVES) {
        expect(subjectPlacements(project, before, cls, sub)).toBeGreaterThan(0);
      }
    }
    const studyBefore =
      subjectPlacements(project, before, "Class 11 Arts", "Self Study") +
      subjectPlacements(project, before, "Class 12 Arts", "Self Study");

    const result = planTimetable(project, ttId, { seeds: 2 });
    const after = result.project.timetables.find((t) => t.id === ttId)!;

    // The electives must survive — they must NOT be replaced by whole-class Self Study.
    for (const cls of ["Class 11 Arts", "Class 12 Arts"]) {
      for (const sub of ARTS_ELECTIVES) {
        expect(subjectPlacements(result.project, after, cls, sub)).toBeGreaterThan(0);
      }
    }
    const studyAfter =
      subjectPlacements(result.project, after, "Class 11 Arts", "Self Study") +
      subjectPlacements(result.project, after, "Class 12 Arts", "Self Study");
    expect(studyAfter).toBeLessThanOrEqual(studyBefore);
    expect(validate(result.project, after).filter((v) => v.severity === "hard")).toEqual([]);
  });

  it("returns a plain blocker when no qualified teacher can meet demand", () => {
    const project = oneLessonProject({ noQualifiedTeacher: true });
    const result = planTimetable(project, "tt", { seeds: 4 });

    expect(result.remainingShortfall).toBeGreaterThan(0);
    expect(result.blockers.join(" ")).toMatch(/qualified/i);
  });
});
