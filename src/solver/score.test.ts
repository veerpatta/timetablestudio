import { describe, it, expect } from "vitest";
import { scoreTimetable, HARD_PENALTY, type SoftWeights } from "./score";
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

  it("changing soft weights flips candidate ranking deterministically (M4 AC)", () => {
    // Minimal 1-class, 1-teacher project. Teacher T qualified for X and Y.
    const project: Project = {
      schemaVersion: 1,
      school: { name: "w" },
      teachers: [
        { id: "T", name: "T", subjects: ["X", "Y"], maxPeriodsPerDay: 6, maxPeriodsPerWeek: 36, unavailable: [] },
      ],
      classes: [{ id: "c1", name: "Class 1", group: "primary" }],
      subjects: [
        { id: "X", name: "X" },
        { id: "Y", name: "Y" },
      ],
      profiles: [
        { id: "pf", name: "pf", days: ["Mon"], periods: Array.from({ length: 6 }, (_, i) => ({ label: `P${i + 1}`, start: "", end: "" })) },
      ],
      activities: [lesson("x1", "c1", "X", ["T"]), lesson("x2", "c1", "X", ["T"]), lesson("y1", "c1", "Y", ["T"])],
      requirements: { curriculum: [], blocks: [] },
      timetables: [
        // A: X@P1, Y@P3 → teacher gap at P2 (S1=1), no clustering (S2=0)
        { id: "A", name: "A", profileId: "pf", placements: [place("x1", "Mon", 1), place("y1", "Mon", 3)] },
        // B: X@P1, X@P2 → subject X clustered (S2=1), no gap (S1=0)
        { id: "B", name: "B", profileId: "pf", placements: [place("x1", "Mon", 1), place("x2", "Mon", 2)] },
      ],
      activeTimetableId: "A",
    };
    const A = project.timetables[0]!;
    const B = project.timetables[1]!;
    const favorS1: SoftWeights = { S1: 100, S2: 1, S3: 1, S4: 1, S5: 1, S6: 1 };
    const favorS2: SoftWeights = { S1: 1, S2: 100, S3: 1, S4: 1, S5: 1, S6: 1 };

    // Under heavy S1 weight, the gappy A scores worse than the clustered B.
    expect(scoreTimetable(project, A, favorS1).score).toBeGreaterThan(
      scoreTimetable(project, B, favorS1).score,
    );
    // Under heavy S2 weight, the ranking flips.
    expect(scoreTimetable(project, B, favorS2).score).toBeGreaterThan(
      scoreTimetable(project, A, favorS2).score,
    );
  });
});
