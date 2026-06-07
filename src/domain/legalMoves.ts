// Legal-move computation (PURE) — the heart of the legal-only editor (RB2).
// The picker is built from legalOptions(): it offers ONLY placements that are
// qualified, available, and clash-free, so an illegal cell can never be created.
// Implements the legal-move rule from docs/DATA_MODEL.md § v6.
//
// Qualifications are exactly the (teacher, subject, class) triples the school uses,
// so options here are real legal PLACEMENTS for this class — not invented teachers.

import { deriveMaps, slotKey } from "./derive";
import { isTeachingSlot } from "./profile";
import { findProfile } from "./derive";
import type { Day, Id, Project, Timetable } from "./types";

export interface Candidate {
  subjectId: Id;
  teacherIds: Id[]; // one teacher for a normal lesson
  label: string; // "Maths — Bindu" for the picker
}

function getTimetable(project: Project, timetableId: Id): Timetable | undefined {
  return project.timetables.find((t) => t.id === timetableId);
}

/**
 * The legal single-lesson options for (classId, day, slot): every (subject, teacher)
 * the class is qualified for whose teacher is schedulable, available, and not already
 * busy with a DIFFERENT event in that slot. Replacing the class's current cell is fine
 * (its own occupants are ignored). Returns [] for non-teaching slots.
 */
export function legalOptions(
  project: Project,
  timetableId: Id,
  classId: Id,
  day: Day,
  slot: number,
): Candidate[] {
  const tt = getTimetable(project, timetableId);
  const profile = tt && findProfile(project, tt);
  if (!tt || !profile || !isTeachingSlot(profile, slot)) return [];

  const maps = deriveMaps(project, tt);
  const teacherMap = new Map(project.teachers.map((t) => [t.id, t]));
  const subjectName = new Map(project.subjects.map((s) => [s.id, s.name]));
  const teacherName = new Map(project.teachers.map((t) => [t.id, t.name]));

  // The event(s) this class currently has here are being replaced → ignore them.
  const here = slotKey(day, slot);
  const ignore = new Set((maps.classCells.get(classId)?.get(here) ?? []).map((o) => o.eventId));

  const teacherBusy = (teacherId: Id): boolean =>
    (maps.teacherCells.get(teacherId)?.get(here) ?? []).some((o) => !ignore.has(o.eventId));

  const seen = new Set<string>();
  const out: Candidate[] = [];
  for (const q of project.qualifications) {
    if (q.classId !== classId) continue;
    const teacher = teacherMap.get(q.teacherId);
    if (!teacher || !teacher.schedulable) continue;
    if (teacher.unavailable.some((u) => u.day === day && u.slot === slot)) continue;
    if (teacherBusy(q.teacherId)) continue;
    const key = `${q.subjectId}#${q.teacherId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      subjectId: q.subjectId,
      teacherIds: [q.teacherId],
      label: `${subjectName.get(q.subjectId) ?? q.subjectId} — ${teacherName.get(q.teacherId) ?? q.teacherId}`,
    });
  }
  out.sort((a, b) => a.label.localeCompare(b.label));
  return out;
}
