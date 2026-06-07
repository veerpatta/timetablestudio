# VPPS Timetable Analysis — 2026-27 Session

**Purpose:** Deep structural analysis of the current (manually built) school timetable, written as a foundation document for the timetable-generator engine. It captures the entities, the fixed skeleton, the constraints (hard and soft), why the schedule is shaped this way, and the implications for the data model and solver.

**Scope of source data:** Three cross-validating views — Class-wise (16 sections), Teacher-wise (19 staff entries), and Day-wise (6 days). The three views agree with each other, so the structure below is reliable.

---

## 1. The fixed skeleton (time grid)

Every class, every day runs an identical time grid:

| Slot | Time | Type |
|------|------|------|
| Assembly | 8:00 – 8:30 | Fixed, non-teaching, universal |
| P1 | 8:30 – 9:10 | Teaching (40 min) |
| P2 | 9:10 – 9:50 | Teaching (40 min) |
| P3 | 9:50 – 10:30 | Teaching (40 min) |
| P4 | 10:30 – 11:10 | Teaching (40 min) |
| Recess | 11:10 – 11:30 | Fixed, non-teaching, universal |
| P5 | 11:30 – 12:10 | Teaching (40 min) |
| P6 | 12:10 – 12:50 | Teaching (40 min) |
| P7 | 12:50 – 13:30 | Teaching (40 min) |
| P8 | 13:30 – 14:10 | Teaching (40 min) |

- **Days:** Monday – Saturday (6 working days).
- **Teaching capacity:** 8 periods × 6 days = **48 instructional slots per class per week**.
- **Assembly and Recess** are immovable, universal, non-teaching slots. They are never scheduled by the engine; they are part of the canvas.

**Implication:** Slots are not all the same. The engine needs a notion of *slot types*. Not every filled slot is "teacher teaches subject to class." Other slot types observed: Free, NoteBook Checking, Self Study, Sports, Robotics, CCS — each behaves differently from a normal teaching period.

---

## 2. The entities

### 2.1 Class-sections (16 total)

| Band | Sections |
|------|----------|
| Primary | Class 1, 2, 3, 4, 5 |
| Middle | Class 6, 7, 8 |
| Secondary | Class 9, 10 |
| Senior (Class 11) | 11 Science, 11 Commerce, 11 Arts |
| Senior (Class 12) | 12 Science, 12 Commerce, 12 Arts |

### 2.2 Teachers / staff (19 entries)

| # | Name | Code | Primary subjects / role | Free periods/week |
|---|------|------|--------------------------|-------------------|
| 1 | Bindu | Bindu | Maths, EVS, Hindi (primary) | 6 |
| 2 | Anita | Anita | Maths, EVS (Cl 4, 5, 7) | 8 |
| 3 | Rashmita | Rashmita | EVS, SST | 8 |
| 4 | Kusum | Kusum | Hindi (Cl 3, 4, 5) | 7 |
| 5 | Nidhika | Nidhika | Maths (5, 6), SST (7), Business Studies (11/12 Com) | 7 |
| 6 | Hemlata | Hemlata | Biology, Chemistry, Physics, English Compulsory | 5 |
| 7 | Jainendra | Jainendra | Hindi, Sanskrit | 11 |
| 8 | Antima | Antima | Sanskrit, NoteBook Checking | 5 |
| 9 | Pradhyuman | Pradhyuman | SST, Political Science, English Compulsory | 2 |
| 10 | Mahesh | Mahesh | Physics (11/12 Science) — **limited availability** | 0 |
| 11 | Maya | Maya | CCS, Robotics, Self Study | 10 |
| 12 | Harshita | Harshita | English Compulsory, English Literature, SST | 1 |
| 13 | Toshit | Toshit | Chemistry, Physics, Science | 5 |
| 14 | Nathulal | NLK | Accountancy, Maths (9, 10) | 8 |
| 15 | Prakash | Prakash | Economics, Geography, Maths (8) | 5 |
| 16 | Anjana | Anjana | Hindi (Class 1 only) — **limited availability** | 14 |
| 17 | Rakesh | Rakesh | Sports | 17 |
| 18 | Director | DM | Admin — **all free, not schedulable** | 48 |
| 19 | Ravina | Ravina | Maths, EVS, English Compulsory (primary) | 4 |

**Notes on the staff pool:**
- The Director (DM) is fully free (48) — administrative, not a schedulable teaching resource.
- Mahesh and Anjana have explicit **"Unavailable"** regions, not merely free periods — these are hard availability windows (see §3.4).
- The pool mixes full-load, part-load, and limited-availability people. There is no uniform teacher.

### 2.3 Subjects (grade-dependent)

The subject set changes by grade band. This is a core complexity signal: subjects must be **scoped per grade band**, and "Science" is not a single entity across the school.

| Band | Subjects |
|------|----------|
| Primary (1–5) | Maths, EVS, Hindi, ELGA, Sports, CCS, Robotics, NoteBook Checking. **Only Class 5** also has English Compulsory. |
| Middle (6–8) | Maths, Hindi, Sanskrit, English Compulsory, SST, and **Physics + Chemistry + Biology as three separate subjects** (no combined "Science"). Plus CCS, Robotics, Sports, NoteBook Checking. |
| Secondary (9–10) | Maths, Hindi, Sanskrit, SST, English Compulsory, and **a single combined "Science"** subject. Plus CCS, Sports, NoteBook Checking. |
| Senior 11/12 Science | Physics, Chemistry, Biology, English Compulsory, Hindi (+ Free periods). |
| Senior 11/12 Commerce | Accountancy, Business Studies, Economics, English Compulsory, Hindi, Self Study, CCS (+ Free). |
| Senior 11/12 Arts | Economics, Geography, Political Science, English Literature, English Compulsory, Hindi, CCS (+ Free). |

> **Critical modelling point:** Science is **three subjects** (Physics, Chemistry, Biology) in middle school but **one subject** (Science) in secondary. Model this difference explicitly — it is easy to miss.

---

## 3. The five features that make this genuinely hard

### 3.1 The ELGA block — synchronized parallel teaching

This is the single biggest structural constraint.

- In **Classes 1–5**, periods **P3, P4, P5 are all ELGA, simultaneously, Monday through Thursday** (not Friday/Saturday).
- ELGA is co-taught by the **entire primary team at once**: Bindu, Anita, Rashmita, Kusum, Ravina are all locked into the same slots together.
- This almost certainly means the ~5 grades are regrouped into ability bands rather than each teacher teaching their own class.

**For the generator:** This is **not** five independent events. It is **one block event** that occupies **5 classes and 5 teachers** in the same three slots, repeated across 4 days. Roughly **60 class-slots** are pre-determined by this single rule, and it removes 5 teachers from the available pool during those slots.

You cannot *generate* this — you must **pin** it, then schedule everything else around the hole it leaves.

### 3.2 Combined senior sections — coupled class grids

- The three **Class-11 streams** attend **Hindi** and **English Compulsory** together (one teacher, one session, three sections).
- The three **Class-12 streams** do the same.
- **Economics** is combined across **Commerce + Arts** at both Class 11 and Class 12.

Evidence: Jainendra's sheet shows "11 Science / 11 Commerce / 11 Arts — Hindi"; Pradhyuman's shows "12 Sci/Com/Arts — English Compulsory"; Prakash's shows "11 Commerce/11 Arts — Economics".

**For the generator:** Needs a **course-group** concept — a single scheduled event mapping to *multiple* class-sections + one teacher. When placed, all member sections are simultaneously occupied. This is the classic hardest case in school timetabling because it couples otherwise-independent class grids together.

### 3.3 Multi-subject, multi-grade teachers — coupled school regions

There is no "the Maths teacher." Maths alone is taught by six different people:

| Maths teacher | Classes |
|---------------|---------|
| Bindu | Class 1 |
| Ravina | Class 2, 3 |
| Anita | Class 4, 7 |
| Nidhika | Class 5, 6 |
| Prakash | Class 8 |
| Nathulal | Class 9, 10 |

Many teachers span subjects and bands:
- **Bindu** teaches Maths *and* EVS *and* Hindi to different primary classes.
- **Hemlata** alone covers **Biology, Chemistry, Physics, and English Compulsory** across Classes 6, 7, 8, 11 Science, and 12 Science — a single teacher links Class 6 to Class 12.

**For the generator:** The atomic unit is not "teacher + subject." It is a **(teacher, subject, class) qualification triple** — a fixed assignment table the engine must respect and never invent. These cross-band teachers couple unrelated parts of the school, which is what makes a naive solver deadlock.

### 3.4 Limited-availability teachers — hard windows (keyholes)

Two staff have explicit "Unavailable" regions:

- **Mahesh** (Physics, 11/12 Science): **0 free periods** but large Unavailable blocks. Effectively a part-time specialist who is fully booked whenever present. His Physics sessions can only land in his available windows.
- **Anjana** (Class 1 Hindi only): unavailable across mornings; surfaces only later in the day. **14 free** but constrained by availability, not by load.

These are **hard** availability constraints that drastically shrink the feasible placements for the subjects those two cover. Everything else must thread around these keyholes. The Director (DM) is "all free" but not schedulable.

### 3.5 Special non-teaching period types

These slots do not behave like normal teaching periods and should not be forced through the teacher-clash logic the same way:

| Type | Who / where | Notes |
|------|-------------|-------|
| Free | Senior students (e.g. Class 12 Science has several/week) | Genuine study gaps; ideally pooled, not fragmented. |
| Self Study | Maya, 11 Commerce | Supervised study period. |
| NoteBook Checking | Mostly Antima | Scheduled as if a period. |
| Sports | Rakesh | Needs the ground (latent room constraint). |
| Robotics | Maya | Almost certainly needs the lab (latent room constraint). |
| CCS | Maya | Co-curricular slot. |

> **Latent constraint:** Rooms/resources are **not shown** in the PDFs, but they exist in reality (Robotics lab, Sports ground, science labs). Design a `room`/`resource` field now rather than retrofitting later.

---

## 4. Additional patterns worth encoding

- **Double periods are deliberate, not accidental.** Accountancy routinely runs as P1–P2 or P7–P8 pairs in Commerce; Physics doubles in senior Science. The engine should be able to preserve/produce intentional double periods.
- **Workload is badly imbalanced** in the current manual version. Free-period counts range from Harshita (1 free → ~47 teaching periods) and Pradhyuman (2) at the saturated end, down to Rakesh (17), Anjana (14), Maya (10), Jainendra (11) at the light end, with the Director at 48. This imbalance is precisely the kind of thing the generator should optimize away — so workload is both a hard constraint (qualifications) and a soft objective (balance).

---

## 5. How complex is it, really?

This is a textbook **NP-hard** timetabling problem. The instance sits at the harder end for a school of this size — **not** because of raw scale (16 classes is modest) but because of **coupling**:

- ELGA couples 5 primary classes + 5 teachers into shared blocks.
- Combined sections couple 3 senior streams each.
- Multi-grade teachers couple unrelated parts of the school (Hemlata links Class 6 to Class 12).
- Two hard availability windows (Mahesh, Anjana) act as keyholes everything must thread around.

A naive period-by-period filler will deadlock. The engine needs genuine **constraint propagation with backtracking**, or a **CP/SAT-style solver**. Pinned and grouped events should be placed first to shrink the search space before the rest is filled.

---

## 6. Constraint catalogue for the engine

### 6.1 Hard constraints (must never be violated)

1. **Teacher clash:** No teacher in two places at once.
2. **Class clash:** No class doing two things at once.
3. **Qualification:** A teacher only teaches (subject, class) pairs from the qualification table — never invented.
4. **Availability windows:** Respect Mahesh, Anjana, and Director availability/unavailability.
5. **Pinned blocks:** ELGA (Classes 1–5, P3–P5, Mon–Thu), Assembly, Recess.
6. **Combined-section integrity:** A group event occupies all member sections + the teacher together.
7. **Per-subject weekly quota per class:** Derived by counting the current grid (each subject's required periods/week per section).

### 6.2 Soft constraints (optimize toward)

1. **Teacher workload balance** — flatten the Harshita-vs-Rakesh gap.
2. **Subject spread** — don't cluster a subject's periods on consecutive days.
3. **Double-period preservation** where the subject wants it (Accountancy, Physics).
4. **Core/hard subjects earlier in the day.**
5. **Free-period pooling** for senior classes — minimize fragmented single frees; pool them where possible.

---

## 7. Data-model implications (TypeScript engine + IndexedDB)

This maps cleanly onto the planned architecture. The schema needs, at minimum:

- **Time grid** — days, period definitions, fixed-slot flags (Assembly/Recess as non-teaching).
- **Subjects** — scoped by grade band (with Science modelled as 3 subjects in middle, 1 in secondary).
- **Teachers** — each with an availability mask (period × day), including full-Unavailable regions.
- **Assignments** — the table of `(teacher, subject, class, weeklyQuota)` qualification triples.
- **CourseGroups** — for combined sections (one event → many sections + one teacher).
- **PinnedBlocks** — for ELGA and any other pre-determined block events.
- **Special period types** — a small enum (Free, SelfStudy, NoteBookChecking, Sports, Robotics, CCS) so these aren't forced through normal teacher-clash logic.
- **Room / resource** — a field on events even though the current PDFs don't expose it (for labs, ground, etc.).

**Solver flow:** Schedulable events = quotas expanded into period-instances. Place **pinned** and **grouped** events first to shrink the search space, then fill the remainder with constraint propagation + backtracking, scoring soft objectives along the way.

### 7.1 Two things easy to miss
1. The **science-splitting difference** between middle (P/C/B separate) and secondary (combined Science). Model it now.
2. The **latent room constraint** for Robotics / Sports / labs. Leave a `room`/`resource` field from day one.

---

## 8. Summary

| Dimension | Value |
|-----------|-------|
| Class-sections | 16 |
| Schedulable teachers | ~17 (19 entries minus Director; Mahesh & Anjana availability-limited) |
| Working days | 6 (Mon–Sat) |
| Teaching periods/day | 8 (40 min each) |
| Fixed non-teaching slots | Assembly, Recess |
| Teaching slots per class/week | 48 |
| Hardest structural features | ELGA parallel block; combined senior sections; multi-grade teachers; hard availability windows; special period types |
| Problem class | NP-hard; coupling-dominated; needs CP/backtracking |

This document is intended to drop directly into the project's `AGENTS.md` / `BUILD_PLAN.md` as the requirements-and-constraints baseline for the generator.
