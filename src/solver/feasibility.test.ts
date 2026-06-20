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
