// Applied constraint engine (PURE) — C3. The REAL, user-created constraint system that
// replaces the static R-rules. Each enabled Constraint compiles to a predicate over
// (project, timetable) → Violations in the shared shape: `must` → hard (joins validate),
// `prefer` → soft (issues / score). Messages are plain language — no codes on the surface.
//
// Architecture (advisor): a PLACEMENT-LOCAL template defines ONE predicate
// `localViolates(constraint, profile, placement)`; `evaluateConstraints` filters every
// placed lesson through it (for highlighting/validate), and `localMustForbids` applies the
// SAME predicate to a candidate (so fill pre-respects it) — one oracle, the two can't drift.
// AGGREGATE templates (weekly caps, class-teacher-P1) define a whole-timetable `evaluate`
// only; fill does NOT pre-respect them — they surface as issues and are the generator's job
// in C6 (the honest-gap pattern).

import { deriveMaps, findProfile } from "./derive";
import { teachingSlots } from "./profile";
import type {
  Constraint,
  Day,
  HalfOfDay,
  Id,
  Profile,
  Project,
  Timetable,
  TimetableEvent,
  Violation,
} from "./types";

/** A single placed (or candidate) lesson — the unit a local predicate judges. */
export interface PlacedLesson {
  classId: Id;
  subjectId: Id;
  teacherIds: Id[];
  day: Day;
  slot: number;
}

const firstHalf = (profile: Profile): Set<number> => {
  const teach = teachingSlots(profile);
  return new Set(teach.slice(0, Math.ceil(teach.length / 2)));
};

const slotName = (profile: Profile, n: number): string =>
  profile.slots.find((s) => s.index === n)?.label ?? `slot ${n}`;
const halfWord = (h: HalfOfDay): string => (h === "first" ? "first" : "second");

/**
 * Placement-local predicate: does this single lesson break the constraint? Returns
 * `null` for aggregate templates that can't be judged from one placement (so fill knows
 * not to pre-filter on them).
 */
export function localViolates(c: Constraint, profile: Profile, p: PlacedLesson): boolean | null {
  switch (c.template) {
    case "subject_half_of_day": {
      if (!c.params.classIds.includes(p.classId) || !c.params.subjectIds.includes(p.subjectId)) return false;
      const inFirst = firstHalf(profile).has(p.slot);
      return (c.params.half === "first") !== inFirst;
    }
    default:
      return null; // aggregate
  }
}

/** Names for plain-language messages. */
interface Names {
  s: (id: Id) => string;
  c: (id: Id) => string;
  t: (id: Id) => string;
}
function names(project: Project): Names {
  return {
    s: (id) => project.subjects.find((x) => x.id === id)?.name ?? id,
    c: (id) => project.classes.find((x) => x.id === id)?.name ?? id,
    t: (id) => project.teachers.find((x) => x.id === id)?.name ?? id,
  };
}

interface Lesson { day: Day; slot: number; event: TimetableEvent; }
function lessonsByClass(maps: ReturnType<typeof deriveMaps>, classId: Id): Lesson[] {
  const out: Lesson[] = [];
  for (const [key, occ] of maps.classCells.get(classId) ?? []) {
    const [day, slot] = key.split("#");
    if (occ[0]) out.push({ day: day as Day, slot: Number(slot), event: occ[0].event });
  }
  return out;
}
function lessonsByTeacher(maps: ReturnType<typeof deriveMaps>, teacherId: Id): Lesson[] {
  const out: Lesson[] = [];
  for (const [key, occ] of maps.teacherCells.get(teacherId) ?? []) {
    const [day, slot] = key.split("#");
    if (occ[0]) out.push({ day: day as Day, slot: Number(slot), event: occ[0].event });
  }
  return out;
}

/** Evaluate every enabled constraint to Violations (must → hard, prefer → soft). */
export function evaluateConstraints(project: Project, timetable: Timetable): Violation[] {
  const profile = findProfile(project, timetable);
  if (!profile) return [];
  const maps = deriveMaps(project, timetable);
  const n = names(project);
  const out: Violation[] = [];

  for (const c of project.constraints) {
    if (!c.enabled) continue;
    const sev: Violation["severity"] = c.severity === "must" ? "hard" : "soft";
    const add = (message: string, slots: Violation["slots"]) =>
      out.push({ constraintId: c.template, severity: sev, message, slots });

    if (c.template === "subject_half_of_day") {
      for (const classId of c.params.classIds)
        for (const l of lessonsByClass(maps, classId)) {
          if (localViolates(c, profile, { classId, subjectId: l.event.subjectId, teacherIds: l.event.teacherIds, day: l.day, slot: l.slot }))
            add(
              `${n.s(l.event.subjectId)} for ${n.c(classId)} should be in the ${halfWord(c.params.half)} half of the day, but it's at ${slotName(profile, l.slot)}.`,
              [{ classId, day: l.day, slot: l.slot }],
            );
        }
    } else if (c.template === "teacher_max_per_week") {
      const ls = lessonsByTeacher(maps, c.params.teacherId);
      if (ls.length > c.params.max)
        add(
          `${n.t(c.params.teacherId)} teaches ${ls.length} periods a week, more than the limit of ${c.params.max}.`,
          ls.map((l) => ({ teacherId: c.params.teacherId, day: l.day, slot: l.slot })),
        );
    } else if (c.template === "class_teacher_p1") {
      const klass = project.classes.find((k) => k.id === c.params.classId);
      const ct = klass?.classTeacherId;
      if (!ct) continue; // no class teacher set → nothing to check
      const p1 = teachingSlots(profile)[0]!;
      const lessons = lessonsByClass(maps, c.params.classId);
      for (const day of profile.days) {
        const at = lessons.find((l) => l.day === day && l.slot === p1);
        const ok = at && at.event.teacherIds.includes(ct) && (!c.params.subjectId || at.event.subjectId === c.params.subjectId);
        if (!ok)
          add(`${n.c(c.params.classId)} should start ${day} with ${n.t(ct)} (the class teacher), but doesn't.`, [
            { classId: c.params.classId, day, slot: p1 },
          ]);
      }
    }
  }
  return out;
}

/**
 * Would placing `cand` break any enabled MUST constraint that is placement-local?
 * fill() calls this so the generator pre-respects local musts (e.g. half-of-day).
 * Aggregate musts are not consulted here (surfaced post-fill; resolved in C6).
 */
export function localMustForbids(project: Project, profile: Profile, cand: PlacedLesson): boolean {
  for (const c of project.constraints) {
    if (!c.enabled || c.severity !== "must") continue;
    if (localViolates(c, profile, cand) === true) return true;
  }
  return false;
}

/** Plain, fill-in-the-blank sentence for a constraint (UI label + nothing-silent diffs). */
export function constraintSentence(project: Project, c: Constraint): string {
  const n = names(project);
  switch (c.template) {
    case "subject_half_of_day":
      return `${c.params.subjectIds.map(n.s).join(", ")} in the ${halfWord(c.params.half)} half of the day for ${c.params.classIds.map(n.c).join(", ")}`;
    case "teacher_max_per_week":
      return `${n.t(c.params.teacherId)} teaches at most ${c.params.max} periods a week`;
    case "class_teacher_p1":
      return `${n.c(c.params.classId)}'s class teacher takes period 1 every day`;
  }
}
