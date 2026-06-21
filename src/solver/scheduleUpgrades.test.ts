// M-F: tests for the two in-browser search upgrades added to solve():
//   1. Contention-directed gap ordering (fewest-teachers-first).
//   2. Min-conflicts soft improvement pass (relocates soft-violated lessons).
//   3. PROVE_UNIT_LIMIT raised from 18 to 25.

import { describe, expect, it } from "vitest";
import { totalShortfall } from "../domain/coverage";
import { validate } from "../domain/validate";
import type { Constraint, Profile, Project, Qualification, Requirement, SchoolClass, Subject, Teacher, TimetableEvent } from "../domain/types";
import { fill } from "./fill";
import { PROVE_UNIT_LIMIT } from "./deepSearch";
import { solve } from "./schedule";

// ── Fixture helpers ─────────────────────────────────────────────────────────

function mkProfile2(): Profile {
  return {
    id: "prof2",
    name: "Mini2",
    days: ["Mon" as const],
    slots: [
      { index: 0, label: "Assembly", start: "08:00", end: "08:30", teaching: false },
      { index: 1, label: "P1", start: "08:30", end: "09:30", teaching: true },
      { index: 2, label: "P2", start: "09:30", end: "10:30", teaching: true },
    ],
    isDefault: true,
  };
}

function mkProfile3(): Profile {
  return {
    id: "prof3",
    name: "Mini3",
    days: ["Mon" as const],
    slots: [
      { index: 0, label: "Assembly", start: "08:00", end: "08:30", teaching: false },
      { index: 1, label: "P1", start: "08:30", end: "09:30", teaching: true },
      { index: 2, label: "P2", start: "09:30", end: "10:30", teaching: true },
      { index: 3, label: "P3", start: "10:30", end: "11:30", teaching: true },
    ],
    isDefault: true,
  };
}

const mkTeacher = (id: string, name: string, over: Partial<Teacher> = {}): Teacher => ({
  id, name, maxPerDay: 8, maxPerWeek: 40, schedulable: true, unavailable: [], ...over,
});

const mkClass = (id: string, name: string): SchoolClass => ({ id, name, band: "primary" as const });

const mkSubject = (id: string, name: string): Subject => ({
  id, name, bands: ["primary" as const], kind: "academic" as const,
});

const mkReq = (id: string, classId: string, subjectId: string, periodsPerWeek: number): Requirement => ({
  id, classId, subjectId, teacherIds: [], periodsPerWeek,
});

const mkQual = (classId: string, subjectId: string, teacherId: string): Qualification => ({
  classId, subjectId, teacherId,
});

function baseProject(override: Partial<Project> = {}): Project {
  return {
    schemaVersion: 6,
    bundledDataVersion: 0,
    school: { name: "Test School" },
    profiles: [],
    teachers: [],
    classes: [],
    subjects: [],
    rooms: [],
    qualifications: [],
    requirements: [],
    events: [],
    constraints: [],
    electiveGroups: [],
    studentGroups: [],
    timetables: [],
    activeTimetableId: null,
    ...override,
  };
}

// ── Fixtures ─────────────────────────────────────────────────────────────────

/** Project that starts with a Maths lesson pre-placed in the LAST teaching slot (P3).
 *  fill() respects the existing placement (never moves it), so after fill() Maths
 *  is still at P3 — triggering a `subject_not_last` prefer violation.
 *  solve()'s softImprovePass should move Maths to P2 (not last), clearing the violation. */
function softViolationProject(): Project {
  const profile = mkProfile3(); // Mon × {P1(1), P2(2), P3(3)}; slot 3 = last teaching slot

  const teacherM = mkTeacher("tM", "TeacherM"); // teaches Maths (available all slots)
  const teacherS = mkTeacher("tS", "TeacherS"); // teaches Science (available all slots)
  const classA = mkClass("cA", "Class A");

  // The Maths event is pre-placed in the timetable — fill() will count it as already placed.
  // It must exist in project.events so fill() can index it from the placement.
  const mathsEvent: TimetableEvent = {
    id: "evMaths", type: "normal", subjectId: "maths",
    classIds: ["cA"], teacherIds: ["tM"], duration: 1, source: "imported",
  };

  const softConstraint: Constraint = {
    id: "c-soft", template: "subject_not_last",
    scope: "subject" as const, severity: "prefer",
    weight: 1, enabled: true,
    params: { subjectIds: ["maths"], classIds: ["cA"] },
  };

  return baseProject({
    profiles: [profile],
    teachers: [teacherM, teacherS],
    classes: [classA],
    subjects: [mkSubject("maths", "Maths"), mkSubject("sci", "Science")],
    qualifications: [mkQual("cA", "maths", "tM"), mkQual("cA", "sci", "tS")],
    // Requirements tell fill() what demand exists; Maths is already placed so fill()
    // will only place Science (1 period).
    requirements: [mkReq("r-maths", "cA", "maths", 1), mkReq("r-sci", "cA", "sci", 1)],
    events: [mathsEvent], // Science event created dynamically by fill() via ensureEvent
    timetables: [{
      id: "tt", name: "Draft", profileId: "prof3",
      // Maths pre-placed at P3 (last teaching slot) — fill() will not move it.
      placements: [{ eventId: "evMaths", day: "Mon" as const, slot: 3, pinned: false }],
    }],
    constraints: [softConstraint],
    activeTimetableId: "tt",
  });
}

/** Two classes need the same Rare subject taught by a single teacher.
 *  The teacher has exactly 2 teaching slots (one per class). Contention-directed
 *  ordering must still complete with shortfall=0 across multiple seeds. */
function twoClassOneTeacherProject(): Project {
  const profile = mkProfile2(); // Mon × {P1, P2}
  const teacherR = mkTeacher("tR", "Rare");
  const classX = mkClass("cX", "Class X");
  const classY = mkClass("cY", "Class Y");

  return baseProject({
    profiles: [profile],
    teachers: [teacherR],
    classes: [classX, classY],
    subjects: [mkSubject("rare", "Rare")],
    qualifications: [mkQual("cX", "rare", "tR"), mkQual("cY", "rare", "tR")],
    requirements: [mkReq("r-x", "cX", "rare", 1), mkReq("r-y", "cY", "rare", 1)],
    timetables: [{ id: "tt", name: "Draft", profileId: "prof2", placements: [] }],
    activeTimetableId: "tt",
  });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("M-F: PROVE_UNIT_LIMIT raised", () => {
  it("PROVE_UNIT_LIMIT is greater than 18", () => {
    expect(PROVE_UNIT_LIMIT).toBeGreaterThan(18);
  });
});

describe("M-F: solve() determinism", () => {
  it("produces the same result when called twice with the same seed", () => {
    const project = twoClassOneTeacherProject();
    const r1 = solve(project, "tt", { seed: 1, budgetMs: 500 });
    const r2 = solve(project, "tt", { seed: 1, budgetMs: 500 });
    expect(r1.remainingShortfall).toBe(r2.remainingShortfall);
    const tt1 = r1.project.timetables.find((t) => t.id === "tt")!;
    const tt2 = r2.project.timetables.find((t) => t.id === "tt")!;
    const sorted = (ps: typeof tt1.placements) =>
      [...ps].sort((a, b) => a.eventId.localeCompare(b.eventId) || a.day.localeCompare(b.day) || a.slot - b.slot);
    expect(sorted(tt1.placements)).toEqual(sorted(tt2.placements));
  });
});

describe("M-F: contention-directed gap ordering", () => {
  it("solves a two-class one-teacher instance to zero shortfall", () => {
    const project = twoClassOneTeacherProject();
    for (const seed of [1, 2, 3]) {
      const r = solve(project, "tt", { seed, budgetMs: 500 });
      expect(r.remainingShortfall, `seed ${seed}`).toBe(0);
      const tt = r.project.timetables.find((t) => t.id === "tt")!;
      expect(validate(r.project, tt).filter((v) => v.severity === "hard").length, `seed ${seed} hard`).toBe(0);
    }
  });
});

describe("M-F: min-conflicts soft improvement pass", () => {
  it("reduces soft violations vs plain fill on a forced-last-slot fixture", () => {
    const project = softViolationProject();

    // Confirm the precondition: fill() leaves a soft violation (Maths at P3 = last slot).
    const fillResult = fill(project, "tt", { seed: 1 });
    const fillTt = fillResult.project.timetables.find((t) => t.id === "tt")!;
    const fillSoft = validate(fillResult.project, fillTt).filter((v) => v.severity === "soft").length;
    expect(fillSoft, "precondition: fill must leave ≥1 soft violation").toBeGreaterThan(0);

    // solve() should improve soft score without breaking hard constraints or shortfall.
    const solveResult = solve(project, "tt", { seed: 1, budgetMs: 1000 });
    const solveTt = solveResult.project.timetables.find((t) => t.id === "tt")!;
    const solveHard = validate(solveResult.project, solveTt).filter((v) => v.severity === "hard").length;
    const solveSoft = validate(solveResult.project, solveTt).filter((v) => v.severity === "soft").length;

    expect(solveResult.remainingShortfall).toBe(0);
    expect(solveHard).toBe(0);
    expect(solveSoft).toBeLessThan(fillSoft);
  });

  it("never introduces hard violations or increases shortfall during soft improvement", () => {
    // On a tight fixture (no soft constraints), the pass must be a no-op — verify its guards.
    const project = twoClassOneTeacherProject();
    const result = solve(project, "tt", { seed: 1, budgetMs: 500 });
    const tt = result.project.timetables.find((t) => t.id === "tt")!;
    expect(validate(result.project, tt).filter((v) => v.severity === "hard").length).toBe(0);
    expect(result.remainingShortfall).toBe(0);
  });
});

describe("M-F: non-regression", () => {
  it("solve() result is at least as good as fill() result on the contention fixture", () => {
    const project = twoClassOneTeacherProject();
    const fillResult = fill(project, "tt", { seed: 1 });
    const solveResult = solve(project, "tt", { seed: 1, budgetMs: 500 });
    expect(solveResult.remainingShortfall).toBeLessThanOrEqual(
      totalShortfall(fillResult.project, fillResult.project.timetables.find((t) => t.id === "tt")!),
    );
  });
});
