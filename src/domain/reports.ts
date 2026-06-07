// Reports (PURE) — RB7. Every figure is a projection of deriveMaps()/validate(), so the
// reports always reconcile with the live grid (asserted by tests). Plain data the UI
// renders as tables: teacher workload, per-class subject counts, free periods, real clashes.

import { deriveMaps, findProfile, slotKey } from "./derive";
import { allTeacherLoads } from "./insights";
import { teachingSlots } from "./profile";
import { validate } from "./validate";
import type { Id, Project, Timetable, Violation } from "./types";

export interface WorkloadRow {
  teacherId: Id;
  name: string;
  periods: number;
  free: number;
}

/** Teacher workload (periods taught) + free count — straight from insights. */
export function workloadReport(project: Project, timetable: Timetable): WorkloadRow[] {
  return allTeacherLoads(project, timetable).map((l) => ({ teacherId: l.teacherId, name: l.name, periods: l.used, free: l.free }));
}

export interface SubjectCountRow {
  classId: Id;
  name: string;
  counts: { subjectId: Id; subject: string; periods: number }[];
}

/** Per-class weekly count of each subject (periods on the grid). */
export function subjectCountReport(project: Project, timetable: Timetable): SubjectCountRow[] {
  const maps = deriveMaps(project, timetable);
  const subj = new Map(project.subjects.map((s) => [s.id, s.name]));
  return project.classes.map((c) => {
    const tally = new Map<Id, number>();
    // Count every DISTINCT event in each slot — an elective option line legitimately holds
    // more than one (the electives + the dropping group's Study), so per-subject counts can
    // sum to more than the slot count (reconciles with the occupancy recompute).
    for (const occ of maps.classCells.get(c.id)?.values() ?? []) {
      const seen = new Set<Id>();
      for (const o of occ) {
        if (seen.has(o.eventId)) continue;
        seen.add(o.eventId);
        tally.set(o.event.subjectId, (tally.get(o.event.subjectId) ?? 0) + 1);
      }
    }
    const counts = [...tally.entries()]
      .map(([subjectId, periods]) => ({ subjectId, subject: subj.get(subjectId) ?? subjectId, periods }))
      .sort((a, b) => a.subject.localeCompare(b.subject));
    return { classId: c.id, name: c.name, counts };
  });
}

/** Real clashes only (HE1/HE2) — the hard double-bookings, for an at-a-glance report. */
export function clashReport(project: Project, timetable: Timetable): Violation[] {
  return validate(project, timetable).filter((v) => v.severity === "hard" && (v.constraintId === "HE1" || v.constraintId === "HE2"));
}

export interface RoomUseRow {
  roomId: Id;
  name: string;
  periods: number; // distinct events placed in this room across the week
}

/** Room utilisation = distinct placed events that name each room. Empty when no lesson is
 *  assigned to a room (the current data: `roomId` is an optional event field nothing sets
 *  yet — same gap as the deferred `subject_needs_room` constraint in C4). The UI shows an
 *  honest "rooms aren't assigned" note in that case rather than a misleading empty table. */
export function roomUseReport(project: Project, timetable: Timetable): RoomUseRow[] {
  const used = new Map<Id, Set<Id>>(); // roomId -> distinct eventIds
  const eventIndex = new Map(project.events.map((e) => [e.id, e]));
  for (const p of timetable.placements) {
    const ev = eventIndex.get(p.eventId);
    if (!ev?.roomId) continue;
    (used.get(ev.roomId) ?? used.set(ev.roomId, new Set()).get(ev.roomId)!).add(ev.id);
  }
  return project.rooms.map((r) => ({ roomId: r.id, name: r.name, periods: used.get(r.id)?.size ?? 0 }));
}

/** Total empty teaching cells across all classes (the school-wide free-period count). */
export function freeCellCount(project: Project, timetable: Timetable): number {
  const profile = findProfile(project, timetable);
  if (!profile) return 0;
  const maps = deriveMaps(project, timetable);
  const teach = teachingSlots(profile);
  let free = 0;
  for (const c of project.classes) {
    const cells = maps.classCells.get(c.id);
    for (const day of profile.days) for (const slot of teach) if (!cells?.has(slotKey(day, slot))) free++;
  }
  return free;
}
