// Substitution assistant. PURE. Given absent teachers on a day, propose per-slot
// covers from FREE, QUALIFIED teachers respecting H1 (no clash), H5 (availability)
// and H9 (daily load), ranked by S1/S4 disruption (prefer no new gap, lighter day).
//
// ELGA rule (M5 AC): an absent ELGA teacher cannot be silently auto-covered — a
// level group can't be reassigned without an owner decision. Such placements are
// returned as status "owner-decision", never as auto-cover suggestions.
//
// Read-only: never mutates the timetable; produces a separate cover plan.

import { deriveMaps, occupiedPeriods } from "./derive";
import type { Day, Id, Project, Teacher } from "./types";

export interface CoverCandidate {
  teacherId: Id;
  teacherName: string;
  load: number; // candidate's existing periods that day (S4)
  createsGap: boolean; // would covering open a gap in their day (S1)
  score: number; // lower = less disruptive
}

export interface CoverItem {
  kind: "lesson" | "block";
  status: "needs-cover" | "owner-decision" | "partial";
  classIds: Id[];
  classLabel: string;
  subjectLabel: string;
  day: Day;
  periods: number[];
  absentTeacherIds: Id[];
  presentTeacherIds: Id[]; // remaining (non-absent) teachers on the activity
  candidates: CoverCandidate[]; // per first period; empty for owner-decision/partial
}

export interface SubstitutionPlan {
  day: Day;
  absentTeacherIds: Id[];
  items: CoverItem[];
}

export function proposeSubstitutions(
  project: Project,
  timetableId: Id,
  opts: { day: Day; absentTeacherIds: Id[] },
): SubstitutionPlan {
  const { day } = opts;
  const absent = new Set(opts.absentTeacherIds);
  const timetable = project.timetables.find((t) => t.id === timetableId);
  if (!timetable) throw new Error(`Timetable ${timetableId} not found`);
  const profile = project.profiles.find((p) => p.id === timetable.profileId);
  const periodCount = profile ? profile.periods.length : 6;
  const subjectName = new Map(project.subjects.map((s) => [s.id, s.name] as const));
  const className = new Map(project.classes.map((c) => [c.id, c.name] as const));
  const index = new Map(project.activities.map((a) => [a.id, a] as const));
  const maps = deriveMaps(project, timetable);

  const busyAt = (teacherId: Id, period: number): boolean =>
    (maps.teacherCells.get(teacherId)?.get(`${day}#${period}`)?.length ?? 0) > 0;
  const unavailableAt = (t: Teacher, period: number): boolean =>
    t.unavailable.some((s) => s.day === day && s.period === period);
  const periodsThatDay = (teacherId: Id): number[] => {
    const out: number[] = [];
    const slots = maps.teacherCells.get(teacherId);
    if (slots) for (const occ of slots.values()) if (occ[0]!.day === day) out.push(occ[0]!.period);
    return out.sort((a, b) => a - b);
  };

  const rankCandidates = (subjectId: Id, periods: number[]): CoverCandidate[] => {
    const first = periods[0]!;
    const out: CoverCandidate[] = [];
    for (const t of project.teachers) {
      if (absent.has(t.id)) continue;
      if (!t.subjects.includes(subjectId)) continue; // H6 qualified
      // H1: free for every period the cover spans; H5: available; H9: under cap.
      if (periods.some((p) => busyAt(t.id, p) || unavailableAt(t, p))) continue;
      const existing = periodsThatDay(t.id);
      if (existing.length + periods.length > t.maxPeriodsPerDay) continue;
      const createsGap =
        existing.length > 0 &&
        first > Math.min(...existing) + 1 &&
        first < Math.max(...existing) - 1
          ? false
          : existing.length > 0 && !existing.includes(first - 1) && !existing.includes(first + 1);
      const load = existing.length;
      out.push({
        teacherId: t.id,
        teacherName: t.name,
        load,
        createsGap,
        score: (createsGap ? 5 : 0) + load * 3, // S1 weight 5, S4 weight 3
      });
    }
    return out.sort((a, b) => a.score - b.score || a.teacherId.localeCompare(b.teacherId));
  };

  const items: CoverItem[] = [];
  for (const placement of timetable.placements) {
    if (placement.day !== day) continue;
    const a = index.get(placement.activityId);
    if (!a) continue;
    const activeAbsent = a.teacherIds.filter((t) => absent.has(t));
    if (activeAbsent.length === 0) continue;
    const periods = occupiedPeriods(a, placement.period).filter((p) => p <= periodCount);
    const present = a.teacherIds.filter((t) => !absent.has(t));

    if (a.kind === "block") {
      items.push({
        kind: "block",
        status: "owner-decision",
        classIds: a.classIds,
        classLabel: a.classIds.map((c) => className.get(c) ?? c).join(", "),
        subjectLabel: a.name,
        day,
        periods,
        absentTeacherIds: activeAbsent,
        presentTeacherIds: present,
        candidates: [],
      });
      continue;
    }

    // multi-teacher lesson with someone still present → can proceed (reduced staff)
    if (present.length > 0) {
      items.push({
        kind: "lesson",
        status: "partial",
        classIds: [a.classId],
        classLabel: className.get(a.classId) ?? a.classId,
        subjectLabel: subjectName.get(a.subjectId) ?? a.subjectId,
        day,
        periods,
        absentTeacherIds: activeAbsent,
        presentTeacherIds: present,
        candidates: [],
      });
      continue;
    }

    items.push({
      kind: "lesson",
      status: "needs-cover",
      classIds: [a.classId],
      classLabel: className.get(a.classId) ?? a.classId,
      subjectLabel: subjectName.get(a.subjectId) ?? a.subjectId,
      day,
      periods,
      absentTeacherIds: activeAbsent,
      presentTeacherIds: [],
      candidates: rankCandidates(a.subjectId, periods),
    });
  }

  // stable order: by first period, then class label
  items.sort(
    (x, y) => (x.periods[0]! - y.periods[0]!) || x.classLabel.localeCompare(y.classLabel),
  );
  return { day, absentTeacherIds: opts.absentTeacherIds, items };
}
