import { describe, it, expect } from "vitest";
import { buildProject, type BuildInput } from "./projectBuilder";
import { validate } from "./validate";

const input: BuildInput = {
  schoolName: "Test School",
  days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  periods: 6,
  classes: [
    { name: "Class 1", group: "primary" },
    { name: "Class 6", group: "middle" },
  ],
  teachers: [
    { name: "Asha", subjects: ["Maths", "ELGA"] },
    { name: "Ben", subjects: ["English"] },
  ],
  quotas: [
    { className: "Class 1", subject: "Maths", teacher: "Asha", periodsPerWeek: 5 },
    { className: "Class 6", subject: "English", teacher: "Ben", periodsPerWeek: 4 },
  ],
  block: {
    name: "ELGA",
    classNames: ["Class 1"],
    teachers: ["Asha"],
    length: 3,
    days: ["Mon"],
    startPeriod: 3,
  },
};

describe("buildProject", () => {
  it("assembles classes, subjects, teachers, quotas, and a pinned block", () => {
    const p = buildProject(input);
    expect(p.classes.map((c) => c.name)).toEqual(["Class 1", "Class 6"]);
    expect(p.subjects.map((s) => s.name).sort()).toEqual(["ELGA", "English", "Maths"]);
    expect(p.requirements.curriculum).toHaveLength(2);
    expect(p.requirements.blocks).toHaveLength(1);
    // ELGA placed + pinned on Mon P3; no lessons placed yet.
    const tt = p.timetables[0]!;
    expect(tt.placements).toHaveLength(1);
    expect(tt.placements[0]).toMatchObject({ day: "Mon", period: 3, pinned: true });
    // a canonical lesson exists per quota
    expect(p.activities.filter((a) => a.kind === "lesson")).toHaveLength(2);
  });

  it("produces a project with the block placed and zero hard conflicts", () => {
    const p = buildProject(input);
    expect(validate(p, p.timetables[0]!).filter((v) => v.severity === "hard")).toEqual([]);
  });
});
