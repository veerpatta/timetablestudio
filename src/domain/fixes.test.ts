import { describe, expect, it } from "vitest";
import { makeMiniSchool } from "../fixtures/synthetic";
import { suggestFixes } from "./fixes";
import { validate } from "./validate";
import type { Placement, Project } from "./types";

const hard = (p: Project, id = "tt") =>
  validate(p, p.timetables.find((t) => t.id === id)!).filter((v) => v.severity === "hard").length;
const place = (eventId: string, slot: number): Placement => ({ eventId, day: "Mon", slot, pinned: false });

describe("suggestFixes — legal, undoable, strictly-improving fixes", () => {
  it("fixes an injected teacher double-booking; every fix reduces hard, the best reaches 0", () => {
    const p = makeMiniSchool();
    const table = p.timetables.find((t) => t.id === "tt")!;
    table.placements = [place("evt-maths-c1", 1), place("evt-maths-c2", 1)];
    expect(hard(p)).toBe(1);
    const v = validate(p, table).find((x) => x.constraintId === "HE1")!;
    const fixes = suggestFixes(p, table, v);
    expect(fixes.length).toBeGreaterThan(0);
    for (const f of fixes) expect(hard(f.project)).toBeLessThan(1); // strictly improving
    expect(hard(fixes[0]!.project)).toBe(0); // best fix clears it
  });

  it("offers a teacher reassignment when a qualified, available alternative exists (HE4)", () => {
    const p = makeMiniSchool();
    p.teachers.push({ id: "alt", name: "Asha", maxPerDay: 8, maxPerWeek: 48, schedulable: true, unavailable: [] });
    p.qualifications.push({ teacherId: "alt", subjectId: "Maths", classId: "c1" });
    p.teachers.find((t) => t.id === "mMaths")!.unavailable = [{ day: "Mon", slot: 1 }];
    const table = p.timetables.find((t) => t.id === "tt")!;
    table.placements = [place("evt-maths-c1", 1)];
    expect(hard(p)).toBe(1); // Nidhika placed where she's unavailable
    const v = validate(p, table).find((x) => x.constraintId === "HE4")!;
    const fixes = suggestFixes(p, table, v);
    expect(fixes[0]!.label).toMatch(/Reassign to Maths — Asha/);
    expect(hard(fixes[0]!.project)).toBe(0);
  });

  it("returns no fix when the conflicting placements are pinned", () => {
    const p = makeMiniSchool();
    const table = p.timetables.find((t) => t.id === "tt")!;
    table.placements = [
      { eventId: "evt-maths-c1", day: "Mon", slot: 1, pinned: true },
      { eventId: "evt-maths-c2", day: "Mon", slot: 1, pinned: true },
    ];
    const v = validate(p, table).find((x) => x.constraintId === "HE1")!;
    expect(suggestFixes(p, table, v)).toEqual([]);
  });
});
