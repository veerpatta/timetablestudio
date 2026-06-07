// Teacher load & insights (PURE) — RB4. Every number is a projection of deriveMaps()
// occupancy, so the insights view, the load bars, and the clash logic all read the one
// structure. A teacher is "busy" at a slot iff teacherCells has any occupancy there —
// and because deriveMaps collapses a team_block / joint_class to ONE occupancy per
// teacher per slot, the free-teacher finder correctly excludes ELGA and senior-combined
// teachers without any special-casing.

import { deriveMaps, findProfile, slotKey } from "./derive";
import { teachingSlots } from "./profile";
import type { Day, Id, Project, Timetable } from "./types";

export interface TeacherLoadStats {
  teacherId: Id;
  name: string;
  used: number; // teaching periods occupied this week
  available: number; // teaching slots the teacher CAN work (schedulable, not unavailable)
  free: number; // available − used
  perDay: Partial<Record<Day, number>>;
}

export interface LoadBalance {
  min: number;
  max: number;
  avg: number;
  spread: number; // max − min; 0 = perfectly even
}

function countAvailable(project: Project, timetable: Timetable, teacherId: Id): number {
  const profile = findProfile(project, timetable);
  const teacher = project.teachers.find((t) => t.id === teacherId);
  if (!profile || !teacher || !teacher.schedulable) return 0;
  const blocked = new Set(teacher.unavailable.map((u) => `${u.day}#${u.slot}`));
  let n = 0;
  for (const day of profile.days) for (const slot of teachingSlots(profile)) if (!blocked.has(`${day}#${slot}`)) n++;
  return n;
}

/** Load stats for one teacher (from deriveMaps occupancy). */
export function teacherLoad(project: Project, timetable: Timetable, teacherId: Id): TeacherLoadStats {
  const teacher = project.teachers.find((t) => t.id === teacherId);
  const cells = deriveMaps(project, timetable).teacherCells.get(teacherId);
  const perDay: Partial<Record<Day, number>> = {};
  let used = 0;
  if (cells) {
    for (const key of cells.keys()) {
      const day = key.split("#")[0] as Day;
      perDay[day] = (perDay[day] ?? 0) + 1;
      used++;
    }
  }
  const available = countAvailable(project, timetable, teacherId);
  return {
    teacherId,
    name: teacher?.name ?? teacherId,
    used,
    available,
    free: Math.max(0, available - used),
    perDay,
  };
}

/** Load stats for every schedulable teacher, sorted by name. */
export function allTeacherLoads(project: Project, timetable: Timetable): TeacherLoadStats[] {
  return project.teachers
    .filter((t) => t.schedulable)
    .map((t) => teacherLoad(project, timetable, t.id))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Min/max/avg/spread of weekly load across schedulable teachers. */
export function loadBalance(project: Project, timetable: Timetable): LoadBalance {
  const loads = allTeacherLoads(project, timetable).map((l) => l.used);
  if (loads.length === 0) return { min: 0, max: 0, avg: 0, spread: 0 };
  const min = Math.min(...loads);
  const max = Math.max(...loads);
  const avg = loads.reduce((s, n) => s + n, 0) / loads.length;
  return { min, max, avg, spread: max - min };
}

/**
 * The teachers free at (day, slot): schedulable, not unavailable then, and not already
 * in ANY event at that slot (a team_block / joint_class member counts as busy). Returns
 * teacher ids sorted by name. Empty for a non-teaching slot.
 */
export function freeTeachers(project: Project, timetable: Timetable, day: Day, slot: number): Id[] {
  const profile = findProfile(project, timetable);
  if (!profile || !teachingSlots(profile).includes(slot)) return [];
  const maps = deriveMaps(project, timetable);
  const key = slotKey(day, slot);
  return project.teachers
    .filter((t) => t.schedulable)
    .filter((t) => !t.unavailable.some((u) => u.day === day && u.slot === slot))
    .filter((t) => !maps.teacherCells.get(t.id)?.has(key))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((t) => t.id);
}
