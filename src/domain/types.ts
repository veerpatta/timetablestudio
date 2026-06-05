// Canonical domain types — implements docs/DATA_MODEL.md verbatim.
// This is the ONLY place domain shapes are declared (AGENTS.md §1, §3).
// Any change here requires editing docs/DATA_MODEL.md in the same commit.

export type Id = string; // nanoid-style opaque ids

export interface Teacher {
  id: Id;
  name: string; // unique display name, e.g. "Bindu"
  subjects: Id[]; // subject ids they can teach
  maxPeriodsPerDay: number; // default 6
  maxPeriodsPerWeek: number; // default 36
  unavailable: SlotRef[]; // hard blocks (part-time, duties)
}

export interface SchoolClass {
  id: Id;
  name: string; // "Class 7", "Class 11 Science"
  group: "primary" | "middle" | "senior";
  classTeacherId?: Id; // v2: homeroom teacher (powers rule R4)
  isBoardClass?: boolean; // v2: board-class priority flag (powers rule R9)
}

export interface Subject {
  id: Id;
  name: string; // "Maths", "ELGA", "Physics"
  color?: string; // UI hint
}

export interface SlotRef {
  day: Day;
  period: number;
} // period is 1-based

export type Day = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat";

// --- Schedule profile (timings are metadata, never columns) ---

export interface ScheduleProfile {
  id: Id;
  name: string; // "heatwave", "winter"
  days: Day[]; // typically all 6
  periods: PeriodDef[]; // length 6 currently
  break?: ProfileBreak; // v2: a positioned break (e.g. after P4, 10:10–10:25)
}

export interface PeriodDef {
  label: string;
  start: string;
  end: string;
} // "07:30"

export interface ProfileBreak {
  afterPeriod: number; // break sits between this period and the next
  start: string;
  end: string;
} // v2

// --- Activities — what occupies cells ---

// A normal single-cell lesson
export interface Lesson {
  kind: "lesson";
  id: Id;
  classId: Id;
  subjectId: Id;
  teacherIds: Id[]; // 1..n (multi-teacher cells allowed)
  duration?: number; // v2: periods occupied as one unit (1 default, 2 = double period)
  // A duration-2 lesson placed at (day, p) occupies p and p+1 atomically —
  // moved/removed as one unit, clash-checked like a 2-period mini-block.
}

// An atomic multi-class multi-period block (ELGA)
export interface BlockActivity {
  kind: "block";
  id: Id;
  name: string; // "ELGA"
  classIds: Id[]; // all 5 primary classes
  teacherIds: Id[]; // all 5 primary teachers
  length: number; // consecutive periods, e.g. 3
  allowedDays?: Day[]; // v2: days the block may run (ELGA = Mon–Thu); powers rule R7
  fixedStartPeriod?: number; // v2: forced start period (ELGA = P3); powers rule R7
  // Placement of a block = (day, startPeriod). It fills
  // [startPeriod, startPeriod+length) for EVERY class in classIds
  // and occupies EVERY teacher in teacherIds for those periods.
}

export type Activity = Lesson | BlockActivity;

// --- The timetable ---

// One placement = activity pinned to a slot.
export interface Placement {
  activityId: Id;
  day: Day;
  period: number; // for blocks: the START period
  pinned: boolean; // pinned placements are immovable by the solver
}

export interface Timetable {
  id: Id;
  name: string;
  profileId: Id;
  placements: Placement[];
  // Derived (never stored): cell map class×day×period -> Activity,
  // teacher occupancy map teacher×day×period -> Activity.
  // Build these with selectors in domain/derive.ts.
}

// --- Requirements (drive generation & quota validation) ---

// "Class 7 needs 5 periods of Maths per week taught by Nidhika"
export interface CurriculumRequirement {
  id: Id;
  classId: Id;
  subjectId: Id;
  teacherIds: Id[]; // allowed teachers (usually 1)
  periodsPerWeek: number;
  maxPerDay?: number; // default 2
}

// "ELGA runs Mon/Tue/Wed as a 3-period block starting P3"
export interface BlockRequirement {
  id: Id;
  blockActivityId: Id;
  occurrences: { day: Day; startPeriod?: number }[]; // startPeriod omitted = solver decides
}

// --- Project file (persistence unit) ---

export interface Project {
  schemaVersion: 2;
  school: { name: string };
  teachers: Teacher[];
  classes: SchoolClass[];
  subjects: Subject[];
  profiles: ScheduleProfile[];
  activities: Activity[];
  requirements: { curriculum: CurriculumRequirement[]; blocks: BlockRequirement[] };
  rules: Rule[]; // v2: user-configurable constraints (R1–R15)
  timetables: Timetable[]; // multiple drafts/candidates
  activeTimetableId: Id | null;
}

// --- Rules (v2) — user-configurable constraints, see docs/DATA_MODEL.md ---
// Discriminated union on `template` keeps params type-safe (no `any`).
// Each template maps 1:1 to a row of docs/CONSTRAINTS.md § v4 (R1–R15).

export type RuleSeverity = "must" | "prefer"; // must = hard, prefer = weighted soft
export type HalfOfDay = "first" | "second";

export interface RuleBase {
  id: Id;
  enabled: boolean; // off rules are ignored by validate/score
  severity: RuleSeverity;
  weight: number; // soft weight when severity === "prefer"
}

// R1 "{subject} only in periods {set}"
export interface R1Rule extends RuleBase {
  template: "R1";
  subjectIds: Id[];
  classIds: Id[];
  periods: number[];
}
// R2 "{subject} never in period {set}"
export interface R2Rule extends RuleBase {
  template: "R2";
  subjectIds: Id[];
  classIds: Id[];
  periods: number[];
}
// R3 "{subject} in the first/second half of the day"
export interface R3Rule extends RuleBase {
  template: "R3";
  subjectIds: Id[];
  classIds: Id[];
  half: HalfOfDay;
}
// R4 "{teacher} is class teacher of {class} — takes period 1 daily"
// teacher is read from SchoolClass.classTeacherId; subjectId optionally fixes the P1 subject.
export interface R4Rule extends RuleBase {
  template: "R4";
  classId: Id;
  subjectId?: Id;
}
// R5 "{subject} same period every day in {class}"
export interface R5Rule extends RuleBase {
  template: "R5";
  classId: Id;
  subjectId: Id;
  period?: number;
}
// R6 "{subject} as a double period ({n}×/week) in {class}"
export interface R6Rule extends RuleBase {
  template: "R6";
  classId: Id;
  subjectId: Id;
  count: number;
}
// R7 "Block {name} runs only on {days}, starting period {p}"
// days = block.allowedDays, start = block.fixedStartPeriod (structural facts on the block).
export interface R7Rule extends RuleBase {
  template: "R7";
  blockId: Id;
}
// R8 "{teacher} not available {slots}" (rule-layer complement to Teacher.unavailable / H5)
export interface R8Rule extends RuleBase {
  template: "R8";
  teacherId: Id;
  slots: SlotRef[];
}
// R9 "{class} is a board class — protect core subjects"
// gated by SchoolClass.isBoardClass; operationalized as "no non-core subject in P1–3".
export interface R9Rule extends RuleBase {
  template: "R9";
  classId: Id;
  coreSubjectIds: Id[];
}
// R10 "{subject} spread across ≥{n} different days"
export interface R10Rule extends RuleBase {
  template: "R10";
  subjectId: Id;
  classIds: Id[];
  minDays: number;
}
// R11 "Max {n} periods/day of {subject} for {class}"
export interface R11Rule extends RuleBase {
  template: "R11";
  subjectId: Id;
  classId: Id;
  maxPerDay: number;
}
// R12 "{teacher} max {n} periods per day / {m} per week"
export interface R12Rule extends RuleBase {
  template: "R12";
  teacherId: Id;
  maxPerDay: number;
  maxPerWeek: number;
}
// R13 "Teachers' days compact (few free gaps)" (global; prefer)
export interface R13Rule extends RuleBase {
  template: "R13";
}
// R14 "{subject A} before {subject B} on the same day"
export interface R14Rule extends RuleBase {
  template: "R14";
  classId: Id;
  beforeSubjectId: Id;
  afterSubjectId: Id;
}
// R15 "Teacher {T} max {n} consecutive periods"
export interface R15Rule extends RuleBase {
  template: "R15";
  teacherId: Id;
  maxConsecutive: number;
}

export type Rule =
  | R1Rule
  | R2Rule
  | R3Rule
  | R4Rule
  | R5Rule
  | R6Rule
  | R7Rule
  | R8Rule
  | R9Rule
  | R10Rule
  | R11Rule
  | R12Rule
  | R13Rule
  | R14Rule
  | R15Rule;

export type RuleTemplate = Rule["template"];

// --- Validation result shape (shared by editor & solver) ---

export interface Violation {
  constraintId: string; // from docs/CONSTRAINTS.md, e.g. "H1"
  severity: "hard" | "soft";
  message: string; // human-readable, names entities
  slots: { classId?: Id; teacherId?: Id; day: Day; period: number }[];
}
