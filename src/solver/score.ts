// Scoring. PURE. score = Σ hard×10000 + Σ soft×weight (CONSTRAINTS.md §Scoring).
// Lower is better; feasible iff hard === 0. Soft violations (S1–S6) are also
// returned as Violation[] (severity "soft") for amber badges / candidate compare.

import { buildActivityIndex, occupiedPeriods } from "../domain/derive";
import { validate } from "../domain/validate";
import type { Day, Id, Project, Timetable, Violation } from "../domain/types";

export const HARD_PENALTY = 10_000;

export type SoftWeights = Record<"S1" | "S2" | "S3" | "S4" | "S5" | "S6", number>;

export const DEFAULT_WEIGHTS: SoftWeights = { S1: 5, S2: 4, S3: 3, S4: 3, S5: 2, S6: 2 };

/** Subjects preferred early (S3). Names, case-insensitive. Owner-tunable later. */
const HEAVY_SUBJECTS = new Set(["maths", "math", "mathematics", "science", "physics", "chemistry"]);

interface Lane {
  // per (rowId, day): the period -> {subjectId, teacherId-set, isBlock}
  cells: Map<number, { subjectId: Id; teacherIds: Id[]; isBlock: boolean }>;
}

function buildClassDayLanes(project: Project, timetable: Timetable) {
  const index = buildActivityIndex(project);
  // classId -> day -> Lane
  const lanes = new Map<Id, Map<Day, Lane>>();
  const laneOf = (classId: Id, day: Day): Lane => {
    let byDay = lanes.get(classId);
    if (!byDay) lanes.set(classId, (byDay = new Map()));
    let lane = byDay.get(day);
    if (!lane) byDay.set(day, (lane = { cells: new Map() }));
    return lane;
  };
  for (const placement of timetable.placements) {
    const a = index.get(placement.activityId);
    if (!a) continue;
    const classIds = a.kind === "block" ? a.classIds : [a.classId];
    const subjectId = a.kind === "block" ? a.name : a.subjectId;
    for (const classId of classIds) {
      for (const period of occupiedPeriods(a, placement.period)) {
        laneOf(classId, placement.day).cells.set(period, {
          subjectId,
          teacherIds: a.teacherIds,
          isBlock: a.kind === "block",
        });
      }
    }
  }
  return lanes;
}

function teacherDayPeriods(project: Project, timetable: Timetable) {
  const index = buildActivityIndex(project);
  const map = new Map<Id, Map<Day, number[]>>();
  const add = (t: Id, day: Day, period: number) => {
    let byDay = map.get(t);
    if (!byDay) map.set(t, (byDay = new Map()));
    const arr = byDay.get(day);
    if (arr) arr.push(period);
    else byDay.set(day, [period]);
  };
  for (const placement of timetable.placements) {
    const a = index.get(placement.activityId);
    if (!a) continue;
    for (const t of new Set(a.teacherIds)) {
      for (const period of occupiedPeriods(a, placement.period)) add(t, placement.day, period);
    }
  }
  return map;
}

function softViolations(
  project: Project,
  timetable: Timetable,
  subjectName: Map<Id, string>,
): Violation[] {
  const out: Violation[] = [];
  const classLanes = buildClassDayLanes(project, timetable);
  const teacherDays = teacherDayPeriods(project, timetable);

  // S1 teacher gaps, S4 week balance
  for (const [teacherId, byDay] of teacherDays) {
    const loads: number[] = [];
    for (const [day, periods] of byDay) {
      const sorted = [...periods].sort((x, y) => x - y);
      const span = sorted[sorted.length - 1]! - sorted[0]! + 1;
      const gaps = span - sorted.length;
      loads.push(sorted.length);
      for (let i = 0; i < gaps; i++) {
        out.push({ constraintId: "S1", severity: "soft", message: `${teacherId} idle gap on ${day}.`, slots: [{ teacherId, day, period: 0 }] });
      }
    }
    if (loads.length > 1) {
      const spread = Math.max(...loads) - Math.min(...loads);
      for (let i = 0; i < spread; i++) {
        out.push({ constraintId: "S4", severity: "soft", message: `${teacherId} uneven daily load.`, slots: [{ teacherId, day: "Mon", period: 0 }] });
      }
    }
  }

  for (const [classId, byDay] of classLanes) {
    // S2 subject spread (same subject >1×/day)
    for (const [day, lane] of byDay) {
      const perSubject = new Map<Id, number>();
      for (const cell of lane.cells.values()) {
        if (cell.isBlock) continue;
        perSubject.set(cell.subjectId, (perSubject.get(cell.subjectId) ?? 0) + 1);
      }
      for (const [subjectId, n] of perSubject) {
        for (let i = 1; i < n; i++) {
          out.push({ constraintId: "S2", severity: "soft", message: `${subjectName.get(subjectId) ?? subjectId} clustered on ${day} for ${classId}.`, slots: [{ classId, day, period: 0 }] });
        }
      }
      // S3 heavy subject late (P4+), S5 triple-repeat subject, S6 triple-repeat teacher
      let runSubject: Id | null = null;
      let runSubjectLen = 0;
      let runTeacher: string | null = null;
      let runTeacherLen = 0;
      const periodsSorted = [...lane.cells.keys()].sort((x, y) => x - y);
      for (const period of periodsSorted) {
        const cell = lane.cells.get(period)!;
        if (!cell.isBlock && HEAVY_SUBJECTS.has((subjectName.get(cell.subjectId) ?? cell.subjectId).toLowerCase()) && period >= 4) {
          out.push({ constraintId: "S3", severity: "soft", message: `Heavy subject late (P${period}) for ${classId} on ${day}.`, slots: [{ classId, day, period }] });
        }
        if (cell.isBlock) {
          runSubject = runTeacher = null;
          runSubjectLen = runTeacherLen = 0;
          continue;
        }
        runSubjectLen = cell.subjectId === runSubject ? runSubjectLen + 1 : 1;
        runSubject = cell.subjectId;
        if (runSubjectLen === 3) {
          out.push({ constraintId: "S5", severity: "soft", message: `3+ consecutive ${subjectName.get(cell.subjectId) ?? cell.subjectId} for ${classId} on ${day}.`, slots: [{ classId, day, period }] });
        }
        const tkey = [...new Set(cell.teacherIds)].sort().join("+");
        runTeacherLen = tkey === runTeacher ? runTeacherLen + 1 : 1;
        runTeacher = tkey;
        if (runTeacherLen === 3) {
          out.push({ constraintId: "S6", severity: "soft", message: `Same teacher 3+ periods for ${classId} on ${day}.`, slots: [{ classId, day, period }] });
        }
      }
    }
  }
  return out;
}

export interface ScoreBreakdown {
  score: number;
  hard: number;
  soft: Violation[];
  violations: Violation[]; // hard + soft
}

export function scoreTimetable(
  project: Project,
  timetable: Timetable,
  weights: SoftWeights = DEFAULT_WEIGHTS,
): ScoreBreakdown {
  const hardViolations = validate(project, timetable);
  const subjectName = new Map(project.subjects.map((s) => [s.id, s.name] as const));
  const soft = softViolations(project, timetable, subjectName);
  const softScore = soft.reduce(
    (sum, v) => sum + (weights[v.constraintId as keyof SoftWeights] ?? 0),
    0,
  );
  const score = hardViolations.length * HARD_PENALTY + softScore;
  return { score, hard: hardViolations.length, soft, violations: [...hardViolations, ...soft] };
}
