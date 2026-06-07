// Per-student personal timetable & elective report (PURE) — C7. For a chosen elective
// combination (a StudentGroup), the lessons THAT student actually attends: every whole-class
// lesson plus the one elective / Self Study scoped to their group. A non-chosen (dropped)
// subject never appears — the dropper sees Self Study at that slot instead.
//
// Built on the SAME oracle as the clash rule (deriveMaps + attendeesOf), so a personal
// timetable can never disagree with the grid. On a CLASH-FREE grid a student attends exactly
// one event per slot (option lines are slot-exclusive per HE2; every dropper gets a Study
// shadow at each dropped-elective slot from seedArtsElectives) — the C7 test verifies this
// invariant independently across all groups. On a NON-clash-free grid (two whole-class
// lessons double-booked) this view shows one of the clashing lessons; that is not hidden —
// the clash is surfaced by validate()/the Issues panel, which is where a double-booking
// belongs, not silently in a per-student read. We deliberately do NOT throw here (it would
// crash report rendering on exactly the dirty grid the user is trying to debug).

import { attendeesOf, buildGroupsByClass } from "./attendees";
import { deriveMaps } from "./derive";
import type { Day, Id, Project, Timetable, TimetableEvent } from "./types";

export interface StudentSlot {
  day: Day;
  slot: number;
  event: TimetableEvent;
}

/** The events a given student group attends, keyed by `${day}#${slot}`. */
export function studentTimetable(project: Project, timetable: Timetable, studentGroupId: Id): Map<string, StudentSlot> {
  const group = project.studentGroups.find((g) => g.id === studentGroupId);
  const out = new Map<string, StudentSlot>();
  if (!group) return out;
  const groupsByClass = buildGroupsByClass(project);
  const cells = deriveMaps(project, timetable).classCells.get(group.classId);
  if (!cells) return out;
  for (const [key, occ] of cells) {
    const [day, slotStr] = key.split("#");
    const seen = new Set<Id>();
    for (const o of occ) {
      if (seen.has(o.event.id)) continue;
      seen.add(o.event.id);
      const att = attendeesOf(o.event, group.classId, groupsByClass);
      if (att.kind === "all" || att.ids.has(group.id)) {
        out.set(key, { day: day as Day, slot: Number(slotStr), event: o.event });
        break; // slot-exclusive: a student attends ≤1 event per slot (test-enforced)
      }
    }
  }
  return out;
}

export interface ElectiveLine {
  classId: Id;
  className: string;
  offered: { subjectId: Id; subject: string }[];
  chooseCount: number;
  groups: { id: Id; name: string; chosen: string[] }[];
}

/** Per option line (ElectiveGroup): what's offered, how many a student picks, and the chosen
 *  combination behind each student group — the human-readable "who's in what" report. */
export function electiveReport(project: Project): ElectiveLine[] {
  const subj = new Map(project.subjects.map((s) => [s.id, s.name]));
  const klass = new Map(project.classes.map((c) => [c.id, c.name]));
  return project.electiveGroups.map((eg) => ({
    classId: eg.classId,
    className: klass.get(eg.classId) ?? eg.classId,
    offered: eg.subjectIds.map((id) => ({ subjectId: id, subject: subj.get(id) ?? id })),
    chooseCount: eg.chooseCount,
    groups: project.studentGroups
      .filter((g) => g.classId === eg.classId)
      .map((g) => ({ id: g.id, name: g.name, chosen: g.electiveSubjectIds.map((id) => subj.get(id) ?? id) })),
  }));
}
