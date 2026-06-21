// Plain, fill-in-the-blank sentences for every constraint template (PURE). One phrasing,
// used as the panel label, the suggester preview, and the issue context — never two.

import { names } from "./constraintShared";
import { slotLabel } from "./profile";
import type { Constraint, ConstraintBase, ConstraintSeverity, Id, Project } from "./types";

/** Single source of truth for the Rules/Preferences vocabulary. */
export function tierLabel(severity: ConstraintSeverity): "Rule" | "Preference" {
  return severity === "must" ? "Rule" : "Preference";
}

export type ConstraintTier = 0 | 1 | 2 | 3;

/**
 * The single read point for a constraint's tier.
 * Migration: must→0, prefer→2 when tier is absent (existing data).
 * Always call this instead of reading c.tier directly.
 */
export function constraintTier(c: ConstraintBase): ConstraintTier {
  if (c.tier !== undefined) return c.tier as ConstraintTier;
  return c.severity === "must" ? 0 : 2;
}

/** The severity implied by a tier (0-1 = hard must, 2-3 = soft prefer). */
export function severityForTier(tier: ConstraintTier): ConstraintSeverity {
  return tier <= 1 ? "must" : "prefer";
}

/** Short label shown in the 4-way tier chip (T0–T3). */
export function tierChipLabel(tier: ConstraintTier): string {
  return `T${tier}`;
}

/** Tooltip description for each tier. */
export function tierDescription(tier: ConstraintTier): string {
  const d: Record<ConstraintTier, string> = {
    0: "Iron — solver never breaks this",
    1: "Firm — solver keeps unless unavoidable",
    2: "Soft — solver tries but may skip",
    3: "Wish — lowest priority, easiest to drop",
  };
  return d[tier];
}

export function constraintSentence(project: Project, c: Constraint): string {
  const n = names(project);
  const profile = project.profiles.find((p) => p.isDefault) ?? project.profiles[0];
  const subs = (ids: Id[]) => ids.map(n.s).join(", ");
  const cls = (ids: Id[]) => ids.map(n.c).join(", ");
  const slots = (ss: number[]) => ss.map((s) => (profile ? slotLabel(profile, s) : String(s))).join(", ");

  switch (c.template) {
    case "subject_half_of_day":
      return `${subs(c.params.subjectIds)} in the ${c.params.half} half of the day for ${cls(c.params.classIds)}`;
    case "subject_only_periods":
      return `${subs(c.params.subjectIds)} only in ${slots(c.params.slots)} for ${cls(c.params.classIds)}`;
    case "subject_never_periods":
      return `${subs(c.params.subjectIds)} never in ${slots(c.params.slots)} for ${cls(c.params.classIds)}`;
    case "subject_not_last":
      return `${subs(c.params.subjectIds)} never in the last period for ${cls(c.params.classIds)}`;
    case "teacher_not_first_period":
      return `${n.t(c.params.teacherId)} never teaches the first period`;
    case "teacher_not_last_period":
      return `${n.t(c.params.teacherId)} never teaches the last period`;
    case "teacher_max_per_week":
      return `${n.t(c.params.teacherId)} teaches at most ${c.params.max} periods a week`;
    case "teacher_max_per_day":
      return `${n.t(c.params.teacherId)} teaches at most ${c.params.max} periods a day`;
    case "teacher_max_consecutive":
      return `${n.t(c.params.teacherId)} teaches at most ${c.params.max} periods in a row`;
    case "teacher_max_days_per_week":
      return `${n.t(c.params.teacherId)} teaches on at most ${c.params.max} days a week`;
    case "teacher_min_free_per_week":
      return `${n.t(c.params.teacherId)} has at least ${c.params.min} free periods a week`;
    case "teacher_compact_day":
      return `${n.t(c.params.teacherId)}'s day has no gaps between lessons`;
    case "subject_max_per_day":
      return `at most ${c.params.max} period(s) of ${subs(c.params.subjectIds)} a day for ${cls(c.params.classIds)}`;
    case "subject_spread_min_days":
      return `${subs(c.params.subjectIds)} spread across at least ${c.params.minDays} days for ${cls(c.params.classIds)}`;
    case "subject_order":
      return `${n.s(c.params.beforeSubjectId)} before ${n.s(c.params.afterSubjectId)} on the same day for ${n.c(c.params.classId)}`;
    case "subject_not_adjacent_to":
      return `${n.s(c.params.subjectAId)} and ${n.s(c.params.subjectBId)} not back-to-back for ${n.c(c.params.classId)}`;
    case "class_teacher_p1":
      return `${n.c(c.params.classId)}'s class teacher takes period 1 every day`;
    case "class_max_teachers_per_day":
      return `${n.c(c.params.classId)} sees at most ${c.params.max} teachers a day`;
    case "class_daily_variety":
      return `${n.c(c.params.classId)} doesn't repeat a subject within a day`;
    case "class_max_consecutive_same":
      return `${n.c(c.params.classId)} has at most ${c.params.max} periods of one subject in a row`;
    case "class_no_free":
      return `${n.c(c.params.classId)} has no free periods`;
    case "class_board_protect":
      return `${n.c(c.params.classId)} (board class) keeps the first three periods for ${subs(c.params.coreSubjectIds)}`;
    case "balance_teacher_loads":
      return `teacher workloads stay within ${c.params.maxSpread} periods of each other`;
    case "core_subjects_early":
      return `${subs(c.params.subjectIds)} taught earlier in the day`;
  }
}
