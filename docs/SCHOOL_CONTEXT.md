# School Context — Veer Patta Public School (VPPS)

Factual ground truth extracted from the live viewer app (`veerpatta/timetable2025`). Agents must not invent entities beyond this without the owner's confirmation.

## Structure

- **Days**: Monday–Saturday (6 days).
- **Periods**: 6 per day. Current "heatwave" profile: P1 starts 07:30, each period 40 min (P1 7:30–8:10, …). Timings are a configurable *schedule profile*, not hardcoded — the school switches profiles seasonally.
- **Non-teaching slots** (reporting, short break/hydration, dispersal) are timing metadata of the profile, NOT timetable columns.

## Classes (16)

Class 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11 Arts, 11 Commerce, 11 Science, 12 Arts, 12 Commerce, 12 Science.

Senior secondary (11/12) streams run in parallel and share stream-specific teachers — a chemistry teacher may serve both 11 Science and 12 Science, so senior science scheduling is tightly coupled.

## Teachers (current roster, 18)

Anita, Anjana, Antima, Bindu, Harshita, Hemlata, Jainendra, Kusum, Mahesh, Maya, Nathulal, Nidhika, Pradhyuman, Prakash, Rakesh, Rashmita, Ravina, Toshit. **Confirmed (2026-06-05, M12)**: importing `docs/sources/rawData.vpps.txt` yields exactly these 18 — the earlier "~19" was approximate. The roster may change between sessions; re-verify on each import.

**Authoritative data snapshot**: `docs/sources/rawData.vpps.txt` — the real, full 6-day rawData extracted verbatim from the live viewer (2026-06-05). Use it for the real-data fixture, semantic round-trip tests, and quota inference. It supersedes any synthetic sample where they disagree.

## Subjects (observed)

Primary (1–5): Maths, Hindi, EVS, English, ELGA, English Revision.
Middle/secondary: English compulsory, Hindi, Maths, Science, Social Science, etc.
Senior: Physics, Chemistry, Biology, Maths, Business Studies, Accountancy, Economics, Hindi, English compulsory, Core Revision, etc.
"Free" is a valid cell value (no activity).

## ELGA — the defining complexity

ELGA (English Language Graded Assessment-style regrouping):

- Students of **Classes 1–5 leave their home classes and regroup by English proficiency level** into mixed-age groups.
- Runs as a **block of 3 consecutive periods** (P3–P5) on ELGA days. **Confirmed (2026-06-05, M12)**: the real snapshot runs ELGA on **Monday–Thursday** (4 days), starting P3. (This supersedes the earlier "Mon+Thu" assumption in HANDOFF/the synthetic demo — the snapshot is law; see docs/DECISIONS.md.)
- During the block, **all five primary teachers (Bindu, Anita, Rashmita, Kusum, Ravina) teach simultaneously** — each takes one level group.
- Consequences for scheduling:
  - The block is **atomic**: all 5 classes × 3 periods × 5 teachers, or nothing. You cannot move one class's ELGA independently.
  - While ELGA runs, none of the five teachers is available for Classes 6–12.
  - Legacy data renders it as `ELGA (Bindu / Anita / Rashmita / Kusum / Ravina)` repeated in every Class 1–5 row for each block period.

## Other known complexity

- **Shared teachers everywhere**: most teachers teach multiple classes and multiple subjects; teacher availability (not rooms) is the binding constraint. Rooms are out of scope for v1.
- **Combined senior sections** (confirmed in the snapshot, M12): the 11/12 streams (Arts/Commerce/Science of a grade) attend some subjects **together** as one joint section — e.g. Hindi and English compulsory are taught to all three streams of a grade at the same period by one teacher; Economics is shared by Arts+Commerce. The legacy viewer duplicates such a cell in every stream's row (like ELGA). The app models each as one multi-class lesson (a length-1 block) so the shared teacher is occupied once, not flagged as a clash.
- **Multi-teacher cells** can occur outside ELGA (joint activities).
- **Substitutions** are a daily operational need — the viewer already has a substitution view; this app's Phase 4 generates substitution plans.
- **Period-position preferences** exist (e.g., heavy subjects early); capture them as soft constraints, owner will refine weights.

## Open questions for the owner (track in docs/DECISIONS.md as answered)

1. Exact per-class subject quotas (how many periods of each subject per week per class)? — **Partially answered (M12)**: inferred from the snapshot and confirmable via the post-import quota review; owner can still adjust targets.
2. Teacher max load per day / per week, and any unavailable slots (part-time teachers)? — defaults 6/day, 36/week; editable per teacher.
3. Which days carry ELGA blocks, and is P3–P5 fixed or movable as a whole? — **Answered (M12)**: snapshot shows **Mon–Thu, P3–P5**.
4. Any room/lab constraints worth modeling in v2? — still out of scope (parked).
