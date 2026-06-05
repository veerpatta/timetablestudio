// Entity-lifecycle helpers (M18): impact preview + reassignment so removing a
// teacher never leaves a dangling reference. PURE — no DOM/store. Reassign moves
// every reference (lessons, blocks, requirements, class-teacher, rules) from one
// teacher to another, makes the target qualified, then the old teacher can be
// removed cleanly.

import type { Id, Project } from "./types";

export interface TeacherImpact {
  /** Lessons that name this teacher. */
  lessons: number;
  /** Blocks (e.g. ELGA) that include this teacher. */
  blocks: number;
  /** Curriculum requirements that allow this teacher. */
  requirements: number;
  /** Classes where this teacher is the P1 class teacher (by name). */
  classTeacherOf: string[];
  /** Rules that reference this teacher (R8/R12/R15). */
  rules: number;
  /** Total placements that would lose a teacher if removed without reassigning. */
  placements: number;
}

const teacherSubjects = (project: Project, teacherId: Id): Set<Id> => {
  const out = new Set<Id>();
  for (const a of project.activities) {
    if (a.kind === "lesson" && a.teacherIds.includes(teacherId)) out.add(a.subjectId);
  }
  return out;
};

export function teacherImpact(project: Project, teacherId: Id): TeacherImpact {
  const lessonIds = new Set(
    project.activities.filter((a) => a.kind === "lesson" && a.teacherIds.includes(teacherId)).map((a) => a.id),
  );
  const blockIds = new Set(
    project.activities.filter((a) => a.kind === "block" && a.teacherIds.includes(teacherId)).map((a) => a.id),
  );
  const affected = new Set([...lessonIds, ...blockIds]);
  const placements = project.timetables.reduce(
    (n, t) => n + t.placements.filter((p) => affected.has(p.activityId)).length,
    0,
  );
  return {
    lessons: lessonIds.size,
    blocks: blockIds.size,
    requirements: project.requirements.curriculum.filter((r) => r.teacherIds.includes(teacherId)).length,
    classTeacherOf: project.classes.filter((c) => c.classTeacherId === teacherId).map((c) => c.name),
    rules: project.rules.filter(
      (r) =>
        (r.template === "R8" || r.template === "R12" || r.template === "R15") && r.teacherId === teacherId,
    ).length,
    placements,
  };
}

const swap = (ids: Id[], from: Id, to: Id): Id[] => [...new Set(ids.map((id) => (id === from ? to : id)))];

/** Move every reference from `fromId` to `toId`, make `toId` qualified for the
 * subjects it inherits, and drop the old teacher. No reference is left dangling. */
export function reassignTeacher(project: Project, fromId: Id, toId: Id): Project {
  if (fromId === toId || !project.teachers.some((t) => t.id === toId)) return project;
  const inherited = teacherSubjects(project, fromId);

  return {
    ...project,
    teachers: project.teachers
      .filter((t) => t.id !== fromId)
      .map((t) =>
        t.id === toId ? { ...t, subjects: [...new Set([...t.subjects, ...inherited])] } : t,
      ),
    activities: project.activities.map((a) =>
      a.teacherIds.includes(fromId) ? { ...a, teacherIds: swap(a.teacherIds, fromId, toId) } : a,
    ),
    classes: project.classes.map((c) =>
      c.classTeacherId === fromId ? { ...c, classTeacherId: toId } : c,
    ),
    requirements: {
      ...project.requirements,
      curriculum: project.requirements.curriculum.map((r) =>
        r.teacherIds.includes(fromId) ? { ...r, teacherIds: swap(r.teacherIds, fromId, toId) } : r,
      ),
    },
    rules: project.rules.map((r) =>
      (r.template === "R8" || r.template === "R12" || r.template === "R15") && r.teacherId === fromId
        ? { ...r, teacherId: toId }
        : r,
    ),
  };
}
