// Assignments (PURE, immutable) — C2. Two relations the legal-only picker and the
// class-teacher-P1 constraint read directly:
//   • Qualifications: the (teacher, subject, class) triples a teacher MAY teach.
//     legalOptions() iterates these, so adding/removing one immediately changes what
//     the cell picker offers (the C2 acceptance test).
//   • Class teacher: SchoolClass.classTeacherId. Setting it is what makes the R4
//     "class teacher takes period 1 daily" rule meaningful (R4 is a no-op without it).

import type { Id, Project, Qualification } from "./types";

const qualKey = (q: Pick<Qualification, "teacherId" | "subjectId" | "classId">): string =>
  `${q.teacherId}#${q.subjectId}#${q.classId}`;

export function isQualified(project: Project, teacherId: Id, subjectId: Id, classId: Id): boolean {
  const k = qualKey({ teacherId, subjectId, classId });
  return project.qualifications.some((q) => qualKey(q) === k);
}

/** Add a (teacher, subject, class) qualification (idempotent). */
export function addQualification(project: Project, teacherId: Id, subjectId: Id, classId: Id): Project {
  if (isQualified(project, teacherId, subjectId, classId)) return project;
  return { ...project, qualifications: [...project.qualifications, { teacherId, subjectId, classId }] };
}

/**
 * Remove a qualification. Any placement that RELIED on it (the teacher teaching that
 * subject to that class) is now unqualified — surfaced as an HE3 issue, never silently
 * hidden — so the user sees they must reassign. We do not auto-delete those lessons.
 */
export function removeQualification(project: Project, teacherId: Id, subjectId: Id, classId: Id): Project {
  const k = qualKey({ teacherId, subjectId, classId });
  return { ...project, qualifications: project.qualifications.filter((q) => qualKey(q) !== k) };
}

/** Teachers currently qualified to teach (subject, class). */
export function qualifiedTeachers(project: Project, subjectId: Id, classId: Id): Id[] {
  return project.qualifications.filter((q) => q.subjectId === subjectId && q.classId === classId).map((q) => q.teacherId);
}

/** Set (or clear, with undefined) a class's class teacher. */
export function setClassTeacher(project: Project, classId: Id, teacherId: Id | undefined): Project {
  return {
    ...project,
    classes: project.classes.map((c) =>
      c.id === classId ? (teacherId ? { ...c, classTeacherId: teacherId } : stripClassTeacher(c)) : c,
    ),
  };
}

function stripClassTeacher<T extends { classTeacherId?: Id }>(c: T): T {
  const { classTeacherId, ...rest } = c;
  void classTeacherId;
  return rest as T;
}
