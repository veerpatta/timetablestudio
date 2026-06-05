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
  classTeacherId?: Id;     // v2: homeroom teacher (powers rule R4)
  isBoardClass?: boolean;  // v2: board-class priority flag (powers rule R9)
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
  break?: ProfileBreak;          // v2: a positioned break (e.g. after P4, 10:10–10:25)
}
interface PeriodDef { label: string; start: string; end: string; } // "07:30"
interface ProfileBreak { afterPeriod: number; start: string; end: string; } // v2
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
  duration?: number;       // v2: periods occupied as one unit (1 default, 2 = double period)
  // A duration-2 lesson placed at (day, p) occupies p and p+1 atomically —
  // moved/removed as one unit, clash-checked like a 2-period mini-block.
}

// An atomic multi-class multi-period block (ELGA)
interface BlockActivity {
  kind: "block";
  id: Id;
  name: string;            // "ELGA"
  classIds: Id[];          // all 5 primary classes
  teacherIds: Id[];        // all 5 primary teachers
  length: number;          // consecutive periods, e.g. 3
  allowedDays?: Day[];     // v2: days the block may run (ELGA = Mon–Thu); powers rule R7
  fixedStartPeriod?: number; // v2: forced start period (ELGA = P3); powers rule R7
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
  schemaVersion: 2;
  school: { name: string };
  teachers: Teacher[];
  classes: SchoolClass[];
  subjects: Subject[];
  profiles: ScheduleProfile[];
  activities: Activity[];
  requirements: { curriculum: CurriculumRequirement[]; blocks: BlockRequirement[] };
  rules: Rule[];             // v2: user-configurable constraints (R1–R15), see below
  timetables: Timetable[];   // multiple drafts/candidates
  activeTimetableId: Id | null;
}
```

A v1 project (no `rules`, `schemaVersion: 1`) loads via `persistence/migrations.migrate`, which adds `rules: []` and bumps to v2 (back-compat, AGENTS §5).

## Rules — user-configurable constraints (v2, R1–R15)

A `Rule` is a stored entity compiled to a predicate over `(project, timetable)` that reuses the `Violation` shape. `severity: "must"` joins the hard count (evaluated in `validate()`); `severity: "prefer"` contributes `weight × violations` to the soft score (evaluated in `scoreTimetable()`). Each template maps 1:1 to a row of CONSTRAINTS.md § v4. A discriminated union on `template` keeps params type-safe (no `any`).

```ts
type RuleSeverity = "must" | "prefer";
type HalfOfDay = "first" | "second";

interface RuleBase {
  id: Id;
  enabled: boolean;        // off rules are ignored by validate/score
  severity: RuleSeverity;  // must = hard, prefer = weighted soft
  weight: number;          // soft weight when severity === "prefer"
}

// R1 "{subject} only in periods {set}"        — periods a subject IS allowed in
interface R1Rule extends RuleBase { template: "R1"; subjectIds: Id[]; classIds: Id[]; periods: number[]; }
// R2 "{subject} never in period {set}"        — periods a subject is NOT allowed in
interface R2Rule extends RuleBase { template: "R2"; subjectIds: Id[]; classIds: Id[]; periods: number[]; }
// R3 "{subject} in the first/second half"
interface R3Rule extends RuleBase { template: "R3"; subjectIds: Id[]; classIds: Id[]; half: HalfOfDay; }
// R4 "{teacher} is class teacher of {class} — takes period 1 daily"
//    teacher is read from SchoolClass.classTeacherId; subjectId optionally fixes the P1 subject
interface R4Rule extends RuleBase { template: "R4"; classId: Id; subjectId?: Id; }
// R5 "{subject} same period every day in {class}"
interface R5Rule extends RuleBase { template: "R5"; classId: Id; subjectId: Id; period?: number; }
// R6 "{subject} as a double period ({n}×/week) in {class}"
interface R6Rule extends RuleBase { template: "R6"; classId: Id; subjectId: Id; count: number; }
// R7 "Block {name} runs only on {days}, starting period {p}"
//    days = block.allowedDays, start = block.fixedStartPeriod (structural facts on the block)
interface R7Rule extends RuleBase { template: "R7"; blockId: Id; }
// R8 "{teacher} not available {slots}"  (rule-layer complement to Teacher.unavailable / H5)
interface R8Rule extends RuleBase { template: "R8"; teacherId: Id; slots: SlotRef[]; }
// R9 "{class} is a board class — protect core subjects"
//    gated by SchoolClass.isBoardClass; operationalized as "no non-core subject in P1–3"
interface R9Rule extends RuleBase { template: "R9"; classId: Id; coreSubjectIds: Id[]; }
// R10 "{subject} spread across ≥{n} different days"
interface R10Rule extends RuleBase { template: "R10"; subjectId: Id; classIds: Id[]; minDays: number; }
// R11 "Max {n} periods/day of {subject} for {class}"
interface R11Rule extends RuleBase { template: "R11"; subjectId: Id; classId: Id; maxPerDay: number; }
// R12 "{teacher} max {n} periods per day / {m} per week"
interface R12Rule extends RuleBase { template: "R12"; teacherId: Id; maxPerDay: number; maxPerWeek: number; }
// R13 "Teachers' days compact (few free gaps)"   (global; prefer)
interface R13Rule extends RuleBase { template: "R13"; }
// R14 "{subject A} before {subject B} on the same day"
interface R14Rule extends RuleBase { template: "R14"; classId: Id; beforeSubjectId: Id; afterSubjectId: Id; }
// R15 "Teacher {T} max {n} consecutive periods"
interface R15Rule extends RuleBase { template: "R15"; teacherId: Id; maxConsecutive: number; }

type Rule =
  | R1Rule | R2Rule | R3Rule | R4Rule | R5Rule | R6Rule | R7Rule | R8Rule
  | R9Rule | R10Rule | R11Rule | R12Rule | R13Rule | R14Rule | R15Rule;
```

`Violation.constraintId` for a rule violation is its template id (`"R4"` etc.). Every rule also renders as a plain-language sentence (`domain/ruleText.ruleSentence`) used both in the violation message and the M16 UI label — one phrasing, never two.

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
