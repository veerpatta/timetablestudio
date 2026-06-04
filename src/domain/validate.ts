// Shared validation core. PURE — used by BOTH the editor (live badges) and the
// solver (feasibility oracle). One implementation, never duplicated.
//
// Implements hard constraints H1–H6, H8, H9 (see docs/CONSTRAINTS.md).
// H7 (quota exact) is reported as status, not a violation, until generation
// exists (M3) — see `quotaStatus`. H10 (pinned immovable) is a solver-time
// invariant with no static representation, so it is enforced in solver/, not here.

import {
  deriveMaps,
  occupiedPeriods,
  type DerivedMaps,
} from "./derive";
import type {
  CurriculumRequirement,
  Day,
  Id,
  Lesson,
  Project,
  Subject,
  Teacher,
  Timetable,
  Violation,
} from "./types";

interface NameLookups {
  teacher: Map<Id, Teacher>;
  className: Map<Id, string>;
  subject: Map<Id, Subject>;
}

function buildLookups(project: Project): NameLookups {
  const teacher = new Map<Id, Teacher>();
  for (const t of project.teachers) teacher.set(t.id, t);
  const className = new Map<Id, string>();
  for (const c of project.classes) className.set(c.id, c.name);
  const subject = new Map<Id, Subject>();
  for (const s of project.subjects) subject.set(s.id, s);
  return { teacher, className, subject };
}

const tName = (l: NameLookups, id: Id) => l.teacher.get(id)?.name ?? id;
const cName = (l: NameLookups, id: Id) => l.className.get(id) ?? id;
const sName = (l: NameLookups, id: Id) => l.subject.get(id)?.name ?? id;
const slotLabel = (day: Day, period: number) => `${day} P${period}`;

function periodsPerDay(project: Project, timetable: Timetable): number {
  const profile = project.profiles.find((p) => p.id === timetable.profileId);
  return profile ? profile.periods.length : 6;
}

// --- H1: teacher clash ---
function checkTeacherClash(maps: DerivedMaps, look: NameLookups): Violation[] {
  const out: Violation[] = [];
  for (const [teacherId, slots] of maps.teacherCells) {
    for (const [, occ] of slots) {
      // Each placement contributes exactly one teacher occupancy per slot, so
      // >1 occupancy == >1 placement here == a clash (incl. two placements of
      // the same canonical lesson, or two overlapping blocks).
      if (occ.length > 1) {
        const { day, period } = occ[0]!;
        out.push({
          constraintId: "H1",
          severity: "hard",
          message: `${tName(look, teacherId)} is double-booked at ${slotLabel(
            day,
            period,
          )} (${occ.length} activities).`,
          slots: [{ teacherId, day, period }],
        });
      }
    }
  }
  return out;
}

// --- H2: class clash ---
function checkClassClash(maps: DerivedMaps, look: NameLookups): Violation[] {
  const out: Violation[] = [];
  for (const [classId, slots] of maps.classCells) {
    for (const [, occ] of slots) {
      if (occ.length > 1) {
        const { day, period } = occ[0]!;
        out.push({
          constraintId: "H2",
          severity: "hard",
          message: `${cName(look, classId)} has ${occ.length} activities at ${slotLabel(
            day,
            period,
          )}.`,
          slots: [{ classId, day, period }],
        });
      }
    }
  }
  return out;
}

// --- H3 (structural block integrity) + H4 (block bounds) ---
function checkBlocks(
  project: Project,
  timetable: Timetable,
  maps: DerivedMaps,
): Violation[] {
  const out: Violation[] = [];
  const ppd = periodsPerDay(project, timetable);
  for (const placement of timetable.placements) {
    const activity = maps.activityIndex.get(placement.activityId);
    if (!activity || activity.kind !== "block") continue;
    // H3: a block must be whole — non-degenerate definition.
    if (activity.length < 1 || activity.classIds.length === 0 || activity.teacherIds.length === 0) {
      out.push({
        constraintId: "H3",
        severity: "hard",
        message: `Block "${activity.name}" is not atomic: needs length ≥ 1 and at least one class and teacher.`,
        slots: [{ day: placement.day, period: placement.period }],
      });
    }
    // H4: block fits inside the day.
    const last = placement.period + activity.length - 1;
    if (placement.period < 1 || last > ppd) {
      out.push({
        constraintId: "H4",
        severity: "hard",
        message: `Block "${activity.name}" at ${slotLabel(placement.day, placement.period)} runs to P${last}, outside the ${ppd}-period day.`,
        slots: occupiedPeriods(activity, placement.period).map((period) => ({
          day: placement.day,
          period,
        })),
      });
    }
  }
  return out;
}

// --- H5: teacher availability ---
function checkAvailability(maps: DerivedMaps, look: NameLookups): Violation[] {
  const out: Violation[] = [];
  for (const [teacherId, slots] of maps.teacherCells) {
    const teacher = look.teacher.get(teacherId);
    if (!teacher || teacher.unavailable.length === 0) continue;
    const blocked = new Set(teacher.unavailable.map((s) => `${s.day}#${s.period}`));
    for (const [key, occ] of slots) {
      if (blocked.has(key)) {
        const { day, period } = occ[0]!;
        out.push({
          constraintId: "H5",
          severity: "hard",
          message: `${teacher.name} is scheduled at ${slotLabel(day, period)} but marked unavailable.`,
          slots: [{ teacherId, day, period }],
        });
      }
    }
  }
  return out;
}

// --- H6: qualified teacher (lessons only; blocks carry no subject) ---
function checkQualified(
  timetable: Timetable,
  maps: DerivedMaps,
  look: NameLookups,
): Violation[] {
  const out: Violation[] = [];
  for (const placement of timetable.placements) {
    const activity = maps.activityIndex.get(placement.activityId);
    if (!activity || activity.kind !== "lesson") continue;
    const lesson = activity;
    for (const teacherId of lesson.teacherIds) {
      const teacher = look.teacher.get(teacherId);
      if (teacher && !teacher.subjects.includes(lesson.subjectId)) {
        out.push({
          constraintId: "H6",
          severity: "hard",
          message: `${teacher.name} is not qualified to teach ${sName(look, lesson.subjectId)} (${cName(look, lesson.classId)} at ${slotLabel(placement.day, placement.period)}).`,
          slots: [{ classId: lesson.classId, teacherId, day: placement.day, period: placement.period }],
        });
      }
    }
  }
  return out;
}

// --- H8: daily max per requirement (class+subject per day ≤ maxPerDay) ---
function checkDailyMax(
  project: Project,
  timetable: Timetable,
  maps: DerivedMaps,
  look: NameLookups,
): Violation[] {
  const out: Violation[] = [];
  const reqBySubjectClass = new Map<string, CurriculumRequirement>();
  for (const r of project.requirements.curriculum) {
    reqBySubjectClass.set(`${r.classId}#${r.subjectId}`, r);
  }
  // count lessons per (classId#subjectId#day)
  const counts = new Map<string, { day: Day; classId: Id; subjectId: Id; n: number }>();
  for (const placement of timetable.placements) {
    const activity = maps.activityIndex.get(placement.activityId);
    if (!activity || activity.kind !== "lesson") continue;
    const lesson: Lesson = activity;
    const key = `${lesson.classId}#${lesson.subjectId}#${placement.day}`;
    const cur = counts.get(key);
    if (cur) cur.n++;
    else counts.set(key, { day: placement.day, classId: lesson.classId, subjectId: lesson.subjectId, n: 1 });
  }
  for (const { day, classId, subjectId, n } of counts.values()) {
    const req = reqBySubjectClass.get(`${classId}#${subjectId}`);
    // H8 is scoped "per requirement" (CONSTRAINTS.md). Without a requirement
    // there is no cap to enforce — the `default 2` belongs to a requirement
    // that omits maxPerDay, not a global floor. This keeps H8 coherent with
    // H7's deferral and avoids false flags on freshly imported real data.
    if (!req) continue;
    const maxPerDay = req.maxPerDay ?? 2;
    if (n > maxPerDay) {
      out.push({
        constraintId: "H8",
        severity: "hard",
        message: `${cName(look, classId)} has ${n} periods of ${sName(look, subjectId)} on ${day} (max ${maxPerDay}/day).`,
        slots: [{ classId, day, period: 0 }],
      });
    }
  }
  return out;
}

// --- H9: teacher daily load ≤ maxPeriodsPerDay ---
function checkTeacherLoad(maps: DerivedMaps, look: NameLookups): Violation[] {
  const out: Violation[] = [];
  for (const [teacherId, slots] of maps.teacherCells) {
    const teacher = look.teacher.get(teacherId);
    if (!teacher) continue;
    const perDay = new Map<Day, number>();
    for (const occ of slots.values()) {
      const { day } = occ[0]!;
      perDay.set(day, (perDay.get(day) ?? 0) + 1);
    }
    for (const [day, n] of perDay) {
      if (n > teacher.maxPeriodsPerDay) {
        out.push({
          constraintId: "H9",
          severity: "hard",
          message: `${teacher.name} is scheduled ${n} periods on ${day} (max ${teacher.maxPeriodsPerDay}/day).`,
          slots: [{ teacherId, day, period: 0 }],
        });
      }
    }
  }
  return out;
}

/** Run all implemented hard constraints. Pure; sorted by constraintId for stability. */
export function validate(project: Project, timetable: Timetable): Violation[] {
  const look = buildLookups(project);
  const maps = deriveMaps(project, timetable);
  const violations: Violation[] = [
    ...checkTeacherClash(maps, look),
    ...checkClassClash(maps, look),
    ...checkBlocks(project, timetable, maps),
    ...checkAvailability(maps, look),
    ...checkQualified(timetable, maps, look),
    ...checkDailyMax(project, timetable, maps, look),
    ...checkTeacherLoad(maps, look),
  ];
  violations.sort((a, b) => a.constraintId.localeCompare(b.constraintId));
  return violations;
}

// --- H7 quota status (not a violation until generation; M3) ---
export interface QuotaStatus {
  requirementId: Id;
  classId: Id;
  subjectId: Id;
  required: number;
  placed: number;
  status: "ok" | "short" | "excess";
}

export function quotaStatus(project: Project, timetable: Timetable): QuotaStatus[] {
  const maps = deriveMaps(project, timetable);
  const placedCount = new Map<string, number>();
  for (const placement of timetable.placements) {
    const activity = maps.activityIndex.get(placement.activityId);
    if (!activity || activity.kind !== "lesson") continue;
    const key = `${activity.classId}#${activity.subjectId}`;
    placedCount.set(key, (placedCount.get(key) ?? 0) + 1);
  }
  return project.requirements.curriculum.map((r) => {
    const placed = placedCount.get(`${r.classId}#${r.subjectId}`) ?? 0;
    const status: QuotaStatus["status"] =
      placed === r.periodsPerWeek ? "ok" : placed < r.periodsPerWeek ? "short" : "excess";
    return {
      requirementId: r.id,
      classId: r.classId,
      subjectId: r.subjectId,
      required: r.periodsPerWeek,
      placed,
      status,
    };
  });
}
