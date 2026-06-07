import { describe, expect, it } from "vitest";
import { makeMiniSchool } from "../fixtures/synthetic";
import { absentTeacherPlan, coverOptions } from "./substitute";
import type { Placement, Project } from "./types";

const setP = (p: Project, placements: Placement[]) => { p.timetables.find((t) => t.id === "tt")!.placements = placements; };
const tt = (p: Project) => p.timetables.find((t) => t.id === "tt")!;
const pl = (eventId: string, day: Placement["day"], slot: number): Placement => ({ eventId, day, slot, pinned: false });

/** makeMiniSchool + Asha, a second teacher qualified for Class 1 Maths. */
function withAsha(): Project {
  const p = makeMiniSchool();
  p.teachers.push({ id: "alt", name: "Asha", maxPerDay: 8, maxPerWeek: 48, schedulable: true, unavailable: [] });
  p.qualifications.push({ teacherId: "alt", subjectId: "Maths", classId: "c1" });
  p.qualifications.push({ teacherId: "alt", subjectId: "Maths", classId: "c2" });
  p.events.push({ id: "evt-alt-c2", type: "normal", subjectId: "Maths", classIds: ["c2"], teacherIds: ["alt"], duration: 1, source: "manual" });
  return p;
}

describe("coverOptions — valid covers only (free + qualified + available)", () => {
  it("offers a qualified, free teacher and excludes a free-but-UNQUALIFIED one", () => {
    const p = withAsha();
    setP(p, [pl("evt-maths-c1", "Mon", 1)]); // Nidhika (mMaths) teaching Class 1 Maths
    const covers = coverOptions(p, tt(p), "mMaths", "Mon", 1);
    expect(covers).toContain("alt"); // Asha is qualified + free
    expect(covers).not.toContain("pEng"); // Pradhyuman is free but not qualified for Class 1 Maths
    expect(covers).not.toContain("mMaths"); // the absent teacher is never her own cover
  });

  it("excludes a qualified teacher who is UNAVAILABLE that slot", () => {
    const p = withAsha();
    p.teachers.find((t) => t.id === "alt")!.unavailable = [{ day: "Mon", slot: 1 }];
    setP(p, [pl("evt-maths-c1", "Mon", 1)]);
    expect(coverOptions(p, tt(p), "mMaths", "Mon", 1)).not.toContain("alt");
  });

  it("excludes a qualified teacher who is BUSY that slot", () => {
    const p = withAsha();
    setP(p, [pl("evt-maths-c1", "Mon", 1), pl("evt-alt-c2", "Mon", 1)]); // Asha already teaching Class 2
    expect(coverOptions(p, tt(p), "mMaths", "Mon", 1)).not.toContain("alt");
  });
});

describe("absentTeacherPlan", () => {
  it("lists each lesson with covers, and flags ELGA team blocks as cover-by-hand", () => {
    const p = withAsha();
    setP(p, [pl("evt-maths-c1", "Mon", 1), pl("evt-elga", "Mon", 3)]);
    const plan = absentTeacherPlan(p, tt(p), "bindu", "Mon"); // Bindu teaches Maths? no — she's ELGA team here
    const block = plan.find((r) => r.isBlock);
    expect(block).toBeTruthy();
    expect(block!.covers).toEqual([]); // team block: arrange by hand

    const nidhika = absentTeacherPlan(p, tt(p), "mMaths", "Mon");
    expect(nidhika[0]!.covers).toContain("alt");
  });
});
