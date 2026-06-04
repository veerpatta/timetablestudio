import { describe, it, expect } from "vitest";
import { validate, quotaStatus } from "./validate";
import { elgaFixture, lesson, place } from "../fixtures/synthetic";
import type { Project } from "./types";

const ids = (vs: { constraintId: string }[]) => vs.map((v) => v.constraintId).sort();

describe("validate — ELGA worked example (CONSTRAINTS.md)", () => {
  it("a single ELGA block placed Mon P3 is feasible (0 hard violations)", () => {
    const p = elgaFixture();
    p.timetables[0]!.placements = [place("act-elga", "Mon", 3)];
    const v = validate(p, p.timetables[0]!);
    expect(v).toEqual([]);
  });

  it("expands to all 5 classes × P3–P5 and occupies all 5 teachers", () => {
    const p = elgaFixture();
    p.timetables[0]!.placements = [place("act-elga", "Mon", 3)];
    // Class 7 Hindi with Kusum at Mon P4 → Kusum double-booked (H1)
    p.activities.push(lesson("L-c7-hindi", "c7", "Hindi", ["Kusum"]));
    p.timetables[0]!.placements.push(place("L-c7-hindi", "Mon", 4));
    const v = validate(p, p.timetables[0]!);
    expect(ids(v)).toContain("H1");
    expect(v.find((x) => x.constraintId === "H1")!.message).toMatch(/Kusum/);
  });

  it("H2: another activity in Class 1 during the ELGA block clashes", () => {
    const p = elgaFixture();
    p.timetables[0]!.placements = [place("act-elga", "Mon", 3)];
    p.activities.push(lesson("L-c1-maths", "c1", "Maths", ["Bindu"]));
    p.timetables[0]!.placements.push(place("L-c1-maths", "Mon", 3));
    const v = validate(p, p.timetables[0]!);
    // Bindu clashes (H1) AND Class 1 clashes (H2)
    expect(ids(v)).toContain("H2");
  });

  it("H4: ELGA starting P5 with length 3 runs past the 6-period day", () => {
    const p = elgaFixture();
    p.timetables[0]!.placements = [place("act-elga", "Mon", 5)];
    const v = validate(p, p.timetables[0]!);
    expect(ids(v)).toContain("H4");
  });
});

describe("validate — individual hard constraints", () => {
  function withLesson(
    id: string,
    classId: string,
    subjectId: string,
    teacherIds: string[],
    day: Parameters<typeof place>[1],
    period: number,
  ): Project {
    const p = elgaFixture();
    p.activities.push(lesson(id, classId, subjectId, teacherIds));
    p.timetables[0]!.placements = [place(id, day, period)];
    return p;
  }

  it("H1: two lessons share a teacher in one slot", () => {
    const p = withLesson("L1", "c1", "Maths", ["Bindu"], "Tue", 1);
    p.activities.push(lesson("L2", "c2", "Maths", ["Bindu"]));
    p.timetables[0]!.placements.push(place("L2", "Tue", 1));
    expect(ids(validate(p, p.timetables[0]!))).toContain("H1");
  });

  it("H2: two activities in one class+slot", () => {
    const p = withLesson("L1", "c1", "Maths", ["Bindu"], "Tue", 1);
    p.activities.push(lesson("L2", "c1", "Hindi", ["Anita"]));
    p.timetables[0]!.placements.push(place("L2", "Tue", 1));
    expect(ids(validate(p, p.timetables[0]!))).toContain("H2");
  });

  it("H1+H2: two placements of the SAME canonical lesson in one slot clash", () => {
    // Regression: clash detection must count occupancies, not dedupe by id —
    // the requirement model places one lesson activity many times.
    const p = elgaFixture();
    p.activities.push(lesson("canon", "c1", "Maths", ["Bindu"]));
    p.timetables[0]!.placements = [place("canon", "Tue", 1), place("canon", "Tue", 1)];
    const got = ids(validate(p, p.timetables[0]!));
    expect(got).toContain("H1");
    expect(got).toContain("H2");
  });

  it("H3: a degenerate block (no teachers) is flagged", () => {
    const p = elgaFixture();
    const block = p.activities[0];
    if (block && block.kind === "block") block.teacherIds = [];
    p.timetables[0]!.placements = [place("act-elga", "Mon", 3)];
    expect(ids(validate(p, p.timetables[0]!))).toContain("H3");
  });

  it("H5: a teacher scheduled in an unavailable slot", () => {
    const p = withLesson("L1", "c1", "Maths", ["Bindu"], "Tue", 1);
    p.teachers.find((t) => t.id === "Bindu")!.unavailable = [{ day: "Tue", period: 1 }];
    expect(ids(validate(p, p.timetables[0]!))).toContain("H5");
  });

  it("H6: a teacher not qualified for the subject", () => {
    // Nidhika only teaches Maths; assign her Hindi
    const p = withLesson("L1", "c7", "Hindi", ["Nidhika"], "Tue", 1);
    expect(ids(validate(p, p.timetables[0]!))).toContain("H6");
  });

  it("H8: more than maxPerDay of a subject for a class on one day", () => {
    const p = elgaFixture();
    p.requirements.curriculum.push({
      id: "r1",
      classId: "c7",
      subjectId: "Maths",
      teacherIds: ["Nidhika"],
      periodsPerWeek: 5,
      maxPerDay: 1,
    });
    p.activities.push(lesson("M1", "c7", "Maths", ["Nidhika"]));
    p.activities.push(lesson("M2", "c7", "Maths", ["Nidhika"]));
    p.timetables[0]!.placements = [place("M1", "Wed", 1), place("M2", "Wed", 2)];
    expect(ids(validate(p, p.timetables[0]!))).toContain("H8");
  });

  it("H8: does NOT fire when no requirement scopes the class+subject", () => {
    // 3 periods of Maths for c7 in a day, but no CurriculumRequirement exists.
    const p = elgaFixture();
    p.activities.push(lesson("M1", "c7", "Maths", ["Nidhika"]));
    p.activities.push(lesson("M2", "c7", "Maths", ["Nidhika"]));
    p.activities.push(lesson("M3", "c7", "Maths", ["Nidhika"]));
    p.timetables[0]!.placements = [
      place("M1", "Wed", 1),
      place("M2", "Wed", 2),
      place("M3", "Wed", 3),
    ];
    expect(ids(validate(p, p.timetables[0]!))).not.toContain("H8");
  });

  it("H9: a teacher exceeds maxPeriodsPerDay", () => {
    const p = elgaFixture();
    p.teachers.find((t) => t.id === "Nidhika")!.maxPeriodsPerDay = 1;
    p.activities.push(lesson("M1", "c7", "Maths", ["Nidhika"]));
    p.activities.push(lesson("M2", "c1", "Maths", ["Nidhika"]));
    p.timetables[0]!.placements = [place("M1", "Wed", 1), place("M2", "Wed", 2)];
    expect(ids(validate(p, p.timetables[0]!))).toContain("H9");
  });
});

describe("quotaStatus (H7 reported, not violated)", () => {
  it("reports short/ok/excess against periodsPerWeek", () => {
    const p = elgaFixture();
    p.requirements.curriculum.push({
      id: "r1",
      classId: "c7",
      subjectId: "Maths",
      teacherIds: ["Nidhika"],
      periodsPerWeek: 2,
    });
    p.activities.push(lesson("M1", "c7", "Maths", ["Nidhika"]));
    p.timetables[0]!.placements = [place("M1", "Wed", 1)];
    const qs = quotaStatus(p, p.timetables[0]!);
    expect(qs[0]).toMatchObject({ required: 2, placed: 1, status: "short" });
  });
});
