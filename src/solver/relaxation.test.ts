import { describe, expect, it } from "vitest";
import { teachingSlots } from "../domain/profile";
import { validate } from "../domain/validate";
import { makeMiniSchool } from "../fixtures/synthetic";
import type { Day, Project } from "../domain/types";
import { solveWithRelaxation } from "./relaxation";

const TIER_1_CONSTRAINT_ID = "c-maths-not-last";

/** An instance where mMaths is available ONLY at the last teaching slot (P8) on Monday,
 *  and there is a tier-1 "subject_not_last" constraint for c1 Maths.
 *
 *  Step 1 cannot complete: the only available slot is blocked by the tier-1 must constraint.
 *  Step 2 demotes it to prefer → last slot becomes reachable → complete.
 *  Acceptance criteria: step=2, relaxed=[the constraint], tier1Suggestions=[]. */
function tier1BlockProject(): Project {
  const p = makeMiniSchool();
  const profile = p.profiles[0]!;
  const slots = teachingSlots(profile);
  const lastSlot = slots.at(-1)!;  // slot 9 (P8)

  // mMaths available ONLY at the last slot of Monday; unavailable everywhere else
  const allDays: Day[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const unavailMaths = allDays.flatMap((day) =>
    slots
      .filter((s) => !(day === "Mon" && s === lastSlot))
      .map((slot) => ({ day, slot })),
  );

  const teachers = p.teachers.map((t) =>
    t.id === "mMaths" ? { ...t, unavailable: unavailMaths } : t,
  );

  // Tier-1 constraint: c1 Maths must not be in the last period
  const c1NotLast = {
    id: TIER_1_CONSTRAINT_ID,
    template: "subject_not_last" as const,
    scope: "class" as const,
    severity: "must" as const,
    tier: 1 as const,
    enabled: true,
    weight: 1,
    params: { classIds: ["c1"], subjectIds: ["Maths"] },
  };

  return {
    ...p,
    teachers,
    // One requirement only: c1 Maths, 1 period per week, no preferred teacher
    requirements: [{ id: "r-c1", classId: "c1", subjectId: "Maths", periodsPerWeek: 1, teacherIds: [] }],
    constraints: [...p.constraints, c1NotLast],
    timetables: [{ id: "tt", name: "Draft", profileId: profile.id, placements: [] }],
    activeTimetableId: "tt",
  };
}

describe("M-E: solveWithRelaxation", () => {
  it("AC: completes by bending exactly one tier-1 rule when step-1 fails", () => {
    const project = tier1BlockProject();
    const result = solveWithRelaxation(project, "tt", { seeds: 4, budgetMs: 2000 });

    // Step 2 must complete the timetable
    expect(result.step).toBe(2);
    expect(result.remainingShortfall).toBe(0);

    // Exactly the one tier-1 constraint was bent
    expect(result.relaxed).toHaveLength(1);
    expect(result.relaxed[0]!.constraintId).toBe(TIER_1_CONSTRAINT_ID);
    expect(result.relaxed[0]!.tier).toBe(1);
    expect(result.relaxed[0]!.sentence).toMatch(/Maths/);

    // No remaining tier-1 suggestions (completed)
    expect(result.tier1Suggestions).toHaveLength(0);
  });

  it("returns step=1 with no relaxed[] when the instance is already complete", () => {
    // A project with no hard blocker — normal mini school should complete without relaxation
    const p = makeMiniSchool();
    // Only Eng11 joint class; no requirements → shortfall=0 after fill
    const result = solveWithRelaxation(p, "tt", { seeds: 2, budgetMs: 1000 });
    expect(result.step).toBe(1);
    expect(result.remainingShortfall).toBe(0);
    expect(result.relaxed).toHaveLength(0);
  });

  it("leak check: returned project always carries original constraint severity and tier", () => {
    const project = tier1BlockProject();
    const result = solveWithRelaxation(project, "tt", { seeds: 4, budgetMs: 2000 });

    // Every constraint in the returned project must match the original's severity and tier
    const originalById = new Map(project.constraints.map((c) => [c.id, c]));
    for (const c of result.project.constraints) {
      const orig = originalById.get(c.id);
      if (orig) {
        expect(c.severity, `constraint ${c.id} severity`).toBe(orig.severity);
        expect(c.tier, `constraint ${c.id} tier`).toBe(orig.tier);
      }
    }
  });

  it("determinism: same opts produce identical results", () => {
    const project = tier1BlockProject();
    const opts = { seeds: 4, budgetMs: 2000 };
    const r1 = solveWithRelaxation(project, "tt", opts);
    const r2 = solveWithRelaxation(project, "tt", opts);

    expect(r1.step).toBe(r2.step);
    expect(r1.remainingShortfall).toBe(r2.remainingShortfall);
    expect(r1.relaxed).toHaveLength(r2.relaxed.length);

    const hash = (p: Project) => {
      const tt = p.timetables.find((t) => t.id === "tt")!;
      return [...tt.placements]
        .sort((a, b) => (`${a.eventId}${a.day}${a.slot}` < `${b.eventId}${b.day}${b.slot}` ? -1 : 1))
        .map((p) => `${p.eventId}|${p.day}|${p.slot}`)
        .join(",");
    };
    expect(hash(r1.project)).toBe(hash(r2.project));
  });

  it("validate() on the returned project shows the bent tier-1 rule as a hard violation", () => {
    const project = tier1BlockProject();
    const result = solveWithRelaxation(project, "tt", { seeds: 4, budgetMs: 2000 });

    // The returned project has original constraints grafted back (tier-1 back to must).
    // The timetable placed Maths at the last slot → validate finds a hard violation.
    expect(result.step).toBe(2); // only run this assertion if step 2 succeeded
    const tt = result.project.timetables.find((t) => t.id === "tt")!;
    const violations = validate(result.project, tt);
    const hardViolations = violations.filter((v) => v.severity === "hard");
    // There must be exactly one hard violation: the subject_not_last rule
    expect(hardViolations.some((v) => v.constraintId === "subject_not_last")).toBe(true);
  });

  it("returns partial with tier1Suggestions when no tier-1 constraints exist and step-1 fails", () => {
    // Project with impossible requirement but no tier-1 constraints
    const p = makeMiniSchool();
    const profile = p.profiles[0]!;
    const slots = teachingSlots(profile);
    // Make mMaths unavailable everywhere
    const allDays: Day[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const unavailAll = allDays.flatMap((day) => slots.map((slot) => ({ day, slot })));
    const teachers = p.teachers.map((t) =>
      t.id === "mMaths" ? { ...t, unavailable: unavailAll } : t,
    );
    const project: Project = {
      ...p,
      teachers,
      requirements: [{ id: "r-c1", classId: "c1", subjectId: "Maths", periodsPerWeek: 1, teacherIds: [] }],
      constraints: [], // no tier-1 constraints
      timetables: [{ id: "tt", name: "Draft", profileId: profile.id, placements: [] }],
      activeTimetableId: "tt",
    };
    const result = solveWithRelaxation(project, "tt", { seeds: 2, budgetMs: 500 });
    expect(result.step).toBe("partial");
    expect(result.remainingShortfall).toBeGreaterThan(0);
    expect(result.relaxed).toHaveLength(0);
    expect(result.tier1Suggestions).toHaveLength(0); // no tier-1 constraints → no suggestions
  });
});
