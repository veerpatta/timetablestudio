// UI descriptor table for the constraint builder (data, not code). The Constraints panel
// renders a generic form from these field specs, so adding a template is a row here — not
// another inline branch in the panel (which would blow the 300-line rule at 24 templates).

import type { ConstraintScope, ConstraintTemplate } from "./types";

export type Field =
  | { kind: "subjects" | "classes"; key: string; label: string }
  | { kind: "subject" | "class" | "teacher"; key: string; label: string }
  | { kind: "half"; key: string; label: string }
  | { kind: "slots"; key: string; label: string }
  | { kind: "number"; key: string; label: string; def: number };

export interface Descriptor {
  template: ConstraintTemplate;
  label: string; // plain dropdown label
  scope: ConstraintScope;
  defaultSeverity: "must" | "prefer";
  fields: Field[];
}

const subjects = (key = "subjectIds", label = "Subjects"): Field => ({ kind: "subjects", key, label });
const classes = (key = "classIds", label = "For classes"): Field => ({ kind: "classes", key, label });

export const CATALOG: Descriptor[] = [
  // --- subject placement (local) ---
  { template: "subject_half_of_day", label: "A subject in the first/second half of the day", scope: "subject", defaultSeverity: "must", fields: [subjects(), classes(), { kind: "half", key: "half", label: "Half" }] },
  { template: "subject_only_periods", label: "A subject only in certain periods", scope: "subject", defaultSeverity: "must", fields: [subjects(), classes(), { kind: "slots", key: "slots", label: "Allowed periods" }] },
  { template: "subject_never_periods", label: "A subject never in certain periods", scope: "subject", defaultSeverity: "must", fields: [subjects(), classes(), { kind: "slots", key: "slots", label: "Blocked periods" }] },
  { template: "subject_not_last", label: "A subject never in the last period", scope: "subject", defaultSeverity: "must", fields: [subjects(), classes()] },
  // --- subject (aggregate) ---
  { template: "subject_max_per_day", label: "Limit periods of a subject per day", scope: "subject", defaultSeverity: "must", fields: [subjects(), classes(), { kind: "number", key: "max", label: "Max per day", def: 2 }] },
  { template: "subject_spread_min_days", label: "Spread a subject across several days", scope: "subject", defaultSeverity: "prefer", fields: [subjects(), classes(), { kind: "number", key: "minDays", label: "At least N days", def: 3 }] },
  { template: "subject_order", label: "One subject before another (same day)", scope: "subject", defaultSeverity: "prefer", fields: [{ kind: "class", key: "classId", label: "Class" }, { kind: "subject", key: "beforeSubjectId", label: "Comes first" }, { kind: "subject", key: "afterSubjectId", label: "Then" }] },
  { template: "subject_not_adjacent_to", label: "Two subjects not back-to-back", scope: "subject", defaultSeverity: "prefer", fields: [{ kind: "class", key: "classId", label: "Class" }, { kind: "subject", key: "subjectAId", label: "Subject" }, { kind: "subject", key: "subjectBId", label: "And subject" }] },
  // --- teacher ---
  { template: "teacher_max_per_week", label: "A teacher's weekly period limit", scope: "teacher", defaultSeverity: "must", fields: [{ kind: "teacher", key: "teacherId", label: "Teacher" }, { kind: "number", key: "max", label: "Max per week", def: 30 }] },
  { template: "teacher_max_per_day", label: "A teacher's daily period limit", scope: "teacher", defaultSeverity: "must", fields: [{ kind: "teacher", key: "teacherId", label: "Teacher" }, { kind: "number", key: "max", label: "Max per day", def: 6 }] },
  { template: "teacher_max_consecutive", label: "A teacher's max periods in a row", scope: "teacher", defaultSeverity: "prefer", fields: [{ kind: "teacher", key: "teacherId", label: "Teacher" }, { kind: "number", key: "max", label: "Max in a row", def: 4 }] },
  { template: "teacher_max_days_per_week", label: "A teacher's max teaching days", scope: "teacher", defaultSeverity: "prefer", fields: [{ kind: "teacher", key: "teacherId", label: "Teacher" }, { kind: "number", key: "max", label: "Max days", def: 5 }] },
  { template: "teacher_min_free_per_week", label: "A teacher's minimum free periods", scope: "teacher", defaultSeverity: "prefer", fields: [{ kind: "teacher", key: "teacherId", label: "Teacher" }, { kind: "number", key: "min", label: "At least N free", def: 4 }] },
  { template: "teacher_compact_day", label: "Keep a teacher's day gap-free", scope: "teacher", defaultSeverity: "prefer", fields: [{ kind: "teacher", key: "teacherId", label: "Teacher" }] },
  { template: "teacher_not_first_period", label: "A teacher never teaches first period", scope: "teacher", defaultSeverity: "prefer", fields: [{ kind: "teacher", key: "teacherId", label: "Teacher" }] },
  { template: "teacher_not_last_period", label: "A teacher never teaches last period", scope: "teacher", defaultSeverity: "prefer", fields: [{ kind: "teacher", key: "teacherId", label: "Teacher" }] },
  // --- class ---
  { template: "class_teacher_p1", label: "Class teacher takes period 1 daily", scope: "class", defaultSeverity: "prefer", fields: [{ kind: "class", key: "classId", label: "Class" }] },
  { template: "class_max_teachers_per_day", label: "Limit different teachers per day", scope: "class", defaultSeverity: "prefer", fields: [{ kind: "class", key: "classId", label: "Class" }, { kind: "number", key: "max", label: "Max teachers", def: 6 }] },
  { template: "class_daily_variety", label: "No repeating a subject within a day", scope: "class", defaultSeverity: "prefer", fields: [{ kind: "class", key: "classId", label: "Class" }] },
  { template: "class_max_consecutive_same", label: "Max periods of one subject in a row", scope: "class", defaultSeverity: "prefer", fields: [{ kind: "class", key: "classId", label: "Class" }, { kind: "number", key: "max", label: "Max in a row", def: 2 }] },
  { template: "class_no_free", label: "No free periods for a class", scope: "class", defaultSeverity: "prefer", fields: [{ kind: "class", key: "classId", label: "Class" }] },
  { template: "class_board_protect", label: "Protect a board class's morning", scope: "class", defaultSeverity: "prefer", fields: [{ kind: "class", key: "classId", label: "Class" }, subjects("coreSubjectIds", "Core subjects")] },
  // --- global ---
  { template: "balance_teacher_loads", label: "Balance teacher workloads", scope: "global", defaultSeverity: "prefer", fields: [{ kind: "number", key: "maxSpread", label: "Max spread", def: 6 }] },
  { template: "core_subjects_early", label: "Teach core subjects earlier", scope: "global", defaultSeverity: "prefer", fields: [subjects()] },
];

export const descriptorFor = (t: ConstraintTemplate): Descriptor => CATALOG.find((d) => d.template === t)!;
