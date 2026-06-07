// Substitution planner (PURE) — RB8. When a teacher is away, who can cover each of their
// lessons? A valid cover is a teacher who is FREE at that slot (insights.freeTeachers —
// already excludes anyone busy / unavailable / non-schedulable, including the absent
// teacher) AND qualified for EVERY (subject, class) the lesson spans. Same legality bar as
// the editor: a suggested cover can never clash or be unqualified.
//
// Limit (documented): a team_block (ELGA) shares many teachers and v6 doesn't track which
// teacher↔which class inside the block, so block lessons are flagged "arrange by hand"
// rather than auto-covered.

import { deriveMaps, findProfile, slotKey } from "./derive";
import { freeTeachers } from "./insights";
import type { Day, Id, Project, Timetable } from "./types";

/** Teachers who can cover the absent teacher's lesson at (day, slot): free AND qualified. */
export function coverOptions(project: Project, timetable: Timetable, absentTeacherId: Id, day: Day, slot: number): Id[] {
  const maps = deriveMaps(project, timetable);
  const event = maps.teacherCells.get(absentTeacherId)?.get(slotKey(day, slot))?.[0]?.event;
  if (!event) return [];
  const quals = new Set(project.qualifications.map((q) => `${q.teacherId}#${q.subjectId}#${q.classId}`));
  return freeTeachers(project, timetable, day, slot).filter((tid) =>
    event.classIds.every((c) => quals.has(`${tid}#${event.subjectId}#${c}`)),
  );
}

export interface SubPlanRow {
  day: Day;
  slot: number;
  subjectId: Id;
  classIds: Id[];
  isBlock: boolean; // team_block — cover by hand
  covers: Id[];
}

/** Every lesson the teacher has (optionally on one day), each with its cover options. */
export function absentTeacherPlan(project: Project, timetable: Timetable, teacherId: Id, day?: Day): SubPlanRow[] {
  const profile = findProfile(project, timetable);
  if (!profile) return [];
  const maps = deriveMaps(project, timetable);
  const cells = maps.teacherCells.get(teacherId);
  if (!cells) return [];

  const rows: SubPlanRow[] = [];
  for (const [key, occ] of cells) {
    const [d, s] = key.split("#");
    const dy = d as Day;
    if (day && dy !== day) continue;
    const event = occ[0]?.event;
    if (!event) continue;
    rows.push({
      day: dy,
      slot: Number(s),
      subjectId: event.subjectId,
      classIds: event.classIds,
      isBlock: event.type === "team_block",
      covers: event.type === "team_block" ? [] : coverOptions(project, timetable, teacherId, dy, Number(s)),
    });
  }
  const order: Day[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  rows.sort((a, b) => order.indexOf(a.day) - order.indexOf(b.day) || a.slot - b.slot);
  return rows;
}
