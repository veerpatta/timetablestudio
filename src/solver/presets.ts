// Emphasis presets for multi-candidate generation (M26). Each preset is a weight
// multiplier map over ConstraintTemplate. The generator runs one best-of-N per preset,
// ranking seeds by Σ(constraint.weight × multiplier[template]) so different presets
// genuinely optimise different objectives — not just labelling the same result.
//
// Design rule: presets are DATA. No logic here. Adding a preset is one object literal.
// The multipliers are multiplicative: 1 = standard weight, 3 = three times as important.
// Templates not listed default to multiplier 1.

import type { ConstraintTemplate } from "../domain/types";

export interface Preset {
  label: string;
  multipliers: Partial<Record<ConstraintTemplate, number>>;
}

/** Equal weight across all preference templates — the current default behaviour. */
export const BALANCED_PRESET: Preset = {
  label: "Balanced",
  multipliers: {},
};

/**
 * Up-weights teacher-comfort preferences: compactness, fairness, first/last duties.
 * Yields candidates where teacher loads and schedules are maximally even.
 */
export const TEACHER_FRIENDLY_PRESET: Preset = {
  label: "Teacher-friendly",
  multipliers: {
    balance_teacher_loads: 3,
    teacher_compact_day: 3,
    teacher_max_consecutive: 2,
    teacher_max_per_day: 2,
    teacher_max_days_per_week: 2,
    teacher_min_free_per_week: 2,
    teacher_not_first_period: 2,
    teacher_not_last_period: 2,
  },
};

/**
 * Up-weights student-facing preferences: early core subjects, spread, variety.
 * Yields candidates that prioritise pedagogical quality for students.
 */
export const STUDENT_FOCUSED_PRESET: Preset = {
  label: "Student-focused",
  multipliers: {
    core_subjects_early: 3,
    subject_spread_min_days: 3,
    class_daily_variety: 3,
    class_max_consecutive_same: 2,
    class_teacher_p1: 2,
    class_board_protect: 2,
    subject_max_per_day: 2,
    subject_order: 2,
  },
};

export const DEFAULT_PRESETS: Preset[] = [
  BALANCED_PRESET,
  TEACHER_FRIENDLY_PRESET,
  STUDENT_FOCUSED_PRESET,
];
