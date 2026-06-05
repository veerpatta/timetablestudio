// Pure occupancy stats over a Timetable, shared by the rule engine (domain/rules.ts).
// No DOM/IndexedDB/window. Reconstructs per-class and per-teacher day views from
// placements, expanding blocks and duration-2 lessons via `occupiedPeriods`.

import { buildActivityIndex, occupiedPeriods } from "./derive";
import type { Day, Id, Project, Timetable } from "./types";

/** One occupied cell in a class's day lane. For a block, `subjectId` is the
 * block name and `isBlock` is true (subject rules skip blocks). */
export interface LaneCell {
  subjectId: Id;
  teacherIds: Id[];
  isBlock: boolean;
}

/** classId -> day -> (period -> cell). */
export type ClassLanes = Map<Id, Map<Day, Map<number, LaneCell>>>;

export function buildClassLanes(project: Project, timetable: Timetable): ClassLanes {
  const index = buildActivityIndex(project);
  const lanes: ClassLanes = new Map();
  const cellMap = (classId: Id, day: Day): Map<number, LaneCell> => {
    let byDay = lanes.get(classId);
    if (!byDay) lanes.set(classId, (byDay = new Map()));
    let cells = byDay.get(day);
    if (!cells) byDay.set(day, (cells = new Map()));
    return cells;
  };
  for (const placement of timetable.placements) {
    const a = index.get(placement.activityId);
    if (!a) continue;
    const classIds = a.kind === "block" ? a.classIds : [a.classId];
    const subjectId = a.kind === "block" ? a.name : a.subjectId;
    for (const classId of classIds) {
      for (const period of occupiedPeriods(a, placement.period)) {
        cellMap(classId, placement.day).set(period, {
          subjectId,
          teacherIds: a.teacherIds,
          isBlock: a.kind === "block",
        });
      }
    }
  }
  return lanes;
}

/** teacherId -> day -> sorted period numbers occupied. */
export type TeacherDays = Map<Id, Map<Day, number[]>>;

export function buildTeacherDays(project: Project, timetable: Timetable): TeacherDays {
  const index = buildActivityIndex(project);
  const map: TeacherDays = new Map();
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
  for (const byDay of map.values()) {
    for (const arr of byDay.values()) arr.sort((x, y) => x - y);
  }
  return map;
}

/** Longest run of consecutive integers in a sorted, de-duplicated list. */
export function longestConsecutiveRun(sortedPeriods: number[]): number {
  if (sortedPeriods.length === 0) return 0;
  let best = 1;
  let run = 1;
  for (let i = 1; i < sortedPeriods.length; i++) {
    run = sortedPeriods[i]! === sortedPeriods[i - 1]! + 1 ? run + 1 : 1;
    if (run > best) best = run;
  }
  return best;
}
