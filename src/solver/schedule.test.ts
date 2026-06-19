import { describe, expect, it } from "vitest";
import { totalShortfall } from "../domain/coverage";
import { validate } from "../domain/validate";
import { buildBundledProject } from "../fixtures/bundled";
import { makeMiniSchool } from "../fixtures/synthetic";
import type { Day, Project, Requirement, TimetableEvent } from "../domain/types";
import { fill } from "./fill";
import { solve } from "./schedule";
import { planTimetable } from "./plan";

const hard = (p: Project, ttId: string) => {
  const tt = p.timetables.find((t) => t.id === ttId)!;
  return validate(p, tt).filter((v) => v.severity === "hard").length;
};
const shortfall = (p: Project, ttId: string) => totalShortfall(p, p.timetables.find((t) => t.id === ttId)!);

/** A small instance where one teacher must teach two classes whose only shared free window
 *  forces an eviction-relocation: greedy can paint itself into a corner (fill a class's only
 *  hole with the other class's lesson), and the repair must relocate to complete it. */
function contentionProject(): Project {
  const p = makeMiniSchool();
  // mMaths is qualified for c1 + c2 Maths (synthetic). Make mMaths available ONLY Mon P1/P2.
  const teachers = p.teachers.map((t) =>
    t.id !== "mMaths"
      ? t
      : {
          ...t,
          unavailable: (["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as Day[]).flatMap((day) =>
            [1, 2, 3, 4, 5, 6, 7, 8].filter((slot) => !(day === "Mon" && (slot === 1 || slot === 2))).map((slot) => ({ day, slot })),
          ),
        },
  );
  // Block c1 at Mon P2 with a pinned lesson by a different (qualified-enough) teacher, so c1's
  // only Maths-feasible hole is Mon P1. c2 is free at both Mon P1 and Mon P2.
  const blocker: TimetableEvent = { id: "evt-block-c1", type: "normal", subjectId: "ELGA", classIds: ["c1"], teacherIds: ["bindu"], duration: 1, source: "imported" };
  const reqs: Requirement[] = [
    { id: "r-c1", classId: "c1", subjectId: "Maths", teacherIds: ["mMaths"], periodsPerWeek: 1 },
    { id: "r-c2", classId: "c2", subjectId: "Maths", teacherIds: ["mMaths"], periodsPerWeek: 1 },
  ];
  return {
    ...p,
    teachers,
    requirements: reqs,
    events: [...p.events, blocker],
    timetables: [{ id: "tt", name: "Draft", profileId: p.profiles[0]!.id, placements: [{ eventId: "evt-block-c1", day: "Mon", slot: 2, pinned: true }] }],
    activeTimetableId: "tt",
  };
}

describe("solve (greedy + repair)", () => {
  it("completes a contended instance with no hard violations", () => {
    const project = contentionProject();
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const res = solve(project, "tt", { seed, budgetMs: 1000 });
      expect(res.remainingShortfall, `seed ${seed}`).toBe(0);
      expect(hard(res.project, "tt")).toBe(0);
    }
  });

  it("the repair improves on (never regresses) plain greedy on a hard from-scratch board", () => {
    // Clear every ordinary lesson from the real timetable, then compare greedy vs greedy+repair.
    const bundled = buildBundledProject();
    const ttId = bundled.activeTimetableId!;
    const eventIndex = new Map(bundled.events.map((e) => [e.id, e]));
    const cleared: Project = {
      ...bundled,
      timetables: bundled.timetables.map((t) =>
        t.id !== ttId
          ? t
          : {
              ...t,
              placements: t.placements.filter((p) => {
                const e = eventIndex.get(p.eventId);
                return p.pinned || !e || e.type !== "normal" || e.classIds.length !== 1 || e.duration !== 1 || (e.studentGroupIds?.length ?? 0) > 0;
              }),
            },
      ),
    };
    const greedy = fill(cleared, ttId, { seed: 1 });
    const repaired = solve(cleared, ttId, { seed: 1, budgetMs: 3000 });
    expect(repaired.remainingShortfall).toBeLessThanOrEqual(greedy.remainingShortfall);
    expect(hard(repaired.project, ttId)).toBe(0); // still clash-free
  });

  it("never regresses an already-complete, valid timetable", () => {
    const project = buildBundledProject();
    const ttId = project.activeTimetableId!;
    expect(shortfall(project, ttId)).toBe(0); // precondition
    const res = solve(project, ttId, { seed: 1, budgetMs: 1500 });
    expect(res.remainingShortfall).toBe(0);
    expect(hard(res.project, ttId)).toBe(0);
  });
});

describe("planTimetable preserves a good timetable", () => {
  it("returns the bundled timetable complete and clash-free (no destructive rebuild)", () => {
    const project = buildBundledProject();
    const ttId = project.activeTimetableId!;
    const result = planTimetable(project, ttId, { seeds: 4 });
    expect(result.hardCount).toBe(0);
    expect(result.remainingShortfall).toBe(0); // completeness is preserved, not lost on re-plan
  });
});
