import { describe, it, expect } from "vitest";
import { proposeSubstitutions } from "./substitution";
import { makeSampleProject } from "../store/projectStore";
import { elgaFixture, lesson, place } from "../fixtures/synthetic";

describe("proposeSubstitutions — M5", () => {
  it("AC: a primary teacher absent on an ELGA day flags the block as owner-decision", () => {
    const p = makeSampleProject();
    const plan = proposeSubstitutions(p, p.activeTimetableId!, {
      day: "Mon",
      absentTeacherIds: ["Kusum"],
    });
    const block = plan.items.find((i) => i.kind === "block");
    expect(block).toBeTruthy();
    expect(block!.status).toBe("owner-decision");
    expect(block!.subjectLabel).toBe("ELGA");
    expect(block!.absentTeacherIds).toContain("Kusum");
    // an ELGA cover is NEVER auto-suggested
    expect(block!.candidates).toEqual([]);
  });

  it("proposes free, qualified covers for a single-teacher lesson", () => {
    const p = makeSampleProject();
    const plan = proposeSubstitutions(p, p.activeTimetableId!, {
      day: "Mon",
      absentTeacherIds: ["Nidhika"], // Class 7 Maths
    });
    const cover = plan.items.find((i) => i.status === "needs-cover" && i.subjectLabel === "Maths");
    expect(cover).toBeTruthy();
    expect(cover!.candidates.length).toBeGreaterThan(0);
    // every candidate is qualified, present, and not the absent teacher
    for (const c of cover!.candidates) {
      expect(c.teacherId).not.toBe("Nidhika");
      const t = p.teachers.find((x) => x.id === c.teacherId)!;
      expect(t.subjects).toContain("Maths");
    }
    // sorted ascending by disruption score
    const scores = cover!.candidates.map((c) => c.score);
    expect([...scores].sort((a, b) => a - b)).toEqual(scores);
  });

  it("a non-ELGA teacher absent produces no owner-decision item", () => {
    const p = makeSampleProject();
    const plan = proposeSubstitutions(p, p.activeTimetableId!, {
      day: "Mon",
      absentTeacherIds: ["Pradhyuman"], // Class 11 Science Physics
    });
    expect(plan.items.some((i) => i.status === "owner-decision")).toBe(false);
    expect(plan.items.some((i) => i.subjectLabel === "Physics")).toBe(true);
  });

  it("a multi-teacher lesson with a present co-teacher is 'partial' (proceeds)", () => {
    const p = elgaFixture();
    p.activities.push(lesson("co", "c7", "Maths", ["Nidhika", "Bindu"]));
    p.timetables[0]!.placements = [place("co", "Wed", 1)];
    const plan = proposeSubstitutions(p, p.timetables[0]!.id, {
      day: "Wed",
      absentTeacherIds: ["Nidhika"],
    });
    const item = plan.items.find((i) => i.classLabel === "Class 7");
    expect(item!.status).toBe("partial");
    expect(item!.presentTeacherIds).toContain("Bindu");
  });
});
