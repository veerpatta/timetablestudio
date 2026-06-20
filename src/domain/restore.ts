// Repair a single class's timetable from a reference project (PURE) — recovery for the old
// "Self Study collapse" bug, which stripped a class's elective lessons and left whole-class
// Self Study behind. This rebuilds ONLY that class's OWN (single-class) lessons — electives,
// Self Study and ordinary subjects — from the reference (normally the original bundled
// timetable), while leaving every shared event (joint/team blocks with other classes) and
// every OTHER class untouched. Any residual clash with a since-moved shared lesson is left for
// validate() to surface rather than silently papered over.

import type { Id, Project, TimetableEvent } from "./types";

const isSingleClass = (e: TimetableEvent | undefined, classId: Id): boolean =>
  !!e && e.classIds.length === 1 && e.classIds[0] === classId;

/**
 * Replace `classId`'s own lessons in `project`'s `timetableId` with the reference's. Shared
 * events (joint_class/team_block) and other classes are preserved. Also restores the class's
 * elective/student groups if they went missing. Pure: returns a new Project.
 */
export function restoreClassFromReference(project: Project, reference: Project, classId: Id, timetableId: Id): Project {
  const tt = project.timetables.find((t) => t.id === timetableId);
  const rtt = reference.timetables.find((t) => t.id === reference.activeTimetableId);
  if (!tt || !rtt) return project;

  const projEventById = new Map(project.events.map((e) => [e.id, e]));
  // Drop the class's current single-class placements (the corrupted ones + its Self Study).
  const keptPlacements = tt.placements.filter((p) => !isSingleClass(projEventById.get(p.eventId), classId));

  // The reference's single-class events + placements for this class (the canonical lessons).
  const refEvents = reference.events.filter((e) => isSingleClass(e, classId));
  const refEventIds = new Set(refEvents.map((e) => e.id));
  const refPlacements = rtt.placements.filter((p) => refEventIds.has(p.eventId)).map((p) => ({ ...p }));

  // Merge event definitions (reference wins for the restored ids; everything else preserved).
  const events = [...project.events.filter((e) => !refEventIds.has(e.id)), ...refEvents.map((e) => ({ ...e }))];

  // Restore the class's elective/student groups if they were lost (idempotent by id).
  const egIds = new Set(project.electiveGroups.map((g) => g.id));
  const sgIds = new Set(project.studentGroups.map((g) => g.id));
  const electiveGroups = [...project.electiveGroups, ...reference.electiveGroups.filter((g) => g.classId === classId && !egIds.has(g.id))];
  const studentGroups = [...project.studentGroups, ...reference.studentGroups.filter((g) => g.classId === classId && !sgIds.has(g.id))];

  return {
    ...project,
    events,
    electiveGroups,
    studentGroups,
    timetables: project.timetables.map((t) => (t.id === timetableId ? { ...t, placements: [...keptPlacements, ...refPlacements] } : t)),
  };
}
