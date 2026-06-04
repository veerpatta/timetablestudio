import { describe, it, expect } from "vitest";
import { scoreTimetable, HARD_PENALTY } from "./score";
import { makeSampleProject } from "../store/projectStore";
import { lesson, place } from "../fixtures/synthetic";
import type { Project, Timetable } from "../domain/types";

const active = (p: Project): Timetable =>
  p.timetables.find((t) => t.id === p.activeTimetableId)!;

describe("scoreTimetable", () => {
  it("a feasible timetable scores below one hard penalty", () => {
    const p = makeSampleProject();
    const { score, hard } = scoreTimetable(p, active(p));
    expect(hard).toBe(0);
    expect(score).toBeLessThan(HARD_PENALTY);
  });

  it("each hard violation adds HARD_PENALTY", () => {
    const p = makeSampleProject();
    const tt = active(p);
    // Force a teacher clash: Kusum during ELGA at Mon P4.
    p.activities.push(lesson("L-clash", "Class 7", "Hindi", ["Kusum"]));
    tt.placements = [...tt.placements, place("L-clash", "Mon", 4)];
    const { score, hard } = scoreTimetable(p, tt);
    expect(hard).toBeGreaterThanOrEqual(1);
    expect(score).toBeGreaterThanOrEqual(HARD_PENALTY);
  });
});
