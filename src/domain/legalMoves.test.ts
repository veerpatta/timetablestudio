import { describe, expect, it } from "vitest";
import { buildBundledProject } from "../fixtures/bundled";
import { makeMiniSchool } from "../fixtures/synthetic";
import { clearCell, placeNormalLesson } from "./edit";
import { legalOptions } from "./legalMoves";
import { validate } from "./validate";
import type { Day, Project } from "./types";

const hardCount = (p: Project, ttId: string) =>
  validate(p, p.timetables.find((t) => t.id === ttId)!).filter((v) => v.severity === "hard").length;

describe("legalOptions never offers an illegal placement (synthetic)", () => {
  it("offers qualified teachers, excludes unqualified ones, and each option is legal", () => {
    const project = makeMiniSchool();
    const opts = legalOptions(project, "tt", "c1", "Mon", 1);
    // Nidhika is qualified for Class 1 Maths; Pradhyuman is not qualified for anything Class 1.
    expect(opts.some((o) => o.teacherIds[0] === "mMaths")).toBe(true);
    expect(opts.some((o) => o.teacherIds[0] === "pEng")).toBe(false);
    for (const o of opts) {
      const after = placeNormalLesson(project, "tt", "c1", "Mon", 1, o.subjectId, o.teacherIds);
      expect(hardCount(after, "tt")).toBe(0);
    }
  });

  it("excludes a teacher who is unavailable in that slot", () => {
    const project = makeMiniSchool();
    project.teachers.find((t) => t.id === "mMaths")!.unavailable = [{ day: "Mon", slot: 1 }];
    expect(legalOptions(project, "tt", "c1", "Mon", 1).some((o) => o.teacherIds[0] === "mMaths")).toBe(false);
  });

  it("excludes a teacher already busy with a different event in that slot", () => {
    let project = makeMiniSchool();
    // Put Nidhika (mMaths) teaching Class 1 at Mon P1; she is then busy for Class 2 there.
    project = placeNormalLesson(project, "tt", "c1", "Mon", 1, "Maths", ["mMaths"]);
    const opts = legalOptions(project, "tt", "c2", "Mon", 1);
    expect(opts.some((o) => o.teacherIds[0] === "mMaths")).toBe(false);
  });

  it("returns nothing for a non-teaching slot (Recess = index 5)", () => {
    expect(legalOptions(makeMiniSchool(), "tt", "c1", "Mon", 5)).toEqual([]);
  });
});

describe("legalOptions on the REAL bundled timetable (independent oracle)", () => {
  const base = buildBundledProject();
  const ttId = base.activeTimetableId!;
  const DAYS: Day[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const teachingSlotIdx = [1, 2, 3, 4, 6, 7, 8, 9];
  const sampleClasses = ["Class 7", "Class 10", "Class 11 Commerce"];

  it("every offered option, when placed, introduces ZERO new hard violations", () => {
    for (const classId of sampleClasses) {
      for (const day of DAYS) {
        for (const slot of teachingSlotIdx) {
          const cleared = clearCell(base, ttId, classId, day, slot);
          for (const o of legalOptions(cleared, ttId, classId, day, slot)) {
            const after = placeNormalLesson(cleared, ttId, classId, day, slot, o.subjectId, o.teacherIds);
            expect(hardCount(after, ttId)).toBe(0);
          }
        }
      }
    }
  });

  it("never offers a non-schedulable teacher (Director) or an unavailable one (Mahesh after recess)", () => {
    for (const day of DAYS) {
      // Mahesh is unavailable P5–P8 (slots 6–9): never offered to Class 11 Science there.
      for (const slot of [6, 7, 8, 9]) {
        const cleared = clearCell(base, ttId, "Class 11 Science", day, slot);
        expect(legalOptions(cleared, ttId, "Class 11 Science", day, slot).some((o) => o.teacherIds[0] === "Mahesh")).toBe(false);
      }
      for (const slot of teachingSlotIdx) {
        const cleared = clearCell(base, ttId, "Class 10", day, slot);
        expect(legalOptions(cleared, ttId, "Class 10", day, slot).some((o) => o.teacherIds[0] === "Director")).toBe(false);
      }
    }
  });
});
