// Reference analysis (PURE) — the spine of safe entity editing (C1).
//
// Two functions carry the milestone's "no dangling reference" guarantee:
//   referencesOf(project, kind, id) — every place an id is used. This IS the
//     removal-impact preview the UI shows before a destructive edit (nothing
//     automatic is silent: the diff is reviewable).
//   findDanglingRefs(project)       — scans EVERY id-bearing field for orphans.
//     A CRUD op is correct iff this returns [] afterwards (asserted in tests).
//
// Enumerated straight from types.ts — a missed site is exactly the dangling
// reference the C1 acceptance criteria forbid.

import type { Id, Project, Rule, SchoolClass, TimetableEvent } from "./types";

export type EntityKind = "teacher" | "subject" | "class";

/** Every reference to one entity — the structured impact preview. */
export interface EntityImpact {
  kind: EntityKind;
  id: Id;
  name: string;
  /** Events that reference the entity (lessons that would change/disappear). */
  events: TimetableEvent[];
  /** How many placements (grid cells) those events occupy. */
  placements: number;
  /** Qualification triples referencing the entity. */
  qualifications: number;
  /** Curriculum requirements referencing the entity. */
  requirements: number;
  /** Classes whose class-teacher is this teacher (teacher kind only). */
  classTeacherOf: SchoolClass[];
  /** Rule ids that reference the entity. */
  rules: Id[];
}

const ruleRefsTeacher = (r: Rule, id: Id): boolean =>
  ("teacherId" in r && r.teacherId === id);

const ruleRefsSubject = (r: Rule, id: Id): boolean =>
  ("subjectId" in r && r.subjectId === id) ||
  ("subjectIds" in r && r.subjectIds.includes(id)) ||
  ("beforeSubjectId" in r && (r.beforeSubjectId === id || r.afterSubjectId === id)) ||
  ("coreSubjectIds" in r && r.coreSubjectIds.includes(id));

const ruleRefsClass = (r: Rule, id: Id): boolean =>
  ("classId" in r && r.classId === id) || ("classIds" in r && r.classIds.includes(id));

function eventRefs(e: TimetableEvent, kind: EntityKind, id: Id): boolean {
  if (kind === "teacher") return e.teacherIds.includes(id);
  if (kind === "subject") return e.subjectId === id;
  return e.classIds.includes(id);
}

/** Full impact of touching one entity: where it is referenced across the project. */
export function referencesOf(project: Project, kind: EntityKind, id: Id): EntityImpact {
  const events = project.events.filter((e) => eventRefs(e, kind, id));
  const eventIds = new Set(events.map((e) => e.id));
  const placements = project.timetables.reduce(
    (n, tt) => n + tt.placements.filter((p) => eventIds.has(p.eventId)).length,
    0,
  );

  const qualifications = project.qualifications.filter((q) =>
    kind === "teacher" ? q.teacherId === id : kind === "subject" ? q.subjectId === id : q.classId === id,
  ).length;

  const requirements = project.requirements.filter((r) =>
    kind === "teacher" ? r.teacherIds.includes(id) : kind === "subject" ? r.subjectId === id : r.classId === id,
  ).length;

  const classTeacherOf =
    kind === "teacher" ? project.classes.filter((c) => c.classTeacherId === id) : [];

  const rules = project.rules
    .filter((r) =>
      kind === "teacher" ? ruleRefsTeacher(r, id) : kind === "subject" ? ruleRefsSubject(r, id) : ruleRefsClass(r, id),
    )
    .map((r) => r.id);

  const name =
    (kind === "teacher"
      ? project.teachers
      : kind === "subject"
        ? project.subjects
        : project.classes
    ).find((x) => x.id === id)?.name ?? id;

  return { kind, id, name, events, placements, qualifications, requirements, classTeacherOf, rules };
}

/**
 * Scan every id-bearing field for references to entities that no longer exist.
 * Returns plain-language descriptions ([] when the project is internally consistent).
 * This is the C1 invariant: it must stay [] after every CRUD operation.
 */
export function findDanglingRefs(project: Project): string[] {
  const teacherIds = new Set(project.teachers.map((t) => t.id));
  const subjectIds = new Set(project.subjects.map((s) => s.id));
  const classIds = new Set(project.classes.map((c) => c.id));
  const eventIds = new Set(project.events.map((e) => e.id));
  const profileIds = new Set(project.profiles.map((p) => p.id));
  const out: string[] = [];

  for (const q of project.qualifications) {
    if (!teacherIds.has(q.teacherId)) out.push(`qualification names missing teacher "${q.teacherId}"`);
    if (!subjectIds.has(q.subjectId)) out.push(`qualification names missing subject "${q.subjectId}"`);
    if (!classIds.has(q.classId)) out.push(`qualification names missing class "${q.classId}"`);
  }
  for (const r of project.requirements) {
    if (!classIds.has(r.classId)) out.push(`requirement ${r.id} names missing class "${r.classId}"`);
    if (!subjectIds.has(r.subjectId)) out.push(`requirement ${r.id} names missing subject "${r.subjectId}"`);
    for (const t of r.teacherIds) if (!teacherIds.has(t)) out.push(`requirement ${r.id} names missing teacher "${t}"`);
  }
  for (const e of project.events) {
    if (!subjectIds.has(e.subjectId)) out.push(`event ${e.id} names missing subject "${e.subjectId}"`);
    for (const c of e.classIds) if (!classIds.has(c)) out.push(`event ${e.id} names missing class "${c}"`);
    for (const t of e.teacherIds) if (!teacherIds.has(t)) out.push(`event ${e.id} names missing teacher "${t}"`);
  }
  for (const c of project.classes) {
    if (c.classTeacherId && !teacherIds.has(c.classTeacherId))
      out.push(`${c.name} names missing class-teacher "${c.classTeacherId}"`);
  }
  for (const tt of project.timetables) {
    if (!profileIds.has(tt.profileId)) out.push(`timetable ${tt.id} names missing profile "${tt.profileId}"`);
    for (const p of tt.placements)
      if (!eventIds.has(p.eventId)) out.push(`a placement names missing event "${p.eventId}"`);
  }
  for (const r of project.rules) {
    if ("teacherId" in r && !teacherIds.has(r.teacherId)) out.push(`rule ${r.id} names missing teacher "${r.teacherId}"`);
    if ("classId" in r && !classIds.has(r.classId)) out.push(`rule ${r.id} names missing class "${r.classId}"`);
    if ("classIds" in r) for (const c of r.classIds) if (!classIds.has(c)) out.push(`rule ${r.id} names missing class "${c}"`);
    if ("subjectId" in r && r.subjectId && !subjectIds.has(r.subjectId)) out.push(`rule ${r.id} names missing subject "${r.subjectId}"`);
    if ("subjectIds" in r) for (const s of r.subjectIds) if (!subjectIds.has(s)) out.push(`rule ${r.id} names missing subject "${s}"`);
  }
  return out;
}
