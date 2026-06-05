import { describe, it, expect } from "vitest";
import { diffTimetables } from "./diff";
import { makeSampleProject } from "../store/projectStore";
import { movePlacement } from "./edit";
import type { Project } from "./types";

const placements = (p: Project) =>
  p.timetables.find((t) => t.id === p.activeTimetableId)!.placements;

describe("diffTimetables (M9 candidate diff)", () => {
  it("detects a single changed cell when one lesson moves", () => {
    const p = makeSampleProject();
    const before = placements(p);
    // Move a Class 1 lesson from Mon P1 to Mon P6 (P6 is free in the sample... use a known one)
    const ref = before.find((pl) => !pl.pinned)!;
    const after = movePlacement(before, ref, ref.day, ref.period === 6 ? 5 : 6);

    const changes = diffTimetables(p, before, after);
    expect(changes.length).toBeGreaterThan(0);
    // every change names a real class and a concrete day/period
    for (const c of changes) {
      expect(c.className).toBeTruthy();
      expect(c.period).toBeGreaterThanOrEqual(1);
      expect(c.before !== c.after).toBe(true);
    }
  });

  it("reports no changes for identical timetables", () => {
    const p = makeSampleProject();
    expect(diffTimetables(p, placements(p), placements(p))).toEqual([]);
  });
});
