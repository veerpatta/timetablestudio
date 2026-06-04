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
}

export interface PeriodDef {
  label: string;
  start: string;
  end: string;
} // "07:30"

// --- Activities — what occupies cells ---

// A normal single-cell lesson
export interface Lesson {
  kind: "lesson";
  id: Id;
  classId: Id;
  subjectId: Id;
  teacherIds: Id[]; // 1..n (multi-teacher cells allowed)
}

// An atomic multi-class multi-period block (ELGA)
export interface BlockActivity {
  kind: "block";
  id: Id;
  name: string; // "ELGA"
  classIds: Id[]; // all 5 primary classes
  teacherIds: Id[]; // all 5 primary teachers
  length: number; // consecutive periods, e.g. 3
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
  schemaVersion: 1;
  school: { name: string };
  teachers: Teacher[];
  classes: SchoolClass[];
  subjects: Subject[];
  profiles: ScheduleProfile[];
  activities: Activity[];
  requirements: { curriculum: CurriculumRequirement[]; blocks: BlockRequirement[] };
  timetables: Timetable[]; // multiple drafts/candidates
  activeTimetableId: Id | null;
}

// --- Validation result shape (shared by editor & solver) ---

export interface Violation {
  constraintId: string; // from docs/CONSTRAINTS.md, e.g. "H1"
  severity: "hard" | "soft";
  message: string; // human-readable, names entities
  slots: { classId?: Id; teacherId?: Id; day: Day; period: number }[];
}
