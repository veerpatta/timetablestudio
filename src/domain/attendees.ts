// Attendee resolution for the class-clash rule (PURE) — C5. Generalizes "same-event
// overlap is legal" to "disjoint-audience overlap is legal", so an elective (some student
// groups) and a supervised Study (the dropping group) can share a class slot without a
// false clash, while two whole-class lessons still clash.
//
// CRITICAL (advisor): whole-class is a UNIVERSAL set, never the empty set. Modelling it as
// `studentGroupIds ?? []` and intersecting arrays would make empty ∩ empty = ∅ — declaring
// two whole-class lessons non-clashing and silently killing HE2 for every non-elective class.

import type { Id, Project, StudentGroup, TimetableEvent } from "./types";

export type Attendees = { kind: "all" } | { kind: "groups"; ids: Set<Id> };
const ALL: Attendees = { kind: "all" };

export function buildGroupsByClass(project: Project): Map<Id, Id[]> {
  const m = new Map<Id, Id[]>();
  for (const g of project.studentGroups) (m.get(g.classId) ?? m.set(g.classId, []).get(g.classId)!).push(g.id);
  return m;
}

/**
 * Who, within `classId`, attends `event`:
 *  - a class with NO student groups → the whole class ("all");
 *  - an event that lists none of this class's groups → the whole class ("all")
 *    (the scoping constrains only the classes that have groups in the list — so a joint
 *    Economics shared by Commerce(all)+Arts(3 groups) reads correctly for each side);
 *  - otherwise → exactly the listed groups of this class.
 */
export function attendeesOf(event: TimetableEvent, classId: Id, groupsByClass: Map<Id, Id[]>): Attendees {
  const groupsOfClass = groupsByClass.get(classId);
  if (!groupsOfClass || groupsOfClass.length === 0) return ALL;
  const scoped = (event.studentGroupIds ?? []).filter((g) => groupsOfClass.includes(g));
  return scoped.length === 0 ? ALL : { kind: "groups", ids: new Set(scoped) };
}

/** Do two audiences overlap? ALL intersects anything; groups intersect iff ids overlap. */
export function attendeesIntersect(a: Attendees, b: Attendees): boolean {
  if (a.kind === "all" || b.kind === "all") return true;
  for (const id of a.ids) if (b.ids.has(id)) return true;
  return false;
}

/** Chosen subjects of a student group (for "no forced sitting" checks). */
export function chosenSubjects(group: StudentGroup): Set<Id> {
  return new Set(group.electiveSubjectIds);
}
