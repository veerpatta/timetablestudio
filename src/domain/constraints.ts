// Applied constraint engine — dispatcher (PURE). The REAL, user-created constraint
// system (C3–C4) that replaces the static R-rules. Each enabled Constraint → Violations
// (must → hard / prefer → soft). Plain-language messages, no codes on the surface.
//
// One-oracle discipline (advisor): a PLACEMENT-LOCAL template has ONE predicate
// (localViolates); evaluateConstraints filters every placed lesson through it AND fill's
// localMustForbids applies the SAME predicate to a candidate — so the generator and
// validate() can never disagree. AGGREGATE templates (caps/spread/variety/balance) live in
// constraintAggregates.ts and are evaluate-only — fill does NOT pre-respect them (they
// surface as issues; the generator resolves them in C6).

import * as agg from "./constraintAggregates";
import { firstHalf, lastTeachingSlot, lessonsByClass, names, type EvalCtx, type PartialViolation, type PlacedLesson } from "./constraintShared";
import { deriveMaps, findProfile } from "./derive";
import { teachingSlots } from "./profile";
import type { Constraint, ConstraintTemplate, Profile, Project, Timetable, Violation } from "./types";

export { constraintSentence, tierLabel } from "./constraintText";
export type { PlacedLesson } from "./constraintShared";

const LOCAL_TEMPLATES: ReadonlySet<ConstraintTemplate> = new Set([
  "subject_half_of_day", "subject_only_periods", "subject_never_periods", "subject_not_last",
  "teacher_not_first_period", "teacher_not_last_period",
]);

/**
 * Placement-local predicate: does this single lesson break the constraint? Returns null
 * for aggregate templates (so fill knows not to pre-filter on them).
 */
export function localViolates(c: Constraint, profile: Profile, p: PlacedLesson): boolean | null {
  switch (c.template) {
    case "subject_half_of_day":
      if (!c.params.classIds.includes(p.classId) || !c.params.subjectIds.includes(p.subjectId)) return false;
      return (c.params.half === "first") !== firstHalf(profile).has(p.slot);
    case "subject_only_periods":
      if (!c.params.classIds.includes(p.classId) || !c.params.subjectIds.includes(p.subjectId)) return false;
      return !c.params.slots.includes(p.slot);
    case "subject_never_periods":
      if (!c.params.classIds.includes(p.classId) || !c.params.subjectIds.includes(p.subjectId)) return false;
      return c.params.slots.includes(p.slot);
    case "subject_not_last":
      if (!c.params.classIds.includes(p.classId) || !c.params.subjectIds.includes(p.subjectId)) return false;
      return p.slot === lastTeachingSlot(profile);
    case "teacher_not_first_period":
      return p.teacherIds.includes(c.params.teacherId) && p.slot === teachingSlots(profile)[0];
    case "teacher_not_last_period":
      return p.teacherIds.includes(c.params.teacherId) && p.slot === lastTeachingSlot(profile);
    default:
      return null; // aggregate
  }
}

/** Whether a local violation is teacher-scoped (so the slot carries teacherId, not classId). */
function isTeacherLocal(t: ConstraintTemplate): boolean {
  return t === "teacher_not_first_period" || t === "teacher_not_last_period";
}

// Aggregate dispatch — template → evaluator. Cast through unknown (each fn is typed to its
// own subtype; the union is discriminated, so the runtime template guarantees the match).
type AggFn = (c: Constraint, x: EvalCtx) => PartialViolation[];
const AGG: Partial<Record<ConstraintTemplate, AggFn>> = {
  teacher_max_per_week: agg.teacherMaxPerWeek as AggFn,
  teacher_max_per_day: agg.teacherMaxPerDay as AggFn,
  teacher_max_consecutive: agg.teacherMaxConsecutive as AggFn,
  teacher_max_days_per_week: agg.teacherMaxDaysPerWeek as AggFn,
  teacher_min_free_per_week: agg.teacherMinFreePerWeek as AggFn,
  teacher_compact_day: agg.teacherCompactDay as AggFn,
  subject_max_per_day: agg.subjectMaxPerDay as AggFn,
  subject_spread_min_days: agg.subjectSpreadMinDays as AggFn,
  subject_order: agg.subjectOrder as AggFn,
  subject_not_adjacent_to: agg.subjectNotAdjacent as AggFn,
  class_teacher_p1: agg.classTeacherP1 as AggFn,
  class_max_teachers_per_day: agg.classMaxTeachersPerDay as AggFn,
  class_daily_variety: agg.classDailyVariety as AggFn,
  class_max_consecutive_same: agg.classMaxConsecutiveSame as AggFn,
  class_no_free: agg.classNoFree as AggFn,
  class_board_protect: agg.classBoardProtect as AggFn,
  balance_teacher_loads: agg.balanceTeacherLoads as AggFn,
  core_subjects_early: agg.coreSubjectsEarly as AggFn,
};

function localMessage(c: Constraint, n: EvalCtx["n"], profile: Profile, p: PlacedLesson): string {
  const at = `${p.day} ${profile.slots.find((s) => s.index === p.slot)?.label ?? p.slot}`;
  switch (c.template) {
    case "subject_half_of_day":
      return `${n.s(p.subjectId)} for ${n.c(p.classId)} should be in the ${c.params.half} half of the day, but it's at ${at}.`;
    case "subject_only_periods":
      return `${n.s(p.subjectId)} for ${n.c(p.classId)} is at ${at}, which isn't an allowed period for it.`;
    case "subject_never_periods":
      return `${n.s(p.subjectId)} for ${n.c(p.classId)} is at ${at}, where it isn't allowed.`;
    case "subject_not_last":
      return `${n.s(p.subjectId)} for ${n.c(p.classId)} is in the last period (${at}).`;
    case "teacher_not_first_period":
      return `${n.t(c.params.teacherId)} teaches the first period on ${p.day}, which they'd rather not.`;
    case "teacher_not_last_period":
      return `${n.t(c.params.teacherId)} teaches the last period on ${p.day}, which they'd rather not.`;
    default:
      return "";
  }
}

/** Evaluate every enabled constraint to Violations (must → hard, prefer → soft). */
export function evaluateConstraints(project: Project, timetable: Timetable): Violation[] {
  const profile = findProfile(project, timetable);
  if (!profile) return [];
  const maps = deriveMaps(project, timetable);
  const n = names(project);
  const teach = teachingSlots(profile);
  const ctx: EvalCtx = { project, maps, profile, teach, n };

  // Expand every placed lesson once (reused by all local predicates).
  const placed: PlacedLesson[] = [];
  for (const klass of project.classes)
    for (const l of lessonsByClass(maps, klass.id))
      placed.push({ classId: klass.id, subjectId: l.event.subjectId, teacherIds: l.event.teacherIds, day: l.day, slot: l.slot });

  const out: Violation[] = [];
  for (const c of project.constraints) {
    if (!c.enabled) continue;
    const sev: Violation["severity"] = c.severity === "must" ? "hard" : "soft";

    if (LOCAL_TEMPLATES.has(c.template)) {
      const seen = new Set<string>();
      for (const p of placed) {
        if (localViolates(c, profile, p) !== true) continue;
        const message = localMessage(c, n, profile, p);
        const key = `${p.day}#${p.slot}#${message}`;
        if (seen.has(key)) continue; // dedup joint/team teacher repeats
        seen.add(key);
        const slot = isTeacherLocal(c.template)
          ? { teacherId: (c as { params: { teacherId: string } }).params.teacherId, day: p.day, slot: p.slot }
          : { classId: p.classId, day: p.day, slot: p.slot };
        out.push({ constraintId: c.template, severity: sev, message, slots: [slot] });
      }
    } else {
      const fn = AGG[c.template];
      if (fn) for (const pv of fn(c, ctx)) out.push({ constraintId: c.template, severity: sev, ...pv });
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
