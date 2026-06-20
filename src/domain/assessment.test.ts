import { describe, expect, it } from "vitest";
import { assessTimetable } from "./assessment";
import { requirementCoverage } from "./coverage";
import { deriveMaps } from "./derive";
import { buildRegularProfile, REGULAR_PROFILE_ID } from "./profile";
import type { Project, Timetable } from "./types";
import { makeMiniSchool } from "../fixtures/synthetic";

// --- helpers ---

function withReqs(project: Project, reqs: Project["requirements"]): Project {
  return { ...project, requirements: reqs };
}

// --- Coverage ---

describe("assessTimetable — coverage", () => {
  it("advantage when all requirements are satisfied (empty requirements)", () => {
    const project = withReqs(makeMiniSchool(), []);
    const a = assessTimetable(project, "tt");
    expect(a.advantages.some((h) => h.dimension === "coverage")).toBe(true);
    expect(a.disadvantages.some((h) => h.dimension === "coverage")).toBe(false);
  });

  it("disadvantage names class and subject when a gap exists", () => {
    const project = withReqs(makeMiniSchool(), [
      { id: "r1", classId: "c1", subjectId: "Maths", teacherIds: ["mMaths"], periodsPerWeek: 3 },
    ]);
    const a = assessTimetable(project, "tt");
    const dis = a.disadvantages.find((h) => h.dimension === "coverage");
    expect(dis).toBeDefined();
    expect(dis!.message).toMatch(/Maths/);
    expect(dis!.message).toMatch(/Class 1/);
    expect(dis!.entityRefs.some((r) => r.type === "class" && r.id === "c1")).toBe(true);
    expect(dis!.entityRefs.some((r) => r.type === "subject" && r.id === "Maths")).toBe(true);
  });

  it("property: shortfall in disadvantage matches requirementCoverage directly", () => {
    const project = withReqs(makeMiniSchool(), [
      { id: "r1", classId: "c1", subjectId: "Maths", teacherIds: ["mMaths"], periodsPerWeek: 4 },
    ]);
    const timetable = project.timetables.find((t) => t.id === "tt")!;

    // Independent oracle — one level below assessTimetable (which calls coverageGaps)
    const cov = requirementCoverage(project, timetable);
    const gap = cov.find((c) => c.classId === "c1" && c.subjectId === "Maths");
    expect(gap?.short).toBe(4); // 4 required, 0 placed → 4 short

    // assessTimetable should report the same number
    const a = assessTimetable(project, "tt");
    const dis = a.disadvantages.find((h) => h.dimension === "coverage");
    expect(dis).toBeDefined();
    expect(dis!.message).toMatch(/4/);
  });
});

// --- Teacher fairness ---

// Produces a project where the 5 primary teachers get many periods
// and pEng/mMaths get 0, creating a large fairness spread.
function makeImbalancedProject(): Project {
  const profile = buildRegularProfile();
  const placements = profile.days
    .slice(0, 5)
    .map((day) => ({ eventId: "evt-elga", day, slot: 1, pinned: false }));
  return {
    ...makeMiniSchool(),
    timetables: [{ id: "tt", name: "Draft", profileId: REGULAR_PROFILE_ID, placements }],
    activeTimetableId: "tt",
  };
}

describe("assessTimetable — teacherFairness", () => {
  it("advantage when all loads are equal (empty timetable)", () => {
    const project = makeMiniSchool();
    const a = assessTimetable(project, "tt");
    expect(a.advantages.some((h) => h.dimension === "teacherFairness")).toBe(true);
    expect(a.disadvantages.some((h) => h.dimension === "teacherFairness")).toBe(false);
  });

  it("disadvantage when loads are imbalanced — names the high and low teachers", () => {
    const project = makeImbalancedProject();
    const a = assessTimetable(project, "tt");
    const dis = a.disadvantages.find((h) => h.dimension === "teacherFairness");
    expect(dis).toBeDefined();
    // Message must name at least one teacher
    const teacherNames = project.teachers.map((t) => t.name);
    expect(teacherNames.some((name) => dis!.message.includes(name))).toBe(true);
    // EntityRefs must point to teachers
    expect(dis!.entityRefs.some((r) => r.type === "teacher")).toBe(true);
  });

  it("property: min/max in disadvantage message match deriveMaps cell counts directly", () => {
    const project = makeImbalancedProject();
    const timetable = project.timetables.find((t) => t.id === "tt")!;

    // Independent oracle — count teacher cells directly from deriveMaps
    const maps = deriveMaps(project, timetable);
    const periodCounts = project.teachers
      .filter((t) => t.schedulable)
      .map((t) => maps.teacherCells.get(t.id)?.size ?? 0);
    const indMax = Math.max(...periodCounts);
    const indMin = Math.min(...periodCounts);

    const a = assessTimetable(project, "tt");
    const dis = a.disadvantages.find((h) => h.dimension === "teacherFairness");
    expect(dis).toBeDefined();
    // The message must contain the exact max and min from the independent oracle
    expect(dis!.message).toMatch(new RegExp(`\\b${indMax}\\b`));
    expect(dis!.message).toMatch(new RegExp(`\\b${indMin}\\b`));
  });

  it("overloaded teacher surfaces as a disadvantage with correct entity ref", () => {
    // The primary teachers (bindu etc.) have high loads; mMaths (Nidhika) has 0.
    const project = makeImbalancedProject();
    const a = assessTimetable(project, "tt");
    const dis = a.disadvantages.find((h) => h.dimension === "teacherFairness");
    expect(dis).toBeDefined();
    // entityRefs must include the low-load teacher (mMaths = Nidhika) or the high-load one
    const refs = dis!.entityRefs.map((r) => r.id);
    const teacherIds = project.teachers.filter((t) => t.schedulable).map((t) => t.id);
    expect(refs.some((id) => teacherIds.includes(id))).toBe(true);
  });
});

// --- Stability ---

describe("assessTimetable — stability", () => {
  it("omits stability highlights when no baseline is provided", () => {
    const project = makeMiniSchool();
    const a = assessTimetable(project, "tt");
    expect(a.advantages.some((h) => h.dimension === "stability")).toBe(false);
    expect(a.disadvantages.some((h) => h.dimension === "stability")).toBe(false);
  });

  it("adds stability advantage when baseline matches current timetable exactly", () => {
    const project = makeMiniSchool();
    const timetable = project.timetables.find((t) => t.id === "tt")!;
    const a = assessTimetable(project, "tt", { baseline: timetable });
    const adv = a.advantages.find((h) => h.dimension === "stability");
    expect(adv).toBeDefined();
    expect(adv!.message).toMatch(/0.*cell|identical|zero/i);
  });

  it("adds stability disadvantage when baseline differs by many cells", () => {
    const profile = buildRegularProfile();
    // Baseline: empty; current: 5 team-block placements → large diff
    const baseline: Timetable = {
      id: "baseline-id",
      name: "Baseline",
      profileId: REGULAR_PROFILE_ID,
      placements: [],
    };
    const placements = profile.days
      .slice(0, 5)
      .map((day) => ({ eventId: "evt-elga", day, slot: 1, pinned: false }));
    const project: Project = {
      ...makeMiniSchool(),
      timetables: [{ id: "tt", name: "Draft", profileId: REGULAR_PROFILE_ID, placements }],
      activeTimetableId: "tt",
    };
    const a = assessTimetable(project, "tt", { baseline });
    // 5 placements × 5 classes × 3 slots each = 75 changed cells → disadvantage
    const dis = a.disadvantages.find((h) => h.dimension === "stability");
    expect(dis).toBeDefined();
    expect(dis!.message).toMatch(/\d+\s+cells?/);
  });
});

// --- Board protection ---

describe("assessTimetable — boardProtection", () => {
  it("skips board-protection dimension when no board classes exist", () => {
    const project = makeMiniSchool(); // no class has isBoardClass=true
    const a = assessTimetable(project, "tt");
    expect(a.advantages.some((h) => h.dimension === "boardProtection")).toBe(false);
    expect(a.disadvantages.some((h) => h.dimension === "boardProtection")).toBe(false);
  });

  it("advantage when board class has no academic subjects in late slots", () => {
    // Board class with an academic subject placed in P1 (slot 1, early) — no late placement
    const boardEvent = {
      id: "evt-board",
      type: "normal" as const,
      subjectId: "Maths",
      classIds: ["c1"],
      teacherIds: ["mMaths"],
      duration: 1,
      source: "imported" as const,
    };
    const project: Project = {
      ...makeMiniSchool(),
      classes: makeMiniSchool().classes.map((c) => (c.id === "c1" ? { ...c, isBoardClass: true } : c)),
      events: [...makeMiniSchool().events, boardEvent],
      requirements: [{ id: "r1", classId: "c1", subjectId: "Maths", teacherIds: ["mMaths"], periodsPerWeek: 1 }],
      timetables: [
        {
          id: "tt",
          name: "Draft",
          profileId: REGULAR_PROFILE_ID,
          // slot 1 = P1 (early) — not in the last quarter
          placements: [{ eventId: "evt-board", day: "Mon", slot: 1, pinned: false }],
        },
      ],
    };
    const a = assessTimetable(project, "tt");
    expect(a.advantages.some((h) => h.dimension === "boardProtection")).toBe(true);
    expect(a.disadvantages.some((h) => h.dimension === "boardProtection")).toBe(false);
  });

  it("disadvantage when board class academic subject is in a late period", () => {
    const boardEvent = {
      id: "evt-board",
      type: "normal" as const,
      subjectId: "Maths",
      classIds: ["c1"],
      teacherIds: ["mMaths"],
      duration: 1,
      source: "imported" as const,
    };
    const project: Project = {
      ...makeMiniSchool(),
      classes: makeMiniSchool().classes.map((c) => (c.id === "c1" ? { ...c, isBoardClass: true } : c)),
      events: [...makeMiniSchool().events, boardEvent],
      requirements: [{ id: "r1", classId: "c1", subjectId: "Maths", teacherIds: ["mMaths"], periodsPerWeek: 1 }],
      timetables: [
        {
          id: "tt",
          name: "Draft",
          profileId: REGULAR_PROFILE_ID,
          // slot 9 = P8 (last period — in the last quarter)
          placements: [{ eventId: "evt-board", day: "Mon", slot: 9, pinned: false }],
        },
      ],
    };
    const a = assessTimetable(project, "tt");
    expect(a.disadvantages.some((h) => h.dimension === "boardProtection")).toBe(true);
    const dis = a.disadvantages.find((h) => h.dimension === "boardProtection")!;
    expect(dis.message).toMatch(/Maths/);
    expect(dis.entityRefs.some((r) => r.type === "class" && r.id === "c1")).toBe(true);
  });
});

// --- Score and band ---

describe("assessTimetable — score and band", () => {
  it("returns score 100 when no requirements exist and timetable is empty", () => {
    const project = withReqs(makeMiniSchool(), []);
    const a = assessTimetable(project, "tt");
    expect(a.score).toBe(100);
    expect(a.band).toBe("Great");
  });

  it("penalises coverage gaps — score drops below 100", () => {
    const project = withReqs(makeMiniSchool(), [
      { id: "r1", classId: "c1", subjectId: "Maths", teacherIds: ["mMaths"], periodsPerWeek: 1 },
    ]);
    const a = assessTimetable(project, "tt");
    expect(a.score).toBeLessThan(100);
  });

  it("band matches score range", () => {
    const project = withReqs(makeMiniSchool(), []);
    const a = assessTimetable(project, "tt");
    expect(["Great", "Good", "Fair", "Poor"]).toContain(a.band);
    if (a.score >= 80) expect(a.band).toBe("Great");
    else if (a.score >= 60) expect(a.band).toBe("Good");
    else if (a.score >= 40) expect(a.band).toBe("Fair");
    else expect(a.band).toBe("Poor");
  });

  it("summary is a non-empty string", () => {
    const project = makeMiniSchool();
    const a = assessTimetable(project, "tt");
    expect(typeof a.summary).toBe("string");
    expect(a.summary.length).toBeGreaterThan(0);
  });
});

// --- Message cleanliness ---

describe("assessTimetable — messages", () => {
  it("no highlight message contains a constraint code (HE1, R4, etc.)", () => {
    const project = withReqs(makeMiniSchool(), [
      { id: "r1", classId: "c1", subjectId: "Maths", teacherIds: ["mMaths"], periodsPerWeek: 2 },
    ]);
    const a = assessTimetable(project, "tt");
    const allMessages = [...a.advantages, ...a.disadvantages].map((h) => h.message);
    for (const msg of allMessages) {
      expect(msg).not.toMatch(/\bHE\d+\b/);
      expect(msg).not.toMatch(/\bR\d+\b/);
    }
  });

  it("advantages and disadvantages are sorted by weight descending", () => {
    const project = withReqs(makeMiniSchool(), [
      { id: "r1", classId: "c1", subjectId: "Maths", teacherIds: ["mMaths"], periodsPerWeek: 2 },
      { id: "r2", classId: "c2", subjectId: "Maths", teacherIds: ["mMaths"], periodsPerWeek: 3 },
    ]);
    const a = assessTimetable(project, "tt");
    for (let i = 1; i < a.disadvantages.length; i++) {
      expect(a.disadvantages[i]!.weight).toBeLessThanOrEqual(a.disadvantages[i - 1]!.weight);
    }
    for (let i = 1; i < a.advantages.length; i++) {
      expect(a.advantages[i]!.weight).toBeLessThanOrEqual(a.advantages[i - 1]!.weight);
    }
  });
});
