import { describe, it, expect } from "vitest";
import { solve } from "./engine";
import { validate } from "../domain/validate";
import { normalizeProject } from "../domain/requirements";
import { makeSampleProject } from "../store/projectStore";
import type { Project, Timetable } from "../domain/types";

const active = (p: Project): Timetable =>
  p.timetables.find((t) => t.id === p.activeTimetableId)!;

/** Normalize the sample, then deterministically clear ~30% of non-pinned cells. */
function clearedProject(): { project: Project; clearedCount: number } {
  const norm = normalizeProject(makeSampleProject(), makeSampleProject().activeTimetableId!);
  const tt = active(norm);
  const lessons = tt.placements.filter((p) => !p.pinned);
  const removed = new Set<number>();
  // every 3rd non-pinned placement (deterministic, no Math.random)
  lessons.forEach((_, i) => {
    if (i % 3 === 0) removed.add(i);
  });
  let li = -1;
  const kept = tt.placements.filter((p) => {
    if (p.pinned) return true;
    li++;
    return !removed.has(li);
  });
  tt.placements = kept;
  return { project: norm, clearedCount: removed.size };
}

const withPlacements = (p: Project, placements: Timetable["placements"]): Project => ({
  ...p,
  timetables: p.timetables.map((t) =>
    t.id === p.activeTimetableId ? { ...t, placements } : t,
  ),
});

describe("solver — M3 auto-complete", () => {
  it("normalized sample is feasible to begin with", () => {
    const norm = normalizeProject(makeSampleProject(), makeSampleProject().activeTimetableId!);
    expect(validate(norm, active(norm))).toEqual([]);
  });

  it("completes a 30%-cleared timetable to 0 hard violations in < 5s (seed fixed)", () => {
    const { project, clearedCount } = clearedProject();
    expect(clearedCount).toBeGreaterThan(0);
    // sanity: clearing removed real placements (shortfall exists)
    const result = solve(project, project.activeTimetableId!, {
      mode: "complete",
      seed: 12345,
      maxMillis: 5000,
    });
    expect(result.complete).toBe(true);
    expect(result.millis).toBeLessThan(5000);
    // HONEST ORACLE: run the real validator on the solver's output.
    const finalProject = withPlacements(project, result.placements);
    const hard = validate(finalProject, active(finalProject)).filter((v) => v.severity === "hard");
    expect(hard).toEqual([]);
    expect(result.feasible).toBe(true);
  });

  it("is deterministic: same seed → identical placements", () => {
    const a = clearedProject().project;
    const b = clearedProject().project;
    const ra = solve(a, a.activeTimetableId!, { mode: "complete", seed: 999, maxMillis: 5000 });
    const rb = solve(b, b.activeTimetableId!, { mode: "complete", seed: 999, maxMillis: 5000 });
    expect(ra.placements).toEqual(rb.placements);
  });

  it("cancel returns promptly without throwing and reports incomplete", () => {
    const { project } = clearedProject();
    const result = solve(project, project.activeTimetableId!, {
      mode: "complete",
      seed: 7,
      maxMillis: 5000,
      shouldCancel: () => true,
    });
    expect(result.complete).toBe(false);
    // base placements (pinned ELGA + kept lessons) are still returned
    expect(result.placements.length).toBeGreaterThan(0);
  });

  it("preserves all pinned placements (H10): ELGA block untouched", () => {
    const { project } = clearedProject();
    const pinnedBefore = active(project).placements.filter((p) => p.pinned);
    const result = solve(project, project.activeTimetableId!, {
      mode: "complete",
      seed: 1,
      maxMillis: 5000,
    });
    for (const pin of pinnedBefore) {
      expect(
        result.placements.some(
          (p) => p.activityId === pin.activityId && p.day === pin.day && p.period === pin.period,
        ),
      ).toBe(true);
    }
  });
});
