# Data Model — single source of truth

These types are canonical. Implement them verbatim in `src/domain/types.ts`. Any change requires editing this doc in the same commit.

## Core entities

```ts
type Id = string; // nanoid-style opaque ids

interface Teacher {
  id: Id;
  name: string;            // unique display name, e.g. "Bindu"
  subjects: Id[];          // subject ids they can teach
  maxPeriodsPerDay: number;    // default 6
  maxPeriodsPerWeek: number;   // default 36
  unavailable: SlotRef[];      // hard blocks (part-time, duties)
}

interface SchoolClass {
  id: Id;
  name: string;            // "Class 7", "Class 11 Science"
  group: "primary" | "middle" | "senior";
}

interface Subject {
  id: Id;
  name: string;            // "Maths", "ELGA", "Physics"
  color?: string;          // UI hint
}

interface SlotRef { day: Day; period: number; }    // period is 1-based
type Day = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat";
```

## Schedule profile (timings are metadata, never columns)

```ts
interface ScheduleProfile {
  id: Id;
  name: string;                  // "heatwave", "winter"
  days: Day[];                   // typically all 6
  periods: PeriodDef[];          // length 6 currently
}
interface PeriodDef { label: string; start: string; end: string; } // "07:30"
```

## Activities — what occupies cells

```ts
// A normal single-cell lesson
interface Lesson {
  kind: "lesson";
  id: Id;
  classId: Id;
  subjectId: Id;
  teacherIds: Id[];        // 1..n (multi-teacher cells allowed)
}

// An atomic multi-class multi-period block (ELGA)
interface BlockActivity {
  kind: "block";
  id: Id;
  name: string;            // "ELGA"
  classIds: Id[];          // all 5 primary classes
  teacherIds: Id[];        // all 5 primary teachers
  length: number;          // consecutive periods, e.g. 3
  // Placement of a block = (day, startPeriod). It fills
  // [startPeriod, startPeriod+length) for EVERY class in classIds
  // and occupies EVERY teacher in teacherIds for those periods.
}

type Activity = Lesson | BlockActivity;
```

## The timetable

```ts
// One placement = activity pinned to a slot.
interface Placement {
  activityId: Id;
  day: Day;
  period: number;          // for blocks: the START period
  pinned: boolean;         // pinned placements are immovable by the solver
}

interface Timetable {
  id: Id;
  name: string;
  profileId: Id;
  placements: Placement[];
  // Derived (never stored): cell map class×day×period -> Activity,
  // teacher occupancy map teacher×day×period -> Activity.
  // Build these with selectors in domain/derive.ts.
}
```

## Requirements (drive generation & quota validation)

```ts
// "Class 7 needs 5 periods of Maths per week taught by Nidhika"
interface CurriculumRequirement {
  id: Id;
  classId: Id;
  subjectId: Id;
  teacherIds: Id[];        // allowed teachers (usually 1)
  periodsPerWeek: number;
  maxPerDay?: number;      // default 2
}

// "ELGA runs Mon/Tue/Wed as a 3-period block starting P3"
interface BlockRequirement {
  id: Id;
  blockActivityId: Id;
  occurrences: { day: Day; startPeriod?: number }[]; // startPeriod omitted = solver decides
}
```

## Project file (persistence unit)

```ts
interface Project {
  schemaVersion: 1;
  school: { name: string };
  teachers: Teacher[];
  classes: SchoolClass[];
  subjects: Subject[];
  profiles: ScheduleProfile[];
  activities: Activity[];
  requirements: { curriculum: CurriculumRequirement[]; blocks: BlockRequirement[] };
  timetables: Timetable[];   // multiple drafts/candidates
  activeTimetableId: Id | null;
}
```

Stored in IndexedDB (`idb`), and importable/exportable as a single pretty-printed JSON file (`*.ttproj.json`). JSON export is the backup story — there is no server.

## Legacy export (compatibility contract with the viewer)

`exportLegacyRawData(project, timetableId): string` must emit the exact text format the existing viewer parses:

```
Monday
Class,Period 1,Period 2,Period 3,Period 4,Period 5,Period 6
Class 1,Maths (Bindu),EVS (Ravina),ELGA (Bindu / Anita / Rashmita / Kusum / Ravina),...
...
Tuesday
...
```

Rules: cell = `Subject (Teacher)` with multi-teacher joined by ` / `; empty = `Free`; one header row per day; class rows in school order; blocks expand to one cell per period per class. A round-trip test (export → legacy-style parse → compare) is required in M1.

## Validation result shape (shared by editor & solver)

```ts
interface Violation {
  constraintId: string;        // from docs/CONSTRAINTS.md, e.g. "H1"
  severity: "hard" | "soft";
  message: string;             // human-readable, names entities
  slots: { classId?: Id; teacherId?: Id; day: Day; period: number }[];
}
// validate(project, timetable): Violation[]  — pure function in domain/validate.ts
```
