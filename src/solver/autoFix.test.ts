import { describe, expect, it } from "vitest";
import type { Project, Requirement } from "../domain/types";
import { makeMiniSchool } from "../fixtures/synthetic";
import { analyzeFeasibility } from "./feasibility";
import { autoFixToFeasible } from "./autoFix";

function withRequirements(project: Project, requirements: Requirement[]): Project {
  return { ...project, requirements };
}

describe("autoFixToFeasible (M-B)", () => {
  it("resolves a teacher_capacity blocker by raising the teacher cap", () => {
    // mMaths (Nidhika) is the sole qualifier for Maths → sole-qualifier demand analysis fires.
    // Give the requirement more than her maxPerWeek to trigger teacher_capacity blocker.
    const base = makeMiniSchool();
    const mathTeacher = base.teachers.find((t) => t.id === "mMaths")!;
    const maxBefore = mathTeacher.maxPerWeek; // 48
    const demand = maxBefore + 5; // 53

    const project = withRequirements(base, [
      { id: "req-overload", classId: "c1", subjectId: "Maths", teacherIds: [], periodsPerWeek: demand },
    ]);

    const feasBefore = analyzeFeasibility(project, "tt");
    expect(feasBefore.status).toBe("blocked");
    // The teacher_capacity blocker should have an apply function
    const hasFix = (feasBefore.structuredBlockers ?? []).some((b) => !!b.relaxation.apply);
    expect(hasFix).toBe(true);

    const { project: fixed, appliedLabels } = autoFixToFeasible(project, "tt");
    expect(appliedLabels.length).toBeGreaterThan(0);

    // mMaths's cap should now be raised to at least demand
    const teacherAfter = fixed.teachers.find((t) => t.id === "mMaths")!;
    expect(teacherAfter.maxPerWeek).toBeGreaterThan(maxBefore);
    expect(teacherAfter.maxPerWeek).toBeGreaterThanOrEqual(demand);
  });

  it("returns the original project unchanged when already feasible", () => {
    const project = makeMiniSchool();
    const feas = analyzeFeasibility(project, "tt");
    // Mini school may or may not be blocked; if ready, auto-fix is a no-op
    if (feas.status === "ready") {
      const { project: fixed, appliedLabels } = autoFixToFeasible(project, "tt");
      expect(appliedLabels).toHaveLength(0);
      expect(fixed).toBe(project); // same reference — nothing changed
    }
  });

  it("returns empty appliedLabels when no auto-applicable blockers exist", () => {
    // subject_capacity (no qualified teacher) has no relaxation.apply — can't auto-fix
    const project: Project = {
      ...makeMiniSchool(),
      qualifications: [],
      requirements: [
        { id: "req-no-teacher", classId: "c1", subjectId: "Maths", teacherIds: [], periodsPerWeek: 1 },
      ],
    };
    const feas = analyzeFeasibility(project, "tt");
    expect(feas.status).toBe("blocked");
    const { appliedLabels } = autoFixToFeasible(project, "tt");
    // subject_capacity has no apply — nothing is auto-fixable
    expect(appliedLabels).toHaveLength(0);
  });
});
