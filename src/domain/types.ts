// Canonical domain types — implements docs/DATA_MODEL.md § "v6 event model" verbatim.
// This is the ONLY place domain shapes are declared (AGENTS.md §1, §3).
// Any change here requires editing docs/DATA_MODEL.md in the same commit.
//
// v6 REBUILD (2026-06-07): the cell model (Lesson / BlockActivity / per-cell
// Placement) is gone. The source of truth is now the EVENT model: one
// TimetableEvent may span many classes AND many teachers. See docs/REBUILD.md.

export type Id = string; // nanoid-style opaque ids
export type Day = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat";

// --- Time grid: a profile is Assembly + N teaching periods + a positioned Recess ---

export interface SlotDef {
  index: number; // 0 = Assembly, 1..8 teaching, 9 = Recess, etc.
  label: string; // "Assembly", "P1", "Recess"
  start: string; // "08:00"
  end: string; // "08:30"
  teaching: boolean; // false for Assembly/Recess (engine never fills these)
}

export interface Profile {
  id: Id;
  name: string; // "Regular 2026-27" (the 8-period default)
  days: Day[]; // Mon–Sat
  slots: SlotDef[]; // regular = Assembly, P1..P8, Recess
  isDefault?: boolean;
}

// --- Core entities ---

export interface Teacher {
  id: Id;
  name: string;
  maxPerDay: number;
  maxPerWeek: number;
  schedulable: boolean; // Director = false
  // availability: which (day, teaching-slot) this teacher CANNOT work.
  // Absent entry = available. Use for Mahesh (narrow) / Anjana (P5–P8 only).
  unavailable: { day: Day; slot: number }[];
}

export type Band = "primary" | "middle" | "secondary" | "senior";

export interface SchoolClass {
  id: Id;
  name: string; // "Class 7", "Class 11 Science"
  band: Band;
  stream?: "Science" | "Commerce" | "Arts";
  classTeacherId?: Id;
  isBoardClass?: boolean;
}

export interface Subject {
  id: Id;
  name: string; // "Maths", "ELGA", "Physics"
  bands: Band[]; // scoping; "Science" is 3 subjects in middle, 1 in secondary
  kind: "academic" | "activity" | "study" | "fixed";
  // activity = Sports/Robotics/CCS, study = Free/SelfStudy, fixed = Assembly/Recess
  color?: string;
}

export interface Room {
  id: Id;
  name: string;
} // lab, ground, robotics — optional on events

// --- THE central concept: one event, possibly many classes AND many teachers ---

export type EventType =
  | "normal" // 1 class, 1+ teachers
  | "joint_class" // many classes, 1 teacher (senior combined English/Hindi/Economics)
  | "team_block" // many classes, many teachers (ELGA)
  | "self_study"
  | "free"
  | "sports"
  | "robotics"
  | "ccs"
  | "notebook_check"
  | "assembly"
  | "recess";

export type EventSource = "imported" | "manual" | "generated" | "locked";

export interface TimetableEvent {
  id: Id;
  type: EventType;
  subjectId: Id;
  classIds: Id[]; // 1..n
  teacherIds: Id[]; // 0..n (study/free may have 0; team_block has n)
  roomId?: Id;
  duration: number; // teaching slots occupied as one unit (1 default, 2 = double)
  source: EventSource;
  notes?: string;
}

export interface Placement {
  eventId: Id;
  day: Day;
  slot: number; // start slot; a duration-2 event also occupies slot+1
  pinned: boolean; // locked: solver never moves/removes
}

// What a teacher CAN teach. The engine may use ONLY these triples.
export interface Qualification {
  teacherId: Id;
  subjectId: Id;
  classId: Id;
}

// Weekly demand per (class, subject); drives fill + quota checks.
export interface Requirement {
  id: Id;
  classId: Id;
  subjectId: Id;
  teacherIds: Id[];
  periodsPerWeek: number;
  preferDouble?: boolean;
  maxPerDay?: number;
}

export interface Timetable {
  id: Id;
  name: string;
  profileId: Id;
  placements: Placement[];
}

export interface Project {
  schemaVersion: 6;
  bundledDataVersion: number; // bump when the built-in 2026-27 timetable changes
  school: { name: string };
  profiles: Profile[];
  teachers: Teacher[];
  classes: SchoolClass[];
  subjects: Subject[];
  rooms: Room[];
  qualifications: Qualification[];
  requirements: Requirement[];
  events: TimetableEvent[];
  rules: Rule[]; // carried from v2 catalog, evaluated on the event model (RB6)
  timetables: Timetable[];
  activeTimetableId: Id | null;
}

// --- Rules (carried from v2 catalog; re-evaluated on the event model in RB6) ---
// Discriminated union on `template` keeps params type-safe (no `any`).
// Each template maps 1:1 to a row of docs/CONSTRAINTS.md § v4 (R1–R15).

export interface SlotRef {
  day: Day;
  slot: number;
}

export type RuleSeverity = "must" | "prefer"; // must = hard, prefer = weighted soft
export type HalfOfDay = "first" | "second";

export interface RuleBase {
  id: Id;
  enabled: boolean; // off rules are ignored by validate/score
  severity: RuleSeverity;
  weight: number; // soft weight when severity === "prefer"
}

export interface R1Rule extends RuleBase {
  template: "R1";
  subjectIds: Id[];
  classIds: Id[];
  slots: number[];
}
export interface R2Rule extends RuleBase {
  template: "R2";
  subjectIds: Id[];
  classIds: Id[];
  slots: number[];
}
export interface R3Rule extends RuleBase {
  template: "R3";
  subjectIds: Id[];
  classIds: Id[];
  half: HalfOfDay;
}
export interface R4Rule extends RuleBase {
  template: "R4";
  classId: Id;
  subjectId?: Id;
}
export interface R5Rule extends RuleBase {
  template: "R5";
  classId: Id;
  subjectId: Id;
  slot?: number;
}
export interface R6Rule extends RuleBase {
  template: "R6";
  classId: Id;
  subjectId: Id;
  count: number;
}
export interface R7Rule extends RuleBase {
  template: "R7";
  eventId: Id;
}
export interface R8Rule extends RuleBase {
  template: "R8";
  teacherId: Id;
  slots: SlotRef[];
}
export interface R9Rule extends RuleBase {
  template: "R9";
  classId: Id;
  coreSubjectIds: Id[];
}
export interface R10Rule extends RuleBase {
  template: "R10";
  subjectId: Id;
  classIds: Id[];
  minDays: number;
}
export interface R11Rule extends RuleBase {
  template: "R11";
  subjectId: Id;
  classId: Id;
  maxPerDay: number;
}
export interface R12Rule extends RuleBase {
  template: "R12";
  teacherId: Id;
  maxPerDay: number;
  maxPerWeek: number;
}
export interface R13Rule extends RuleBase {
  template: "R13";
}
export interface R14Rule extends RuleBase {
  template: "R14";
  classId: Id;
  beforeSubjectId: Id;
  afterSubjectId: Id;
}
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
  constraintId: string; // event-model hard ids "HE1".."HE8", or rule template "R4"
  severity: "hard" | "soft";
  message: string; // human-readable, names entities
  slots: { classId?: Id; teacherId?: Id; eventId?: Id; day: Day; slot: number }[];
}
