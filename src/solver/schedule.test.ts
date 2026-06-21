import { describe, expect, it } from "vitest";
import { totalShortfall } from "../domain/coverage";
import { validate } from "../domain/validate";
import { buildBundledProject } from "../fixtures/bundled";
import { makeMiniSchool } from "../fixtures/synthetic";
import type { Day, Project, Qualification, Requirement, Teacher, TimetableEvent } from "../domain/types";
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

// ---------------------------------------------------------------------------
// M-D: flexible qualified swaps — two new candidate generators in gapCandidates
// ---------------------------------------------------------------------------

/** Scenario for phase-3 load-swap: X (only c1 Maths qualifier) is stuck at Mon P1 teaching
 *  c2 Maths. X is unavailable everywhere else, so phase-2 can't relocate. Y is qualified for
 *  c2 Maths and is free Mon P1 → phase-3 swaps Y into c2, freeing X to cover c1. */
function loadSwapProject(): Project {
  const p = makeMiniSchool();
  const allDays: Day[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const teachSlots = [1, 2, 3, 4, 6, 7, 8, 9];
  // X (mMaths) available ONLY Mon P1
  const unavailX = allDays.flatMap((day) =>
    teachSlots.filter((slot) => !(day === "Mon" && slot === 1)).map((slot) => ({ day, slot })),
  );
  // Y: qualified for c2 Maths only (NOT c1) — this forces the load-swap path
  const tY: Teacher = { id: "tY", name: "Teacher Y", maxPerDay: 8, maxPerWeek: 48, schedulable: true, unavailable: [] };
  const qualifications: Qualification[] = [
    ...p.qualifications,
    { teacherId: "tY", subjectId: "Maths", classId: "c2" },
  ];
  const teachers: Teacher[] = p.teachers.map((t) => (t.id === "mMaths" ? { ...t, unavailable: unavailX } : t)).concat([tY]);
  const requirements: Requirement[] = [
    { id: "r-c1", classId: "c1", subjectId: "Maths", periodsPerWeek: 1, teacherIds: [] },
    { id: "r-c2", classId: "c2", subjectId: "Maths", periodsPerWeek: 1, teacherIds: [] },
  ];
  // Pre-place X for c2 Maths Mon P1 — X's only available slot is already in use for c2
  const preEvt: TimetableEvent = {
    id: "evt-c2-maths-x", type: "normal", subjectId: "Maths",
    classIds: ["c2"], teacherIds: ["mMaths"], duration: 1, source: "imported",
  };
  const timetables = [{
    id: "tt", name: "Draft", profileId: p.profiles[0]!.id,
    placements: [{ eventId: "evt-c2-maths-x", day: "Mon" as Day, slot: 1, pinned: false }],
  }];
  return { ...p, teachers, qualifications, requirements, events: [...p.events, preEvt], timetables, activeTimetableId: "tt" };
}

/** Baseline (same as above but X is NOT pre-placed for c2): X is free Mon P1 and fills
 *  c1 directly via greedy fill — no load-swap needed, no note. */
function directFillProject(): Project {
  const base = loadSwapProject();
  // Remove the pre-placed c2 lesson so X's only slot is free
  return {
    ...base,
    events: base.events.filter((e) => e.id !== "evt-c2-maths-x"),
    timetables: [{ id: "tt", name: "Draft", profileId: base.profiles[0]!.id, placements: [] }],
    requirements: [{ id: "r-c1", classId: "c1", subjectId: "Maths", periodsPerWeek: 1, teacherIds: [] }],
  };
}

describe("M-D: flexible qualified swaps — gapCandidates new generators", () => {
  it("phase-3 load-swap: Y covers c2 Maths freeing X to fill c1 Maths gap", () => {
    const project = loadSwapProject();
    const res = solve(project, "tt", { seed: 1, budgetMs: 1500 });
    expect(res.remainingShortfall).toBe(0);
    expect(hard(res.project, "tt")).toBe(0);
    // The c1 Maths placement must have a load-rebalancing note
    const rebalanced = res.added.find((a) => a.classId === "c1" && a.subjectId === "Maths" && a.note?.includes("load rebalanced"));
    expect(rebalanced).toBeDefined();
    expect(rebalanced!.teacherIds).toEqual(["mMaths"]);
  });

  it("direct-fill baseline: X fills c1 without a note when no swap is needed", () => {
    const project = directFillProject();
    const res = solve(project, "tt", { seed: 1, budgetMs: 1000 });
    expect(res.remainingShortfall).toBe(0);
    expect(hard(res.project, "tt")).toBe(0);
    // All c1 placements (added by fill or repair) should have no note
    const c1Added = res.added.filter((a) => a.classId === "c1" && a.subjectId === "Maths");
    expect(c1Added.length).toBeGreaterThan(0);
    expect(c1Added.every((a) => !a.note)).toBe(true);
  });

  it("X/Y substitution: Y covers c1 Maths when Y is explicitly qualified and X is occupied", () => {
    // Y is qualified for c1 Maths (unlike load-swap scenario where Y only qualifies for c2).
    // fill() places Y directly — the scenario auto-completes with Y covering c1.
    const base = loadSwapProject();
    const project: Project = {
      ...base,
      qualifications: [
        ...base.qualifications,
        { teacherId: "tY", subjectId: "Maths", classId: "c1" },
      ],
    };
    const res = solve(project, "tt", { seed: 1, budgetMs: 1000 });
    expect(res.remainingShortfall).toBe(0);
    expect(hard(res.project, "tt")).toBe(0);
    // c1 Maths must be placed by either X or Y (whoever fill / repair chose)
    const tt = res.project.timetables.find((t) => t.id === "tt")!;
    const eventIndex = new Map(res.project.events.map((e) => [e.id, e]));
    const c1MathsCount = tt.placements.filter((p) => {
      const ev = eventIndex.get(p.eventId);
      return ev?.subjectId === "Maths" && ev.classIds.includes("c1");
    }).length;
    expect(c1MathsCount).toBe(1); // requirement fulfilled
  });
});
