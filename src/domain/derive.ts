// Derived selectors over a Timetable. PURE — no DOM/IndexedDB/window.
//
// A Placement references an Activity by id and pins it to (day, startPeriod).
// We "expand" placements into atomic per-(entity, day, period) occupancies so
// validation can detect clashes uniformly. A BlockActivity expands to one class
// occupancy per (class × period in range) and one teacher occupancy per
// (teacher × period in range) — atomicity is structural (AGENTS.md §6, H3).

import type {
  Activity,
  Day,
  Id,
  Placement,
  Project,
  Timetable,
} from "./types";

/** A single class's occupancy of one (day, period) by one placement. */
export interface ClassOccupancy {
  classId: Id;
  day: Day;
  period: number;
  activityId: Id;
  activity: Activity;
  pinned: boolean;
}

/** A single teacher's occupancy of one (day, period) by one placement. */
export interface TeacherOccupancy {
  teacherId: Id;
  day: Day;
  period: number;
  activityId: Id;
  activity: Activity;
  pinned: boolean;
}

/** `${day}#${period}` */
export type SlotKey = string;
export const slotKey = (day: Day, period: number): SlotKey => `${day}#${period}`;

/** The periods a placement occupies: [period] for a lesson, the run for a block. */
export function occupiedPeriods(activity: Activity, startPeriod: number): number[] {
  if (activity.kind === "block") {
    const out: number[] = [];
    for (let p = startPeriod; p < startPeriod + activity.length; p++) out.push(p);
    return out;
  }
  return [startPeriod];
}

export function buildActivityIndex(project: Project): Map<Id, Activity> {
  const index = new Map<Id, Activity>();
  for (const a of project.activities) index.set(a.id, a);
  return index;
}

/** Expand one placement into its class and teacher occupancies. */
export function expandPlacement(
  placement: Placement,
  activity: Activity,
): { classCells: ClassOccupancy[]; teacherCells: TeacherOccupancy[] } {
  const periods = occupiedPeriods(activity, placement.period);
  const classIds = activity.kind === "block" ? activity.classIds : [activity.classId];
  const teacherIds = activity.teacherIds;

  const classCells: ClassOccupancy[] = [];
  for (const classId of classIds) {
    for (const period of periods) {
      classCells.push({
        classId,
        day: placement.day,
        period,
        activityId: activity.id,
        activity,
        pinned: placement.pinned,
      });
    }
  }

  // Teacher occupancy is per (teacher × period), once — independent of class
  // count (an ELGA block occupies each teacher once per period, not 5×).
  const teacherCells: TeacherOccupancy[] = [];
  for (const teacherId of teacherIds) {
    for (const period of periods) {
      teacherCells.push({
        teacherId,
        day: placement.day,
        period,
        activityId: activity.id,
        activity,
        pinned: placement.pinned,
      });
    }
  }

  return { classCells, teacherCells };
}

export interface DerivedMaps {
  /** classId -> slotKey -> occupancies (length > 1 ⇒ H2 class clash). */
  classCells: Map<Id, Map<SlotKey, ClassOccupancy[]>>;
  /** teacherId -> slotKey -> occupancies (length > 1 ⇒ H1 teacher clash). */
  teacherCells: Map<Id, Map<SlotKey, TeacherOccupancy[]>>;
  activityIndex: Map<Id, Activity>;
}

function pushNested<V>(
  map: Map<Id, Map<SlotKey, V[]>>,
  outer: Id,
  key: SlotKey,
  value: V,
): void {
  let inner = map.get(outer);
  if (!inner) {
    inner = new Map();
    map.set(outer, inner);
  }
  const arr = inner.get(key);
  if (arr) arr.push(value);
  else inner.set(key, [value]);
}

/** Build class- and teacher-occupancy maps for a timetable. */
export function deriveMaps(project: Project, timetable: Timetable): DerivedMaps {
  const activityIndex = buildActivityIndex(project);
  const classCells: DerivedMaps["classCells"] = new Map();
  const teacherCells: DerivedMaps["teacherCells"] = new Map();

  for (const placement of timetable.placements) {
    const activity = activityIndex.get(placement.activityId);
    if (!activity) continue; // dangling placement; not derive's job to flag
    const { classCells: cc, teacherCells: tc } = expandPlacement(placement, activity);
    for (const c of cc) pushNested(classCells, c.classId, slotKey(c.day, c.period), c);
    for (const t of tc) pushNested(teacherCells, t.teacherId, slotKey(t.day, t.period), t);
  }

  return { classCells, teacherCells, activityIndex };
}
