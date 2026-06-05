import { describe, it, expect } from "vitest";
import { buildWeekView } from "./weekModel";
import { makeDemoProject } from "../../store/projectStore";
import type { Project, Timetable } from "../../domain/types";

const active = (p: Project): Timetable =>
  p.timetables.find((t) => t.id === p.activeTimetableId)!;

const dayIndex = (days: string[], d: string) => days.indexOf(d);

describe("buildWeekView", () => {
  it("a primary class's week shows ELGA as a vertical band (rowSpan 3) on its days", () => {
    const p = makeDemoProject();
    const week = buildWeekView(p, active(p), { kind: "class", id: "Class 1" });
    expect(week.days).toHaveLength(6);
    expect(week.rows).toHaveLength(6);

    const mon = dayIndex(week.days, "Mon");
    const p3 = week.rows[2]!.cells[mon]!; // P3, Mon
    expect(p3.isBlock).toBe(true);
    expect(p3.label).toBe("ELGA");
    expect(p3.rowSpan).toBe(3);
    expect(week.rows[3]!.cells[mon]!.covered).toBe(true); // P4 covered
    expect(week.rows[4]!.cells[mon]!.covered).toBe(true); // P5 covered
  });

  it("a teacher's week labels lessons by subject and class", () => {
    const p = makeDemoProject();
    const week = buildWeekView(p, active(p), { kind: "teacher", id: "Nidhika" });
    const filled = week.rows.flatMap((r) => r.cells).filter((c) => c.label);
    expect(filled.length).toBeGreaterThan(0);
    // Nidhika teaches Maths to middle classes
    expect(filled.some((c) => /Maths · Class/.test(c.label))).toBe(true);
  });

  it("scopeLabel reflects the chosen class/teacher", () => {
    const p = makeDemoProject();
    expect(buildWeekView(p, active(p), { kind: "class", id: "Class 6" }).scopeLabel).toBe("Class 6");
    expect(buildWeekView(p, active(p), { kind: "teacher", id: "Mahesh" }).scopeLabel).toBe("Mahesh");
  });
});
