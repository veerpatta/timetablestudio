# VPPS Timetable Complexity Analysis 2026-27

**School:** Shri Veer Patta Senior Secondary School / Veer Patta School / VPPS  
**Purpose:** Analysis for building a timetable generator app for the school  
**Source views analysed:** Class-wise timetable, teacher-wise timetable, and day-wise timetable  

---

## 1. Executive Summary

The current 2026-27 timetable is **not a simple class-by-class timetable**. It is a **resource-constrained, block-based school timetable** built around:

- teacher availability,
- shared programs,
- senior-stream combinations,
- high-load specialist teachers,
- joint classes,
- team-taught blocks,
- and fixed institutional patterns such as ELGA.

For a single-section school, this timetable is surprisingly complex. The complexity does not come from having many sections per class. It comes from the fact that many classes, teachers, and subjects are interconnected.

A normal timetable generator that assumes one class, one subject, one teacher, and one room per period will not work properly for VPPS. The app must support:

- normal single-class periods,
- joint classes,
- team-taught blocks,
- teacher unavailability,
- free/self-study periods,
- locked blocks,
- subject-period requirements,
- teacher load limits,
- and validation across class-wise, teacher-wise, and day-wise views.

**Overall complexity rating:** **8 / 10 for a single-section school**

---

## 2. Basic Timetable Structure

The uploaded timetable covers the following class groups:

- Class 1
- Class 2
- Class 3
- Class 4
- Class 5
- Class 6
- Class 7
- Class 8
- Class 9
- Class 10
- Class 11 Science
- Class 11 Commerce
- Class 11 Arts
- Class 12 Science
- Class 12 Commerce
- Class 12 Arts

That means the current uploaded timetable covers **16 class/stream groups**.

The uploaded timetable does **not** include Nursery, JKG, or SKG, even though the broader school structure includes pre-primary to Class 12.

### Weekly structure

| Item | Structure |
|---|---:|
| Working days | Monday to Saturday |
| Assembly | 8:00-8:30 |
| Periods per day | 8 |
| Period length | 40 minutes |
| Recess | 11:10-11:30 |
| Class groups in uploaded timetable | 16 |
| Class-period cells | 16 x 6 x 8 = 768 |
| Teacher-wise pages | 19, including Director page |
| Active teaching staff in timetable | 18, excluding Director |

The timetable exists in three major views:

1. **Class-wise view** — what each class studies every period.
2. **Teacher-wise view** — where each teacher is every period, including free and unavailable periods.
3. **Day-wise view** — whole-school view for each day, useful for checking clashes and operational flow.

For the timetable generator app, all three views should be generated automatically from one source of truth.

---

## 3. Why the Timetable Is Complex

The timetable is complex because it solves multiple constraints at the same time.

Main complexity sources:

1. Classes 1-5 share a large fixed ELGA block.
2. Senior secondary streams have merged common subjects.
3. Some teachers are almost fully loaded.
4. Some teachers have partial-day availability only.
5. Specialist subjects such as CCS, Robotics, Sports, and Notebook Checking have limited teacher/resource availability.
6. Board classes need high-frequency core subject periods.
7. Senior classes need stream-specific and combined-subject handling.
8. Some same-slot overlaps are valid joint classes, not errors.
9. The school has one section per class, but many cross-class dependencies.

This means the app must not only place subjects. It must understand **why** some periods are locked and why some apparent clashes are actually valid joint events.

---

## 4. The Most Important Hidden Rule: ELGA Block for Classes 1-5

The strongest structural pattern in the timetable is the **ELGA block** for Classes 1-5.

Classes 1-5 have ELGA fixed from **Monday to Thursday in P3, P4, and P5**.

| ELGA block | Value |
|---|---:|
| Classes involved | Class 1, 2, 3, 4, 5 |
| Days | Monday-Thursday |
| Periods | P3, P4, P5 |
| Class-periods consumed | 5 classes x 4 days x 3 periods = 60 class slots |
| Teachers involved | Bindu, Anita, Rashmita, Kusum, Ravina |
| Teacher-event slots | 5 teachers x 4 days x 3 periods = 60 teacher assignments |

This is not five separate ordinary English periods. It is a **shared program block**.

The app should model this as a special event:

```text
Event type: team_taught_block
Subject: ELGA
Classes: Class 1, Class 2, Class 3, Class 4, Class 5
Teachers: Bindu, Anita, Rashmita, Kusum, Ravina
Locked slots: Monday-Thursday, P3-P5
```

This single rule explains a lot of the primary timetable structure. Other subjects like Maths, Hindi, EVS, CCS, Sports, Robotics, and Notebook Checking are arranged around this protected block.

---

## 5. Stage-wise Understanding of the Timetable

## 5.1 Classes 1-4: Foundation Pattern

Classes 1-4 follow a highly regular primary-school pattern.

Approximate weekly pattern:

| Subject | Weekly periods |
|---|---:|
| ELGA | 12 |
| Maths | 10 |
| Hindi | 10 |
| EVS | 10 |
| Sports | 2 |
| CCS | 2 |
| Robotics | 1 |
| Notebook Checking | 1 |

This shows a deliberate foundation design:

- English development through ELGA gets the highest protected structure.
- Maths, Hindi, and EVS receive frequent repetition.
- Activity and future-skill subjects are included but limited.
- Young students receive routine and predictable weekly patterns.

For the app, Classes 1-4 should have a **primary rule set**.

Important primary rule ideas:

- no free periods,
- fixed ELGA block,
- core subjects spread across the week,
- limited special subjects,
- avoid too much daily variation,
- keep the timetable easy for small children and class teachers.

---

## 5.2 Class 5: Bridge Class

Class 5 still follows the primary ELGA pattern but starts looking slightly more senior.

Approximate weekly pattern:

| Subject | Weekly periods |
|---|---:|
| ELGA | 12 |
| Maths | 10 |
| Hindi | 9 |
| EVS | 9 |
| English compulsory | 2 |
| CCS | 2 |
| Sports | 2 |
| Robotics | 1 |
| Notebook Checking | 1 |

Class 5 behaves like a transition class:

- It is still inside the ELGA block.
- It still has primary-style EVS.
- It begins to include separate English compulsory periods.
- It prepares students for the more subject-specialist pattern of Class 6 onward.

For the app, Class 5 should probably be its own template type: **upper-primary bridge class**.

---

## 5.3 Classes 6-8: Middle-School Expansion

Classes 6-8 have more subject-specialist structure.

Subjects include:

- English compulsory,
- Hindi,
- Maths,
- SST,
- Sanskrit,
- Physics,
- Chemistry,
- Biology,
- CCS,
- Robotics,
- Sports,
- Notebook Checking.

A key observation is that science is not always treated as one generic subject. In middle classes, the timetable may show Physics, Chemistry, and Biology separately.

For the app, do not hard-code Science as a single subject for every class.

The app should support:

```text
Class 6-8: Physics / Chemistry / Biology components possible
Class 9-10: Science may be combined
Class 11-12: Physics / Chemistry / Biology as stream subjects
```

This is important because teacher allocation and period distribution will differ by class level.

---

## 5.4 Classes 9-10: Board-Preparation Pattern

Classes 9 and 10 have a board-oriented pattern.

High-priority subjects include:

- Science,
- SST,
- Maths,
- English compulsory,
- Hindi,
- Sanskrit.

Class 9 and Class 10 have heavier emphasis on academic core subjects and fewer activity periods.

This tells us that the app needs a separate **board-class rule set** for Classes 9-10.

Possible rules:

- high frequency for Maths, Science, SST, and English,
- avoid too many late-day placements for difficult subjects,
- allow double periods for Science/Maths where useful,
- reduce activity load compared to primary/middle classes,
- keep teacher specialization strict.

---

## 5.5 Classes 11-12: Senior Secondary Stream Pattern

Senior secondary is the most structurally different part of the timetable.

Streams:

- Science,
- Commerce,
- Arts.

Some subjects are stream-specific, but some are shared across streams.

Examples of combined senior groups:

- Class 11 Science + 11 Commerce + 11 Arts — English compulsory
- Class 12 Science + 12 Commerce + 12 Arts — English compulsory
- Class 11 Science + 11 Commerce + 11 Arts — Hindi
- Class 12 Science + 12 Commerce + 12 Arts — Hindi
- Class 11 Commerce + 11 Arts — Economics
- Class 12 Commerce + 12 Arts — Economics

These are not timetable mistakes. These are **merged teaching groups**.

The app must support:

```text
Event type: joint_class
Subject: English compulsory
Teacher: Pradhyuman
Classes: Class 11 Science, Class 11 Commerce, Class 11 Arts
```

And:

```text
Event type: joint_class
Subject: Economics
Teacher: Prakash
Classes: Class 11 Commerce, Class 11 Arts
```

Without joint-class support, the app will wrongly detect many correct senior timetable entries as clashes.

---

## 6. Teacher Workload Analysis

The teacher-wise view reveals the actual pressure in the timetable.

A merged senior class should count as one teaching event for the teacher, not three separate teaching events, because the teacher is physically teaching one combined group.

| Teacher | Teaching events/week | Free periods | Unavailable periods | Utilization of available slots |
|---|---:|---:|---:|---:|
| Mahesh | 18 | 0 | 30 | 100% of available time |
| Harshita | 47 | 1 | 0 | 97.9% |
| Pradhyuman | 46 | 2 | 0 | 95.8% |
| Ravina | 44 | 4 | 0 | 91.7% |
| Hemlata | 43 | 5 | 0 | 89.6% |
| Antima | 43 | 5 | 0 | 89.6% |
| Toshit | 43 | 5 | 0 | 89.6% |
| Prakash | 43 | 5 | 0 | 89.6% |
| Bindu | 42 | 6 | 0 | 87.5% |
| Kusum | 41 | 7 | 0 | 85.4% |
| Nidhika | 41 | 7 | 0 | 85.4% |
| Anita | 40 | 8 | 0 | 83.3% |
| Rashmita | 40 | 8 | 0 | 83.3% |
| Nathulal | 40 | 8 | 0 | 83.3% |
| Maya | 38 | 10 | 0 | 79.2% |
| Jainendra | 37 | 11 | 0 | 77.1% |
| Rakesh | 31 | 17 | 0 | 64.6% |
| Anjana | 10 | 14 | 24 | 41.7% of available time |
| Director | 0 | 48 | 0 | Not used as teaching staff |

This table shows that teacher load balancing is not optional.

Some teachers are almost fully saturated:

- Harshita has only 1 free period.
- Pradhyuman has only 2 free periods.
- Mahesh has no free period during his available time.

If the app ignores teacher load, it may generate a timetable that looks valid but is operationally fragile.

---

## 7. Teacher Availability Constraints

Two teachers show major availability constraints.

## 7.1 Mahesh

Mahesh appears to teach Physics for Classes 11 and 12 Science. His timetable shows many unavailable periods and zero free periods during his available teaching time.

Likely interpretation:

- Mahesh may be part-time, visiting, or only available in the first half.
- Physics must be scheduled first because his availability is narrow.
- If Mahesh is not placed early in the generation process, the solver may fail later.

App rule:

```text
Teacher: Mahesh
Subject: Physics
Classes: 11 Science, 12 Science
Availability: mostly early periods
Hard constraint: never schedule outside available periods
Priority: schedule before flexible teachers
```

---

## 7.2 Anjana

Anjana appears unavailable in P1-P4 every day and teaches Class 1 Hindi after recess.

Her timetable has:

- 24 unavailable periods,
- 14 free periods,
- 10 teaching events.

App rule:

```text
Teacher: Anjana
Subject: Class 1 Hindi
Unavailable: P1-P4 all days
Available: P5-P8
Hard constraint: only schedule after recess
```

This explains why Class 1 Hindi appears mostly in later periods. It is caused by teacher availability, not random placement.

---

## 8. Same-Slot Teacher Overlaps: Not Always Clashes

A simple clash checker would find many cases where one teacher appears against multiple classes in the same period.

In this timetable, many such overlaps are valid.

There are two major valid overlap categories.

## 8.1 ELGA Team Block

Classes 1-5 all show ELGA at the same time, with the same teacher team:

- Bindu,
- Anita,
- Rashmita,
- Kusum,
- Ravina.

This is intentional and should not be flagged as a clash.

## 8.2 Senior Merged Stream Classes

Examples:

- Pradhyuman teaches English compulsory to all Class 11 streams together.
- Pradhyuman teaches English compulsory to all Class 12 streams together.
- Jainendra teaches Hindi to all Class 11 streams together.
- Jainendra teaches Hindi to all Class 12 streams together.
- Prakash teaches Economics to Commerce + Arts groups together.

These are also intentional.

The app needs a clash engine that understands the difference between invalid clashes and valid joint events.

```text
Invalid clash:
Teacher A teaches Class 6 Maths and Class 7 Hindi at the same time.

Valid joint event:
Teacher A teaches Class 11 Science + Class 11 Commerce + Class 11 Arts English at the same time.

Valid team event:
Teachers A+B+C+D+E jointly teach Classes 1-5 ELGA at the same time.
```

This is one of the most important design requirements for the app.

---

## 9. Why the Timetable Is This Way

The timetable is shaped by both academic design and operational scarcity.

## 9.1 ELGA Is a Major Academic Program

ELGA is central to the school's English-confidence promise. That is why Classes 1-5 have a protected ELGA block.

This gives:

- consistency,
- shared teacher deployment,
- program discipline,
- and a strong English-development structure.

## 9.2 Senior Streams Are Small, So Shared Subjects Are Merged

Senior streams have separate needs, but some subjects are common.

Combining English, Hindi, and Economics groups helps the school use teacher time efficiently.

This is especially useful because some streams have smaller student counts.

## 9.3 Teacher Availability Is Uneven

Teachers like Mahesh and Anjana are not available for the full timetable grid.

This forces some subjects into specific periods and reduces generation flexibility.

## 9.4 Some Teachers Carry Very High Loads

Teachers such as Harshita, Pradhyuman, Ravina, Hemlata, Antima, Toshit, and Prakash are heavily used.

This makes the timetable tight and reduces substitution flexibility.

## 9.5 Activity and Resource Subjects Are Fitted Around Core Academics

Subjects like CCS, Robotics, Sports, and Notebook Checking are fitted around core subjects and specialist teacher availability.

Examples:

- Maya handles CCS, Robotics, and Self Study.
- Rakesh handles Sports.
- Antima handles Notebook Checking in many places.

## 9.6 Double Periods Are Used as a Solving Strategy

The timetable often uses consecutive periods for subjects such as:

- Maths,
- Science,
- Accountancy,
- Physics,
- Chemistry,
- Biology,
- EVS,
- Hindi,
- SST,
- Economics,
- Geography.

Double periods reduce transitions and help fit high-frequency subjects into a constrained week.

---

## 10. Hard Constraints for the Timetable Generator

These should be treated as non-negotiable.

| Constraint | Why it matters |
|---|---|
| Fixed school week: Monday-Saturday | The school runs six days. |
| Fixed period grid | Assembly, P1-P8, and recess timings are fixed. |
| One class cannot have two unrelated subjects at the same time | Basic class clash rule. |
| One teacher cannot teach two unrelated classes at the same time | Basic teacher clash rule. |
| Joint-class events must be allowed | Senior English/Hindi/Economics require this. |
| Team-taught events must be allowed | ELGA Classes 1-5 require this. |
| Teacher availability/unavailability must be respected | Mahesh and Anjana prove this is required. |
| Weekly subject-period requirement must be met | Each class has specific academic needs. |
| Class 1-10 should normally have no free periods | Current timetable keeps them fully scheduled. |
| Senior classes may have Free/Self Study | Especially Science and Commerce/Arts scheduling gaps. |
| Teacher max-load and minimum-free rules | Some teachers are already near saturation. |
| Specialist teacher constraints | Maya, Rakesh, Antima, etc. are resource-like teachers. |
| Resource constraints | Computer lab, sports ground, robotics, science lab should be modelled. |
| Locked blocks | ELGA and unavailable teacher slots must be lockable. |

---

## 11. Soft Constraints for Better Timetable Quality

These are not always absolute, but they improve the timetable.

| Soft preference | Why useful |
|---|---|
| Core subjects earlier in the day | Better attention for Maths, Science, English, etc. |
| Keep lower classes predictable | Young children benefit from routine. |
| Avoid overloading one teacher continuously | Important for high-load teachers. |
| Keep double periods for board/senior subjects where useful | Helpful for Science, Maths, Accountancy, Economics. |
| Avoid too many same-subject repeats in one day unless intended | Prevents fatigue. |
| Spread Sports, CCS, and Robotics across the week | Better student experience. |
| Prefer Free/Self Study at senior level, not junior level | Matches current pattern. |
| Keep special subjects away from ELGA protected block | ELGA already consumes Mon-Thu P3-P5. |
| Keep class teacher/core teacher early where possible | Matches school practice and improves control. |

---

## 12. Data Model Needed for the App

A simple timetable table will not be enough.

The app should use an event-based data model.

Suggested core tables:

```text
AcademicYear
Day
Period
ClassGroup
Teacher
Subject
RoomOrResource
TeacherAvailability
ClassSubjectRequirement
TeacherSubjectAssignment
TimetableEvent
TimetableEventGroup
Constraint
GeneratedTimetableVersion
```

## 12.1 TimetableEvent Model

A timetable event should support multiple classes and multiple teachers.

Suggested fields:

```text
event_id
day
period
subject
classes[]
teachers[]
room_or_resource
event_type
is_locked
source
notes
```

Suggested event types:

```text
normal_single_class
joint_class
team_taught_block
self_study
free
assembly
recess
notebook_checking
```

---

## 13. Example Event Models

## 13.1 ELGA Block

```json
{
  "event_type": "team_taught_block",
  "subject": "ELGA",
  "classes": ["Class 1", "Class 2", "Class 3", "Class 4", "Class 5"],
  "teachers": ["Bindu", "Anita", "Rashmita", "Kusum", "Ravina"],
  "locked_slots": [
    "Monday P3", "Monday P4", "Monday P5",
    "Tuesday P3", "Tuesday P4", "Tuesday P5",
    "Wednesday P3", "Wednesday P4", "Wednesday P5",
    "Thursday P3", "Thursday P4", "Thursday P5"
  ]
}
```

## 13.2 Senior Combined English

```json
{
  "event_type": "joint_class",
  "subject": "English compulsory",
  "classes": ["Class 11 Science", "Class 11 Commerce", "Class 11 Arts"],
  "teachers": ["Pradhyuman"],
  "weekly_periods": 6
}
```

## 13.3 Teacher Availability

```json
{
  "teacher": "Mahesh",
  "available_slots": ["Monday P1", "Monday P2", "Monday P3"],
  "unavailable_slots": ["Monday P4", "Monday P5", "Monday P6", "Monday P7", "Monday P8"],
  "repeat_pattern": "same for all working days"
}
```

---

## 14. Generator Algorithm Recommendation

Do not build the app as a purely random or AI-only generator.

The correct approach is:

```text
Constraint solver + manual locking + validation + optimization
```

A good technical option is **Google OR-Tools CP-SAT**.

## Recommended generation order

1. Create the fixed grid: days, periods, assembly, recess.
2. Lock teacher unavailable slots.
3. Lock institutional blocks such as ELGA.
4. Place the most constrained teachers first.
5. Place joint senior subjects.
6. Place high-frequency board/core subjects.
7. Place activity and specialist subjects.
8. Fill remaining periods with allowed free/self-study periods.
9. Run validation.
10. Run optimization.

## Most constrained teachers should be placed first

Priority examples:

1. Mahesh — Physics with limited availability.
2. Anjana — available only after recess.
3. Pradhyuman — high load and senior/common subjects.
4. Harshita — very high load.
5. Maya — CCS/Robotics/Self Study resource teacher.
6. Rakesh — Sports.
7. Antima — Notebook Checking and Sanskrit/Hindi roles.

---

## 15. Validation Reports Needed

The app must generate more than class timetables.

Required reports:

| Report | Required? | Why |
|---|---:|---|
| Class-wise timetable | Yes | Classroom and parent-facing use. |
| Teacher-wise timetable | Yes | Teacher duty clarity. |
| Day-wise timetable | Yes | Daily operations and clash checking. |
| Teacher load report | Yes | Shows free periods, overload, unavailable periods. |
| Subject-period summary | Yes | Confirms academic plan. |
| Clash report | Yes | Must distinguish real clashes from joint events. |
| Free-period report | Yes | Useful for substitution planning. |
| Locked-block report | Yes | ELGA and availability constraints. |
| Resource-use report | Yes | Lab, sports, robotics, CCS planning. |
| Substitution support report | Recommended | Useful when a teacher is absent. |

---

## 16. Risks in the Current Timetable

## 16.1 Very Low Buffer for Some Teachers

Harshita has only 1 free period and Pradhyuman only 2.

This makes substitutions difficult if either teacher is absent.

## 16.2 Mahesh Is Fully Packed in Available Time

Mahesh has 18 teaching events and no free period during his available time.

Any change to Physics becomes difficult.

## 16.3 PDF Extraction Artefacts

Some class-wise PDF text has layout/extraction issues, especially around ELGA cells.

For the app, do not use PDF text extraction as the primary source of truth.

Use structured database or spreadsheet entry.

## 16.4 Pre-primary Is Missing

Nursery, JKG, and SKG are not included in the uploaded timetable.

The app should still be designed to include them later.

## 16.5 Senior Science Has Free Periods

Class 11 Science and Class 12 Science have several Free periods.

This may be intentional, but the app should clarify whether these are:

- true free periods,
- self-study,
- practical periods,
- optional subject gaps,
- or placeholder periods.

## 16.6 Joint Classes Must Be Stored Explicitly

If joint classes are only visible in PDFs but not stored as linked events, future editing will accidentally create clashes.

---

## 17. MVP Plan for the Timetable Generator App

## Phase 1: Timetable Data + Validator

First build a system where the school can enter/import the current timetable and validate it.

Must-have:

- class-wise grid entry,
- teacher-wise auto-generation,
- day-wise auto-generation,
- teacher clash validator,
- class clash validator,
- unavailable teacher validator,
- weekly subject count checker,
- free-period count report,
- support for joint/team events.

## Phase 2: Semi-Automatic Generator

Generate around locked constraints.

Must-have:

- lock ELGA block,
- lock teacher unavailability,
- lock existing manual placements,
- regenerate empty slots,
- show unsatisfied constraints.

## Phase 3: Full Generator

Add optimization.

Must-have:

- teacher load balancing,
- subject spread,
- double-period preferences,
- core-subject timing preferences,
- resource allocation,
- substitution planning.

## Phase 4: Operational Tools

Add daily school-use features.

Useful additions:

- absent teacher substitution planner,
- "what changes if teacher X leaves?" simulation,
- printable PDFs,
- teacher mobile view,
- class notice-board view,
- version history.

---

## 18. Recommended App Architecture

The app should have these modules:

## 18.1 Setup Module

- Academic year
- Days and periods
- Assembly/recess
- Class groups
- Teachers
- Subjects
- Rooms/resources

## 18.2 Requirements Module

- Class-subject weekly period counts
- Teacher-subject-class mapping
- Joint class rules
- Team block rules
- Double-period preferences
- Subject timing preferences

## 18.3 Constraints Module

- Teacher availability
- Teacher unavailability
- Max periods per day
- Min free periods per week
- Room/resource limits
- Locked periods
- No-free-period rule for junior classes

## 18.4 Timetable Builder Module

- Manual drag/drop
- Lock/unlock slots
- Generate remaining timetable
- Regenerate selected section
- Conflict warnings

## 18.5 Reports Module

- Class-wise PDF
- Teacher-wise PDF
- Day-wise PDF
- Workload report
- Conflict report
- Subject completion report
- Substitution report

---

## 19. Key Technical Rules for the App

## 19.1 Do Not Treat Timetable Cells as Independent

A period cell may belong to a larger event.

Example:

- One ELGA event covers 5 classes and 5 teachers.
- One senior English event covers 3 classes and 1 teacher.

So the database must store events, not just isolated cells.

## 19.2 Every Timetable Entry Should Have a Source

Possible sources:

```text
manual
imported
locked
generated
adjusted
```

This helps future debugging.

## 19.3 Every Generated Timetable Should Have a Version

The school should be able to compare versions.

Example:

```text
Timetable 2026-27 v1
Timetable 2026-27 v2 after Physics adjustment
Timetable 2026-27 v3 after new teacher added
```

## 19.4 Validator Should Run Before Export

Before exporting PDFs, the app should check:

- class clashes,
- teacher clashes,
- invalid joint events,
- missing subject periods,
- extra subject periods,
- unavailable teacher violations,
- too many periods per teacher per day,
- too few free periods,
- resource conflicts,
- unsupported free periods.

---

## 20. Final Understanding

The VPPS timetable is complex because it reflects a real school environment:

- limited teacher availability,
- heavy teacher workloads,
- shared English program design,
- senior stream combinations,
- specialist teacher/resource constraints,
- board-class priorities,
- and operational need for teacher-wise and day-wise clarity.

The timetable generator app should not be a simple drag-and-drop grid.

It should be a **constraint-aware school scheduling system** where the school can:

1. define rules,
2. lock important blocks,
3. generate around real constraints,
4. validate errors,
5. and produce class-wise, teacher-wise, and day-wise outputs.

The most important product decision is:

> Model timetable entries as events that can have multiple classes and multiple teachers.

That one decision will correctly handle:

- ELGA,
- senior combined English/Hindi/Economics,
- teacher-wise reports,
- day-wise reports,
- real vs false clash detection,
- and future timetable edits.

Without this event-based model, the app will keep misunderstanding the school's actual timetable.

---

## 21. One-Line Product Direction

Build the VPPS timetable generator as a **constraint solver + event-based scheduler**, not as a simple class-period table.
