# Deep Analysis — the real VPPS timetable (from owner PDFs, 2026-06-05)

Source PDFs in `docs/sources/`: `Class_Wise.pdf` (authoritative — full grid for all 16 classes), `Teacher_Wise Copy.pdf`, `Day_Wise.pdf` (projections of the same data). These are RICHER than `rawData.vpps.txt` and reveal constraints the rawData cannot express. Where they disagree, the PDFs win.

## Structure facts

- 16 classes (1–10, 11/12 × Arts/Commerce/Science), Mon–Sat, 6 × 40-min periods.
- Current profile ("Temporary heatwave timetable"): P1 7:30–8:10 … P4 ends 10:10, **break 10:10–10:25**, P5 10:25–11:05, P6 11:05–11:45. Profiles change seasonally — period timings and even the break position must be configurable, never hardcoded.
- "No ground assembly; class-wise prayer/attendance in Period 1" — P1 carries a homeroom duty.
- Classes 10, 12 Arts, 12 Commerce, 12 Science are marked **"Board class — priority protected"**: core/board subjects get priority; games/CCS/revision were reduced for them.

## The implicit constraints the school already lives by

These are visible as near-perfect patterns in the data — the constraint system must be able to express every one of them:

1. **P1 anchor = class-teacher period (the "class teacher function")**. Almost every class has the SAME teacher (usually the same subject) in P1 EVERY day — they take prayer/attendance: Class 1 Maths/Bindu, Class 2 Maths/Ravina, Class 3 EVS/Rashmita, Class 4 Hindi/Kusum, Class 5 Maths/Nidhika, Class 7 Maths/Anita, Class 8 Sanskrit/Antima, Class 9 Hindi/Jainendra, Class 10 SST/Pradhyuman, 11 Arts Eng.Lit/Harshita, 11 Science Physics/Mahesh, 12 Arts Geography/Prakash, 12 Commerce Accountancy/Nathulal, 12 Science Chemistry/Toshit. (Class 6 ≈ English/Hemlata 4 of 6 days; 11 Commerce = Maya in P1 daily via Revision/CCS.) → Rule type needed: *"teacher T is class teacher of class C and takes period 1 daily"* (+ same-subject-same-slot-daily variant).
2. **ELGA block runs Mon–Thu only**, P3–P5, Classes 1–5, the 5-teacher team. Fri/Sat are normal subject days. → Blocks need *allowed days* and a *fixed start period* option.
3. **Double periods are intentional and common**: Maths P1–P2 in primary; Accountancy P1–P2 daily in 12 Commerce; SST/Science/Physics doubles in 9–12. → Activities need *duration 2* (placed as one unit), not two accidental singles.
4. **Heavy subjects sit early; light subjects avoid P1** — Maths/board subjects cluster in P1–P3; CCS/Revision/games appear mid/late, never as a board-class P1 (except the Maya homeroom case). → Rule types: *"subject S prefers periods 1–3"*, *"subject S never in period 1"*, *"subject S not in last period"*.
5. **Board-class protection** — for classes 10/12*: core subject quotas protected, doubles allowed, light subjects minimized. → A class-level priority flag the solver respects when trading off.
6. **Teacher coupling is the real bottleneck** — e.g. Hemlata teaches nearly all of Class 6 plus Biology/Chemistry in 7, 8, 11S, 12S; Pradhyuman = English (8, 11s, 12s) + SST (9, 10) + Pol. Sci.; Prakash = Economics + Geography across 11/12. Senior streams are tightly interlocked through these specialists.
7. **Subject spread** — the same subject rarely appears 3+ days in a row at the same slot except by design (anchors); revision subjects scatter across the week.

## Full subject inventory (PDFs; superset of rawData)

Maths, Hindi, English, EVS, ELGA, Eng. Revision, Revision, CCS, Sci. Practice, SST Practice, Sanskrit, Science, SST, Physics, Chemistry, Biology, Eng. Lit., Economics, Geography, Pol. Sci., B. Studies, Accountancy.

Note: CCS and Revision are real scheduled subjects with teachers (mostly Maya/Anjana) — the system must treat "filler" subjects as first-class, droppable when a board class needs protection.

## What this means for the product (owner's stated use case)

The owner's main loop is NOT "generate from scratch yearly"; it is: **import the working timetable → tweak it during the session (teacher left, period count changed, subject rebalance) → immediately see what breaks and what improves → print/export**. The tool must therefore excel at: marginal change, instant plain-language feedback, what-if exploration, and easy entity add/remove — with full regeneration as a power tool, not the front door.
