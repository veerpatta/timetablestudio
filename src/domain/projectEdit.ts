// Pure project-level edit ops for the data manager (CRUD). Each returns a NEW
// Project. PURE: no DOM/store. Deletes cascade to keep the project consistent
// (removing a class drops its requirements, lessons and placements).

import type { CurriculumRequirement, Day, Id, Lesson, Project, SchoolClass } from "./types";

export function setSchoolName(project: Project, name: string): Project {
  return { ...project, school: { ...project.school, name } };
}

export function setActiveProfile(
  project: Project,
  patch: { days?: Day[]; periods?: number; name?: string },
): Project {
  const tt = project.timetables.find((t) => t.id === project.activeTimetableId);
  const profileId = tt?.profileId;
  return {
    ...project,
    profiles: project.profiles.map((p) => {
      if (p.id !== profileId) return p;
      const periods =
        patch.periods === undefined
          ? p.periods
          : Array.from({ length: patch.periods }, (_, i) => p.periods[i] ?? { label: `P${i + 1}`, start: "", end: "" });
      return { ...p, name: patch.name ?? p.name, days: patch.days ?? p.days, periods };
    }),
  };
}

export function addClass(project: Project, name: string, group: SchoolClass["group"]): Project {
  if (!name.trim() || project.classes.some((c) => c.id === name)) return project;
  return { ...project, classes: [...project.classes, { id: name, name, group }] };
}

export function removeClass(project: Project, classId: Id): Project {
  const lessonIds = new Set(
    project.activities.filter((a) => a.kind === "lesson" && a.classId === classId).map((a) => a.id),
  );
  return {
    ...project,
    classes: project.classes.filter((c) => c.id !== classId),
    activities: project.activities.filter((a) => !(a.kind === "lesson" && a.classId === classId)),
    requirements: {
      ...project.requirements,
      curriculum: project.requirements.curriculum.filter((r) => r.classId !== classId),
    },
    timetables: project.timetables.map((t) => ({
      ...t,
      placements: t.placements.filter((p) => !lessonIds.has(p.activityId)),
    })),
  };
}

export function addTeacher(project: Project, name: string, subjects: Id[] = []): Project {
  if (!name.trim() || project.teachers.some((t) => t.id === name)) return project;
  return {
    ...project,
    teachers: [
      ...project.teachers,
      { id: name, name, subjects, maxPeriodsPerDay: 6, maxPeriodsPerWeek: 36, unavailable: [] },
    ],
  };
}

export function setTeacher(
  project: Project,
  teacherId: Id,
  patch: { subjects?: Id[]; maxPeriodsPerDay?: number; maxPeriodsPerWeek?: number },
): Project {
  return {
    ...project,
    teachers: project.teachers.map((t) => (t.id === teacherId ? { ...t, ...patch } : t)),
  };
}

export function removeTeacher(project: Project, teacherId: Id): Project {
  const orphanLessons = new Set(
    project.activities
      .filter((a) => a.kind === "lesson" && a.teacherIds.includes(teacherId) && a.teacherIds.length === 1)
      .map((a) => a.id),
  );
  return {
    ...project,
    teachers: project.teachers.filter((t) => t.id !== teacherId),
    activities: project.activities
      .filter((a) => !orphanLessons.has(a.id))
      .map((a) =>
        a.kind === "block" ? { ...a, teacherIds: a.teacherIds.filter((id) => id !== teacherId) } : a,
      ),
    requirements: {
      ...project.requirements,
      curriculum: project.requirements.curriculum
        .filter((r) => !(r.teacherIds.length === 1 && r.teacherIds[0] === teacherId))
        .map((r) => ({ ...r, teacherIds: r.teacherIds.filter((id) => id !== teacherId) })),
    },
    timetables: project.timetables.map((t) => ({
      ...t,
      placements: t.placements.filter((p) => !orphanLessons.has(p.activityId)),
    })),
  };
}

const lessonId = (cls: Id, subject: Id, teacher: Id): Id => `lesson:${cls}|${subject}|${teacher}`;

export function addQuota(
  project: Project,
  q: { classId: Id; subjectId: Id; teacher: Id; periodsPerWeek: number; maxPerDay?: number },
): Project {
  const id = lessonId(q.classId, q.subjectId, q.teacher);
  const exists = project.requirements.curriculum.some((r) => r.id === `req:${id}`);
  const lesson: Lesson = {
    kind: "lesson",
    id,
    classId: q.classId,
    subjectId: q.subjectId,
    teacherIds: [q.teacher],
  };
  const req: CurriculumRequirement = {
    id: `req:${id}`,
    classId: q.classId,
    subjectId: q.subjectId,
    teacherIds: [q.teacher],
    periodsPerWeek: q.periodsPerWeek,
    maxPerDay: q.maxPerDay ?? 2,
  };
  // ensure subject exists
  const subjects = project.subjects.some((s) => s.id === q.subjectId)
    ? project.subjects
    : [...project.subjects, { id: q.subjectId, name: q.subjectId }];
  return {
    ...project,
    subjects,
    activities: project.activities.some((a) => a.id === id)
      ? project.activities
      : [...project.activities, lesson],
    requirements: {
      ...project.requirements,
      curriculum: exists
        ? project.requirements.curriculum.map((r) => (r.id === req.id ? req : r))
        : [...project.requirements.curriculum, req],
    },
  };
}

/** Adjust a requirement's weekly periods (the inferred-quota review screen). */
export function setQuotaPeriods(
  project: Project,
  requirementId: Id,
  periodsPerWeek: number,
): Project {
  const clamped = Math.max(0, Math.floor(periodsPerWeek));
  return {
    ...project,
    requirements: {
      ...project.requirements,
      curriculum: project.requirements.curriculum.map((r) =>
        r.id === requirementId ? { ...r, periodsPerWeek: clamped } : r,
      ),
    },
  };
}

export function removeQuota(project: Project, requirementId: Id): Project {
  const req = project.requirements.curriculum.find((r) => r.id === requirementId);
  if (!req) return project;
  const lid = lessonId(req.classId, req.subjectId, req.teacherIds[0] ?? "");
  return {
    ...project,
    activities: project.activities.filter((a) => a.id !== lid),
    requirements: {
      ...project.requirements,
      curriculum: project.requirements.curriculum.filter((r) => r.id !== requirementId),
    },
    timetables: project.timetables.map((t) => ({
      ...t,
      placements: t.placements.filter((p) => p.activityId !== lid),
    })),
  };
}
