import { describe, expect, it } from "vitest";
import { clearCell } from "../domain/edit";
import { totalShortfall } from "../domain/coverage";
import { validate } from "../domain/validate";
import { buildBundledProject } from "../fixtures/bundled";
import { makeMiniSchool } from "../fixtures/synthetic";
import type { Project, Requirement } from "../domain/types";
import { fill } from "./fill";
import { solveTimetable } from "./deepSearch";

const tableOf = (p: Project, ttId = p.activeTimetableId ?? "tt") => p.timetables.find((t) => t.id === ttId)!;
const hardCount = (p: Project, ttId = p.activeTimetableId ?? "tt") => validate(p, tableOf(p, ttId)).filter((v) => v.severity === "hard").length;
const shortfall = (p: Project, ttId = p.activeTimetableId ?? "tt") => totalShortfall(p, tableOf(p, ttId));

function withRequirements(project: Project, requirements: Requirement[]): Project {
  return { ...project, requirements };
}

describe("solveTimetable", () => {
  it("proves a tiny feasible timetable complete", () => {
    const project = withRequirements(makeMiniSchool(), [
      { id: "req-c1-maths", classId: "c1", subjectId: "Maths", teacherIds: ["mMaths"], periodsPerWeek: 1 },
    ]);

    const result = solveTimetable(project, "tt", { mode: "prove", budgetMs: 1000, maxCandidates: 2 });

    expect(result.proofLevel).toBe("complete");
    expect(result.remainingShortfall).toBe(0);
    expect(result.hardCount).toBe(0);
  });

  it("proves a tiny impossible timetable when no teacher is qualified", () => {
    const project = withRequirements(
      { ...makeMiniSchool(), qualifications: [] },
      [{ id: "req-c1-maths", classId: "c1", subjectId: "Maths", teacherIds: [], periodsPerWeek: 1 }],
    );

    const result = solveTimetable(project, "tt", { mode: "prove", budgetMs: 1000 });

    expect(result.proofLevel).toBe("impossible");
    expect(result.feasibility.blockers.join(" ")).toMatch(/qualified/i);
  });

  it("deep mode matches or improves the current fast fill on a contended bundled timetable", () => {
    const base = buildBundledProject();
    const ttId = base.activeTimetableId!;
    const cleared = clearCell(base, ttId, "Class 1", "Mon", 1);
    const fast = fill(cleared, ttId, { seed: 1 });

    const deep = solveTimetable(cleared, ttId, { mode: "deep", budgetMs: 1500, maxCandidates: 3 });

    expect(deep.remainingShortfall).toBeLessThanOrEqual(fast.remainingShortfall);
    expect(deep.hardCount).toBe(0);
  });

  it("does not degrade the complete bundled timetable", () => {
    const project = buildBundledProject();
    const ttId = project.activeTimetableId!;

    const result = solveTimetable(project, ttId, { mode: "deep", budgetMs: 1000, maxCandidates: 3 });

    expect(result.remainingShortfall).toBe(shortfall(project, ttId));
    expect(result.hardCount).toBe(hardCount(project, ttId));
    expect(result.changes).toHaveLength(0);
  });
});
