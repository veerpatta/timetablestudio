// Electives & student groups (PURE) — C5, the Arts fix. The bundled grid already runs the
// four Arts electives in distinct per-class slots (HE2 forces it), so this is a MODELLING
// transform, not a re-schedule: it (1) defines an ElectiveGroup + the four free-3-of-4
// StudentGroups per Arts class, (2) scopes each elective event to the groups that CHOSE it
// (so the dropper is no longer "forced to sit in"), and (3) adds a supervised Study for the
// dropping group at exactly the dropped elective's slots. After this, validate() must stay
// at zero hard violations (the refined attendee-set HE2 makes elective+study legal).

import { findProfile } from "./derive";
import type { ElectiveGroup, Id, Placement, Project, StudentGroup, TimetableEvent } from "./types";

const ARTS_CLASSES = ["Class 11 Arts", "Class 12 Arts"];
const ELECTIVES = ["Political Science", "Geography", "Economics", "English Literature"];
const STUDY_SUBJECT = "Self Study";

/** True iff NO student group chose both subjects — then they can run in parallel (one line). */
export function canParallelize(studentGroups: StudentGroup[], a: Id, b: Id): boolean {
  return !studentGroups.some((g) => g.electiveSubjectIds.includes(a) && g.electiveSubjectIds.includes(b));
}

/**
 * Reverse of seedArtsElectives (OWNER decision, 2026-06-20): the school's authoritative
 * timetable shows Arts electives as ordinary whole-class lessons, with NO per-student "Self
 * Study" splitting — so the default product no longer seeds the option-line model. This strips
 * it from any project: drop the seeded Self Study events (+ placements), clear studentGroupIds
 * from every event (electives become whole-class), and empty the elective/student groups.
 * Returns the SAME object when there is nothing to strip (referentially honest).
 */
export function stripElectiveModel(project: Project): Project {
  const studyIds = new Set(project.events.filter((e) => e.type === "self_study" && (e.id.startsWith("evt:study:") || (e.studentGroupIds?.length ?? 0) > 0)).map((e) => e.id));
  const hasScoped = project.events.some((e) => (e.studentGroupIds?.length ?? 0) > 0);
  if (studyIds.size === 0 && !hasScoped && project.electiveGroups.length === 0 && project.studentGroups.length === 0) return project;

  const events = project.events
    .filter((e) => !studyIds.has(e.id))
    .map((e) => (e.studentGroupIds && e.studentGroupIds.length > 0 ? { ...e, studentGroupIds: undefined } : e));
  return {
    ...project,
    events,
    electiveGroups: [],
    studentGroups: [],
    timetables: project.timetables.map((t) => ({ ...t, placements: t.placements.filter((p) => !studyIds.has(p.eventId)) })),
  };
}

/** Seed Arts electives + student groups into a project. Idempotent: a no-op if electives
 * are already present (so it can run both at build time and on load without double-seeding). */
export function seedArtsElectives(project: Project): Project {
  if (project.electiveGroups.length > 0 || project.studentGroups.length > 0) return project;
  const tt = project.timetables.find((t) => t.id === project.activeTimetableId);
  if (!tt || !findProfile(project, tt)) return project;
  const subjectExists = (id: Id) => project.subjects.some((s) => s.id === id);
  const classExists = (id: Id) => project.classes.some((c) => c.id === id);

  const electiveGroups: ElectiveGroup[] = [];
  const studentGroups: StudentGroup[] = [];
  // group id per (class, dropped subject)
  const groupId = (cls: Id, dropped: Id) => `sg:${cls}:drop:${dropped}`;

  for (const cls of ARTS_CLASSES) {
    if (!classExists(cls)) continue;
    const electives = ELECTIVES.filter(subjectExists);
    if (electives.length < 2) continue;
    electiveGroups.push({ id: `eg:${cls}`, classId: cls, name: "Arts electives", subjectIds: electives, chooseCount: electives.length - 1 });
    for (const dropped of electives) {
      const chosen = electives.filter((s) => s !== dropped);
      studentGroups.push({ id: groupId(cls, dropped), classId: cls, name: `${cls} · ${chosen.join("/")}`, electiveSubjectIds: chosen });
    }
  }
  if (studentGroups.length === 0) return project;

  const groupsByClassSubject = (cls: Id, subject: Id): Id[] =>
    studentGroups.filter((g) => g.classId === cls && g.electiveSubjectIds.includes(subject)).map((g) => g.id);

  // (1) scope each elective event to the choosing groups (additive across Arts classes).
  const events: TimetableEvent[] = project.events.map((e) => {
    if (!ELECTIVES.includes(e.subjectId)) return e;
    const ids = new Set(e.studentGroupIds ?? []);
    for (const cls of e.classIds) if (ARTS_CLASSES.includes(cls)) for (const g of groupsByClassSubject(cls, e.subjectId)) ids.add(g);
    return ids.size > 0 ? { ...e, studentGroupIds: [...ids] } : e;
  });

  // (2) add a Self Study event per (class, dropping group) at that elective's slots.
  const eventIndex = new Map(events.map((e) => [e.id, e]));
  const newEvents: TimetableEvent[] = [];
  const newPlacements: Placement[] = [];
  for (const cls of ARTS_CLASSES) {
    if (!classExists(cls)) continue;
    for (const dropped of ELECTIVES.filter(subjectExists)) {
      const g = groupId(cls, dropped);
      if (!studentGroups.some((x) => x.id === g)) continue;
      // slots where the dropped elective runs for this class
      const slots = tt.placements.filter((p) => {
        const ev = eventIndex.get(p.eventId);
        return ev && ev.subjectId === dropped && ev.classIds.includes(cls);
      });
      if (slots.length === 0) continue;
      const studyId = `evt:study:${cls}:${dropped}`;
      newEvents.push({ id: studyId, type: "self_study", subjectId: STUDY_SUBJECT, classIds: [cls], teacherIds: [], duration: 1, source: "generated", studentGroupIds: [g] });
      for (const p of slots) newPlacements.push({ eventId: studyId, day: p.day, slot: p.slot, pinned: false });
    }
  }

  // ensure the Self Study subject exists (study kind)
  const subjects = subjectExists(STUDY_SUBJECT)
    ? project.subjects
    : [...project.subjects, { id: STUDY_SUBJECT, name: STUDY_SUBJECT, bands: ["senior" as const], kind: "study" as const }];

  return {
    ...project,
    subjects,
    events: [...events, ...newEvents],
    electiveGroups,
    studentGroups,
    timetables: project.timetables.map((t) => (t.id === tt.id ? { ...t, placements: [...t.placements, ...newPlacements] } : t)),
  };
}
