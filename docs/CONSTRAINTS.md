# Constraint Catalog

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

## ELGA worked example (tests must cover this)

Placing the ELGA block on Monday start P3:

- Classes 1–5 each get ELGA cells at Mon P3, P4, P5 (H2, H3).
- Bindu, Anita, Rashmita, Kusum, Ravina are all occupied Mon P3–P5 (H1, H3) — so a Class 7 Hindi lesson with Kusum at Mon P4 is an H1 violation.
- Moving "just Class 3's ELGA" to P2 is impossible — placement is per block (H3).
- An ELGA placement starting P5 with length 3 violates H4.
