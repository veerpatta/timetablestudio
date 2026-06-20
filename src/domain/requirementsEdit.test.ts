import { describe, expect, it } from "vitest";
import { makeMiniSchool } from "../fixtures/synthetic";
import { removeRequirement, setRequirement } from "./requirementsEdit";

describe("requirementsEdit", () => {
  it("creates a new requirement, seeding teachers from qualifications", () => {
    const p = setRequirement(makeMiniSchool(), "c1", "Maths", 5);
    const r = p.requirements.find((x) => x.classId === "c1" && x.subjectId === "Maths");
    expect(r).toBeDefined();
    expect(r!.periodsPerWeek).toBe(5);
    expect(r!.teacherIds).toContain("mMaths"); // mMaths is qualified for c1 Maths in the fixture
  });

  it("updates an existing requirement in place (no duplicate row)", () => {
    let p = setRequirement(makeMiniSchool(), "c1", "Maths", 5);
    p = setRequirement(p, "c1", "Maths", 2);
    const rows = p.requirements.filter((x) => x.classId === "c1" && x.subjectId === "Maths");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.periodsPerWeek).toBe(2);
  });

  it("clamps negatives to zero and rounds", () => {
    const p = setRequirement(makeMiniSchool(), "c1", "Maths", -3);
    expect(p.requirements.find((x) => x.classId === "c1" && x.subjectId === "Maths")!.periodsPerWeek).toBe(0);
  });

  it("removes a requirement", () => {
    let p = setRequirement(makeMiniSchool(), "c1", "Maths", 5);
    p = removeRequirement(p, "c1", "Maths");
    expect(p.requirements.some((x) => x.classId === "c1" && x.subjectId === "Maths")).toBe(false);
  });
});
