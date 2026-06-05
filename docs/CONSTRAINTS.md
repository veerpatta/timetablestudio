# Constraint Catalog

> **v4 note**: §"v4 Rule system" below supersedes the fixed S1–S6 list as the product direction — constraints become user-configurable Rules. H1–H10 remain the structural core. See docs/TIMETABLE_ANALYSIS.md for the real-school evidence behind each rule type.

Every constraint has a stable ID used in code (`Violation.constraintId`), tests, and UI. Hard constraints (H*) must never be violated in a generated timetable; the editor shows them as red. Soft constraints (S*) carry weights; the editor shows them as amber.

## Hard constraints

| ID | Name | Rule |
|----|------|------|
| H1 | Teacher clash | A teacher occupies at most one activity per (day, period). |
| H2 | Class clash | A class has at most one activity per (day, period). |
| H3 | Block atomicity | A `BlockActivity` placement occupies ALL its classes and ALL its teachers for `length` consecutive periods on one day — partial placement is invalid. |
| H4 | Block bounds | Block fits inside the day: `startPeriod + length − 1 ≤ periodsPerDay`. |
| H5 | Teacher availability | No activity in a teacher's `unavailable` slots. |
| H6 | Qualified teacher | A lesson's teachers must list the lesson's subject in `Teacher.subjects`. |
| H7 | Quota exact | For each `CurriculumRequirement`, exactly `periodsPerWeek` placements exist per week. (Generation target; editor reports shortfall/excess as it stands.) |
| H8 | Daily max | Per requirement: no more than `maxPerDay` periods of the same subject for the same class per day. |
| H9 | Teacher daily load | Teacher's placements per day ≤ `maxPeriodsPerDay`. |
| H10 | Pinned immovable | The solver never moves or removes `pinned: true` placements. |

## Soft constraints (default weight in parentheses; owner-tunable in UI later)

| ID | Name | Rule |
|----|------|------|
| S1 (5) | No teacher gaps | Minimize idle periods between a teacher's first and last period of the day. |
| S2 (4) | Subject spread | Spread a subject's weekly periods across different days. |
| S3 (3) | Heavy subjects early | Prefer Maths/Science in P1–P3 (configurable subject set). |
| S4 (3) | Teacher week balance | Even out a teacher's load across days. |
| S5 (2) | No triple repeat | Avoid 3+ consecutive periods of one subject for a class (blocks exempt). |
| S6 (2) | Class variety | Avoid the same teacher 3+ consecutive periods in one class (blocks exempt). |

## Scoring

`score(timetable) = Σ hardViolations × 10_000 + Σ softViolations × weight`. Lower is better. A timetable is *feasible* iff hard violations = 0. The solver reports both the score and the violation list.

## v4 Rule system (user-configurable constraints)

Modeled on how mature timetablers (FET, aSc Timetables, Untis) expose constraints, but with plain-language UI labels. A **Rule** is a stored entity the user creates from templates; each rule has `severity: "must" | "prefer"` (must = hard, prefer = weighted soft) and a scope (subject / class / teacher / activity, with class-group and "board classes" selectors).

| ID | Template (UI label) | Parameters | VPPS example |
|----|--------------------|------------|--------------|
| R1 | "{subject} only in periods {set}" | subject(s), scope classes, period set | Maths in P1–P3 |
| R2 | "{subject} never in period {set}" | subject(s), scope, period set | CCS never in P1; Revision not in P6? owner decides |
| R3 | "{subject} in the first/second half of the day" | subject(s), scope, half | board subjects first half |
| R4 | "{teacher} is class teacher of {class} — takes period 1 daily" | teacher, class, optional fixed subject | Bindu = Class 1 (Maths) |
| R5 | "{subject} same period every day in {class}" | subject, class, optional period | Accountancy P1–P2 daily, 12 Commerce |
| R6 | "{subject} as a double period ({n}×/week) in {class}" | subject, class, count | Maths double in primary |
| R7 | "Block {name} runs only on {days}, starting period {p}" | block, day set, start | ELGA Mon–Thu @P3 |
| R8 | "{teacher} not available {slots}" | teacher, slot set | part-timers, duties |
| R9 | "{class} is a board class — protect core subjects" | class, core subject set | 10, 12A/12C/12S |
| R10 | "{subject} spread across ≥{n} different days" | subject, class scope, n | SST across 4 days |
| R11 | "Max {n} periods/day of {subject} for {class}" | subject, class, n | default 2, doubles = 2 |
| R12 | "{teacher} max {n} periods per day / {m} per week" | teacher, n, m | caps |
| R13 | "Teachers' days compact (few free gaps)" | global weight | existing S1 |
| R14 | "{subject A} before/after {subject B} on the same day" | two subjects, class, order | practice after theory |
| R15 | "Teacher {T} max {n} consecutive periods" | teacher, n | fatigue control |

Engine mapping: every Rule compiles to a predicate over `(project, timetable)` reusing the existing `Violation` shape (`constraintId: "R4"` etc.); `prefer` rules contribute weight × violations to the soft score; `must` rules join the hard count. Rule templates ship with sensible defaults; the importer (M-real-data) auto-proposes rules it detects in the existing timetable (anchors, doubles, block days) for one-click confirmation.

## ELGA worked example (tests must cover this)

Placing the ELGA block on Monday start P3:

- Classes 1–5 each get ELGA cells at Mon P3, P4, P5 (H2, H3).
- Bindu, Anita, Rashmita, Kusum, Ravina are all occupied Mon P3–P5 (H1, H3) — so a Class 7 Hindi lesson with Kusum at Mon P4 is an H1 violation.
- Moving "just Class 3's ELGA" to P2 is impossible — placement is per block (H3).
- An ELGA placement starting P5 with length 3 violates H4.
