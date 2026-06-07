# CUSTOMIZE (v6.1) — make it yours: full editing, an applied constraint system, and electives

Decided 2026-06-07 by the owner after the v6 rebuild went live. The app now shows the real 8-period timetable correctly, but it is **mostly view-only**: you can't yet add/remove teachers, subjects or classes, assignments are fixed, and the "Rules" are pre-baked decorations that don't actually drive anything. This phase makes the app a real, configurable timetabling system. It builds on the v6 event model (`docs/REBUILD.md`, `docs/DATA_MODEL.md` § v6) and continues from RB0–RB2 (done) — it supersedes the old static RB6 "rules" idea with a real applied constraint engine.

## What the owner asked for

1. **Full customization / CRUD** — easily add, remove, rename: teachers, subjects, classes, periods. Assign which teacher teaches which subject to which class. Set the **class teacher**.
2. **A real, applied constraint system** — attach constraints to a subject, class, or teacher that actually change validation and generation. Examples given: "this subject must be in the first half of the day", "this teacher should have only 30 periods a week". Plus many more (brainstormed below). Rules must be easy to add, readable, and visibly enforced — not pretended.
3. **Fix the Arts elective problem** — Arts 11 & 12 students take 5 subjects: English + Hindi (compulsory, taught jointly across all 3 streams) and **3 chosen from 4 electives — Political Science, Geography, Economics, English Literature**. Today, when a non-chosen elective runs, opted-out students are forced to sit in that class. That must stop.

## Owner decisions (binding, from this session)

- Electives exist **only in Arts 11 & 12**; Commerce and Science subjects are all compulsory for their stream.
- Arts electives are **free choice — any 3 of the 4**. All four drop-combinations occur.
- Fix = **parallel option blocks where possible, supervised study otherwise.**
- Build as **one combined plan**, sequenced the cleanest way (below).

## How modern timetablers do this (grounding)

- **Option blocks / elective lines / "setting"** (aSc, Untis, FET, timetabler.com): subjects a student chooses among are placed so a student attends exactly one at a time; two subjects "on the same line" would clash, so a student never takes two from one line. The composition of lines is driven by student choices + teacher/room availability, maximizing how many students get their preferred combination.
- **Student sets / groups**: students are grouped by their subject combination; the engine guarantees a student's chosen subjects never overlap and minimizes their non-teaching periods.
- **Constraints as a weighted catalog**: each constraint is a typed template with a scope (subject/class/teacher) and a weight; hard ones are inviolable, soft ones are optimized. (FET's time/space constraint palette; aSc's teacher/lesson constraints.)

### The VPPS-specific elective reality (important)

- Teacher coupling forces structure: **Prakash teaches both Economics and Geography**, so those two electives can never run in the same period. Political Science = Pradhyuman, English Literature = Harshita.
- Under **truly free "any 3 of 4"**, every pair of electives is taken together by some student, so no two electives can be safely run in parallel (someone would clash). The clean, correct result is: **each elective runs in its own period-line, and a student gets a supervised Study period during the one elective they dropped** — never forced into a subject they didn't choose. The current "forced sitting" is exactly this study period, just mislabeled and mis-modeled.
- Real parallelism (fewer study periods) only becomes possible if the owner later restricts to a few actual combinations. The model supports both; the engine will use parallel option blocks automatically whenever the chosen combinations make it clash-free, and fall back to supervised study otherwise.

## Data-model additions (authoritative; land in DATA_MODEL.md + types.ts in the same commit)

- **Constraint** (replaces the static rules): `{ id, scope: "teacher"|"class"|"subject"|"global", targetId?, template, params, severity: "must"|"prefer", weight, enabled }`. Compiled to a predicate over `(project, timetable)` reusing the `Violation` shape; `must` → validate(), `prefer` → score()/generate(). Full template catalog below.
- **ElectiveGroup**: `{ id, classId, name, subjectIds[], chooseCount }` — e.g. Arts 11 = {PolSci, Geo, Eco, EngLit}, choose 3.
- **StudentGroup** (set): `{ id, classId, name, electiveSubjectIds[] }` — a cohort within a class defined by its elective combination (free 3-of-4 → up to 4 groups per Arts class). The clash unit for electives is the student group, not the whole class.
- **TimetableEvent** gains optional `studentGroupIds[]`: an elective event is attended only by the groups that chose that subject. Clash rule extends: a student group may not be double-booked across its chosen subjects; same-event overlap stays legal (joint/team).
- **Supervised study** is an existing event type (`self_study`/`free`) scoped to the opted-out student group during a dropped-elective line.

## The constraint library (brainstormed catalog — build the breadth in C4)

All are sentence-first in the UI, attach to one entity, and are must/prefer with a weight. (Extends the R-series; restated for the event model.)

**Teacher constraints**
- Max periods per week (e.g. 30) · max per day · minimum free periods per week.
- Unavailable on given days/periods (hard window) · available only after recess, etc.
- No more than N consecutive periods · at most N teaching days/week.
- Prefer a free day · not in period 1 · not in the last period.
- Keep the day compact (minimize gaps) · max periods of one subject per day.
- Fair share of first/last periods across staff (global-ish, teacher-scoped).

**Subject constraints**
- First half / second half of the day · only in periods {set} · never in period {set} · not last period.
- Spread across ≥ N different days (no clustering) · max per day per class.
- Double period: required/preferred, N times/week · min gap-days between sessions.
- Not back-to-back with another (heavy) subject · before/after another subject (practice after theory).
- Needs a room/resource (lab, ground, robotics) — with room capacity later.

**Class constraints**
- No free periods (juniors) / free allowed (seniors) · max different teachers per day (young-class stability).
- Class teacher takes period 1 daily · board class → protect core subjects in prime slots, minimize light subjects.
- Daily subject variety (avoid repeating a subject the same day unless a double) · max consecutive same-subject.
- Start/end the day with a particular subject kind.

**Global / school**
- Balance teacher workloads (minimize load variance) · core subjects earlier in the day · activity subjects spread across the week · keep specials away from the ELGA block.

Each ships with: a plain label with blanks to fill, satisfied+violated unit tests, live violation highlighting on the grid, and inclusion in "Suggest constraints" (detect patterns already in the timetable and offer them pre-filled).

## Milestones (cleanest order; AC-gated; strict order)

**C1 — Editable entities (kills view-only).** Add/remove/rename teachers, subjects, classes; edit the period grid. Safe-impact flows: removing a teacher → guided reassignment; removing a subject/class → shows and confirms affected events; renaming is non-destructive. Everything persists (IndexedDB) and is undoable. AC: from the UI, a non-technical user adds a teacher, renames a subject, and removes a class without leaving a dangling reference or a clash; reload preserves changes.

**C2 — Assignments & class teacher.** A qualification matrix (which teacher may teach which subject to which class) editable as a grid; set each class's class teacher. These directly feed the legal-only picker (only qualified options appear) and the class-teacher-P1 constraint. AC: editing the matrix changes what the cell picker offers (test); setting a class teacher enables the "takes period 1 daily" constraint for that class.

**C3 — Applied constraint engine.** Real `Constraint` entity + evaluator wired into validate() (must) and score()/generate() (prefer), replacing the static rules. Create/edit/delete/toggle from a "Constraints" panel; each attaches to a teacher/class/subject via plain pickers; violations highlight the exact cells with a plain sentence. AC: creating "Maths in the first half for Class 7" immediately flags any afternoon Maths and is respected by Fill-the-gaps; disabling it clears the flags; no constraint codes shown to the user.

**C4 — Constraint library breadth.** Implement the full catalog above (teacher caps/consecutive/free-day/not-first-last; subject half-of-day/spread/double/room/order; class no-free/variety/board-protect/class-teacher-P1; global fairness/balance). Plus "Suggest constraints" from the current timetable. AC: each template has satisfied+violated tests with readable messages; the two owner examples ("subject in first half", "teacher max 30/week") work end-to-end; suggestions propose ≥5 real patterns with no duplicates.

**C5 — Electives & student groups (the Arts fix).** ElectiveGroup + StudentGroup model; elective events scoped to student groups; student-group clash detection; option-line scheduling that runs electives in parallel when the chosen combinations allow and assigns a supervised Study period to opted-out groups otherwise. Class view shows the elective line clearly ("Electives — you're in: Economics / others in Study"); teacher and per-student-group views are correct. AC: with the four Arts electives and free 3-of-4, no student group is ever scheduled into a non-chosen subject and never double-booked; the live Arts 11/12 grids reconcile to the source with forced-sitting removed; Prakash never teaches Economics and Geography in the same slot.

**C6 — Generator honours everything.** Auto-fill / generate respects qualifications, availability, electives, and all `must` constraints while optimizing `prefer` ones; infeasible inputs produce a plain-language blocker report ("Harshita would exceed 30 periods; relax the cap or move a class"). AC: clearing part of a class and regenerating yields a fully legal result honoring all enabled constraints in < 10 s; an over-constrained case yields a readable, specific blocker.

**C7 — Reports, student view & polish.** Updated class/teacher/day reports, an **elective/option-line report**, a per-student-combination timetable, room-use report, and print layouts; legacy export retained. AC: an Arts student in a given combination can be shown a clean personal timetable with no non-chosen subjects; reports reconcile with derive().

## Guardrails (unchanged)

Doc-first model changes; nothing automatic is silent (every fill/fix/auto-assignment is a reviewable, undoable diff); plain language on the main surface (codes only behind Advanced); `npm test`/`lint`/`build` green before any milestone is "done"; in-place in this repo; free, offline, no backend.
