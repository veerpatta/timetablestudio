// Aggregate constraint evaluators (PURE) — whole-timetable checks that can't be judged
// from one placement (caps, spread, variety, balance). Each returns PartialViolations
// (the orchestrator stamps constraintId + severity). Math lifted from the deprecated
// rules.ts where an equivalent R-rule existed (R10/R11/R12/R13/R14/R9), now parameterized.

import {
  byDay,
  type EvalCtx,
  lessonsByClass,
  lessonsByTeacher,
  longestRun,
  type PartialViolation,
  slotName,
} from "./constraintShared";
import type {
  BalanceTeacherLoadsConstraint,
  ClassBoardProtectConstraint,
  ClassDailyVarietyConstraint,
  ClassMaxConsecutiveSameConstraint,
  ClassMaxTeachersPerDayConstraint,
  ClassNoFreeConstraint,
  ClassTeacherP1Constraint,
  CoreSubjectsEarlyConstraint,
  Id,
  SubjectMaxPerDayConstraint,
  SubjectNotAdjacentConstraint,
  SubjectOrderConstraint,
  SubjectSpreadMinDaysConstraint,
  TeacherCompactDayConstraint,
  TeacherMaxConsecutiveConstraint,
  TeacherMaxDaysPerWeekConstraint,
  TeacherMaxPerDayConstraint,
  TeacherMaxPerWeekConstraint,
  TeacherMinFreePerWeekConstraint,
} from "./types";

// ---- teacher ----
export function teacherMaxPerWeek(c: TeacherMaxPerWeekConstraint, x: EvalCtx): PartialViolation[] {
  const ls = lessonsByTeacher(x.maps, c.params.teacherId);
  if (ls.length <= c.params.max) return [];
  return [{ message: `${x.n.t(c.params.teacherId)} teaches ${ls.length} periods a week, more than the limit of ${c.params.max}.`, slots: ls.map((l) => ({ teacherId: c.params.teacherId, day: l.day, slot: l.slot })) }];
}
export function teacherMaxPerDay(c: TeacherMaxPerDayConstraint, x: EvalCtx): PartialViolation[] {
  const out: PartialViolation[] = [];
  for (const [day, ls] of byDay(lessonsByTeacher(x.maps, c.params.teacherId)))
    if (ls.length > c.params.max) out.push({ message: `${x.n.t(c.params.teacherId)} teaches ${ls.length} periods on ${day}, more than the limit of ${c.params.max}.`, slots: ls.map((l) => ({ teacherId: c.params.teacherId, day, slot: l.slot })) });
  return out;
}
export function teacherMaxConsecutive(c: TeacherMaxConsecutiveConstraint, x: EvalCtx): PartialViolation[] {
  const out: PartialViolation[] = [];
  for (const [day, ls] of byDay(lessonsByTeacher(x.maps, c.params.teacherId))) {
    const run = longestRun(ls.map((l) => l.slot), x.teach);
    if (run > c.params.max) out.push({ message: `${x.n.t(c.params.teacherId)} teaches ${run} periods in a row on ${day}, more than the limit of ${c.params.max}.`, slots: ls.map((l) => ({ teacherId: c.params.teacherId, day, slot: l.slot })) });
  }
  return out;
}
export function teacherMaxDaysPerWeek(c: TeacherMaxDaysPerWeekConstraint, x: EvalCtx): PartialViolation[] {
  const days = new Set(lessonsByTeacher(x.maps, c.params.teacherId).map((l) => l.day));
  if (days.size <= c.params.max) return [];
  return [{ message: `${x.n.t(c.params.teacherId)} teaches on ${days.size} days, more than the limit of ${c.params.max}.`, slots: [{ teacherId: c.params.teacherId, day: "Mon", slot: x.teach[0]! }] }];
}
export function teacherMinFreePerWeek(c: TeacherMinFreePerWeekConstraint, x: EvalCtx): PartialViolation[] {
  const totalTeaching = x.profile.days.length * x.teach.length;
  const free = totalTeaching - lessonsByTeacher(x.maps, c.params.teacherId).length;
  if (free >= c.params.min) return [];
  return [{ message: `${x.n.t(c.params.teacherId)} has only ${free} free periods a week, fewer than the ${c.params.min} wanted.`, slots: [{ teacherId: c.params.teacherId, day: "Mon", slot: x.teach[0]! }] }];
}
export function teacherCompactDay(c: TeacherCompactDayConstraint, x: EvalCtx): PartialViolation[] {
  const out: PartialViolation[] = [];
  for (const [day, ls] of byDay(lessonsByTeacher(x.maps, c.params.teacherId))) {
    const used = ls.map((l) => x.teach.indexOf(l.slot)).filter((i) => i >= 0).sort((a, b) => a - b);
    if (used.length < 2) continue;
    const gaps = used[used.length - 1]! - used[0]! - (used.length - 1);
    if (gaps > 0) out.push({ message: `${x.n.t(c.params.teacherId)} has ${gaps} free gap(s) between lessons on ${day}.`, slots: [{ teacherId: c.params.teacherId, day, slot: x.teach[used[0]!]! }] });
  }
  return out;
}

// ---- subject (aggregate) ----
export function subjectMaxPerDay(c: SubjectMaxPerDayConstraint, x: EvalCtx): PartialViolation[] {
  const out: PartialViolation[] = [];
  for (const classId of c.params.classIds)
    for (const [day, ls] of byDay(lessonsByClass(x.maps, classId))) {
      const hits = ls.filter((l) => c.params.subjectIds.includes(l.event.subjectId));
      if (hits.length > c.params.max) out.push({ message: `${x.n.c(classId)} has ${hits.length} periods of ${c.params.subjectIds.map(x.n.s).join("/")} on ${day}, more than the limit of ${c.params.max}.`, slots: hits.map((l) => ({ classId, day, slot: l.slot })) });
    }
  return out;
}
export function subjectSpreadMinDays(c: SubjectSpreadMinDaysConstraint, x: EvalCtx): PartialViolation[] {
  const out: PartialViolation[] = [];
  for (const classId of c.params.classIds) {
    const ls = lessonsByClass(x.maps, classId).filter((l) => c.params.subjectIds.includes(l.event.subjectId));
    const days = new Set(ls.map((l) => l.day));
    if (days.size > 0 && days.size < c.params.minDays) out.push({ message: `${x.n.c(classId)}'s ${c.params.subjectIds.map(x.n.s).join("/")} is only on ${days.size} day(s); spread it across at least ${c.params.minDays}.`, slots: ls.map((l) => ({ classId, day: l.day, slot: l.slot })) });
  }
  return out;
}
export function subjectOrder(c: SubjectOrderConstraint, x: EvalCtx): PartialViolation[] {
  const out: PartialViolation[] = [];
  for (const [day, ls] of byDay(lessonsByClass(x.maps, c.params.classId))) {
    const a = ls.filter((l) => l.event.subjectId === c.params.beforeSubjectId).map((l) => l.slot);
    const b = ls.filter((l) => l.event.subjectId === c.params.afterSubjectId).map((l) => l.slot);
    if (a.length && b.length && Math.max(...a) > Math.min(...b)) out.push({ message: `On ${day}, ${x.n.s(c.params.beforeSubjectId)} should come before ${x.n.s(c.params.afterSubjectId)} for ${x.n.c(c.params.classId)}.`, slots: [{ classId: c.params.classId, day, slot: Math.min(...b) }] });
  }
  return out;
}
export function subjectNotAdjacent(c: SubjectNotAdjacentConstraint, x: EvalCtx): PartialViolation[] {
  const out: PartialViolation[] = [];
  for (const [day, ls] of byDay(lessonsByClass(x.maps, c.params.classId))) {
    const slotOf = (sid: Id) => ls.filter((l) => l.event.subjectId === sid).map((l) => x.teach.indexOf(l.slot));
    const as = slotOf(c.params.subjectAId);
    const bs = slotOf(c.params.subjectBId);
    for (const ai of as) for (const bi of bs) if (Math.abs(ai - bi) === 1) { out.push({ message: `On ${day}, ${x.n.s(c.params.subjectAId)} and ${x.n.s(c.params.subjectBId)} are back-to-back for ${x.n.c(c.params.classId)}.`, slots: [{ classId: c.params.classId, day, slot: x.teach[Math.min(ai, bi)]! }] }); break; }
  }
  return out;
}

// ---- class ----
export function classTeacherP1(c: ClassTeacherP1Constraint, x: EvalCtx): PartialViolation[] {
  const klass = x.project.classes.find((k) => k.id === c.params.classId);
  const ct = klass?.classTeacherId;
  if (!ct) return [];
  const p1 = x.teach[0]!;
  const lessons = lessonsByClass(x.maps, c.params.classId);
  const out: PartialViolation[] = [];
  for (const day of x.profile.days) {
    const at = lessons.find((l) => l.day === day && l.slot === p1);
    const ok = at && at.event.teacherIds.includes(ct) && (!c.params.subjectId || at.event.subjectId === c.params.subjectId);
    if (!ok) out.push({ message: `${x.n.c(c.params.classId)} should start ${day} with ${x.n.t(ct)} (the class teacher), but doesn't.`, slots: [{ classId: c.params.classId, day, slot: p1 }] });
  }
  return out;
}
export function classMaxTeachersPerDay(c: ClassMaxTeachersPerDayConstraint, x: EvalCtx): PartialViolation[] {
  const out: PartialViolation[] = [];
  for (const [day, ls] of byDay(lessonsByClass(x.maps, c.params.classId))) {
    const teachers = new Set(ls.flatMap((l) => l.event.teacherIds));
    if (teachers.size > c.params.max) out.push({ message: `${x.n.c(c.params.classId)} sees ${teachers.size} different teachers on ${day}, more than the limit of ${c.params.max}.`, slots: ls.map((l) => ({ classId: c.params.classId, day, slot: l.slot })) });
  }
  return out;
}
export function classDailyVariety(c: ClassDailyVarietyConstraint, x: EvalCtx): PartialViolation[] {
  const out: PartialViolation[] = [];
  for (const [day, ls] of byDay(lessonsByClass(x.maps, c.params.classId))) {
    const bySubject = new Map<Id, Set<Id>>(); // subject -> distinct eventIds
    for (const l of ls) (bySubject.get(l.event.subjectId) ?? bySubject.set(l.event.subjectId, new Set()).get(l.event.subjectId)!).add(l.event.id);
    for (const [sid, evs] of bySubject) if (evs.size > 1) out.push({ message: `${x.n.c(c.params.classId)} has ${x.n.s(sid)} more than once on ${day} (not as a double).`, slots: ls.filter((l) => l.event.subjectId === sid).map((l) => ({ classId: c.params.classId, day, slot: l.slot })) });
  }
  return out;
}
export function classMaxConsecutiveSame(c: ClassMaxConsecutiveSameConstraint, x: EvalCtx): PartialViolation[] {
  const out: PartialViolation[] = [];
  for (const [day, ls] of byDay(lessonsByClass(x.maps, c.params.classId))) {
    const sorted = [...ls].sort((a, b) => x.teach.indexOf(a.slot) - x.teach.indexOf(b.slot));
    let run = 1, max = sorted.length ? 1 : 0, runSubj = sorted[0]?.event.subjectId;
    for (let i = 1; i < sorted.length; i++) {
      const adj = x.teach.indexOf(sorted[i]!.slot) === x.teach.indexOf(sorted[i - 1]!.slot) + 1;
      run = adj && sorted[i]!.event.subjectId === sorted[i - 1]!.event.subjectId ? run + 1 : 1;
      if (run > max) { max = run; runSubj = sorted[i]!.event.subjectId; }
    }
    if (max > c.params.max) out.push({ message: `${x.n.c(c.params.classId)} has ${max} periods of ${x.n.s(runSubj!)} in a row on ${day}, more than the limit of ${c.params.max}.`, slots: [{ classId: c.params.classId, day, slot: sorted[0]!.slot }] });
  }
  return out;
}
export function classNoFree(c: ClassNoFreeConstraint, x: EvalCtx): PartialViolation[] {
  const out: PartialViolation[] = [];
  for (const l of lessonsByClass(x.maps, c.params.classId))
    if (l.event.type === "free" || l.event.type === "self_study") out.push({ message: `${x.n.c(c.params.classId)} has a free period on ${l.day} at ${slotName(x.profile, l.slot)}.`, slots: [{ classId: c.params.classId, day: l.day, slot: l.slot }] });
  return out;
}
export function classBoardProtect(c: ClassBoardProtectConstraint, x: EvalCtx): PartialViolation[] {
  const earlyThree = new Set(x.teach.slice(0, 3));
  const core = new Set(c.params.coreSubjectIds);
  const out: PartialViolation[] = [];
  for (const l of lessonsByClass(x.maps, c.params.classId)) {
    if (!earlyThree.has(l.slot)) continue;
    const subj = x.project.subjects.find((s) => s.id === l.event.subjectId);
    if (subj?.kind === "academic" && !core.has(l.event.subjectId)) out.push({ message: `${x.n.c(c.params.classId)} (board class) has ${x.n.s(l.event.subjectId)} at ${slotName(x.profile, l.slot)} — keep the first three periods for core subjects.`, slots: [{ classId: c.params.classId, day: l.day, slot: l.slot }] });
  }
  return out;
}

// ---- global ----
export function balanceTeacherLoads(c: BalanceTeacherLoadsConstraint, x: EvalCtx): PartialViolation[] {
  const loads = x.project.teachers.filter((t) => t.schedulable).map((t) => lessonsByTeacher(x.maps, t.id).length);
  if (loads.length < 2) return [];
  const spread = Math.max(...loads) - Math.min(...loads);
  if (spread <= c.params.maxSpread) return [];
  return [{ message: `Teacher workloads vary by ${spread} periods (from ${Math.min(...loads)} to ${Math.max(...loads)}), more than the ${c.params.maxSpread} wanted.`, slots: [] }];
}
export function coreSubjectsEarly(c: CoreSubjectsEarlyConstraint, x: EvalCtx): PartialViolation[] {
  const out: PartialViolation[] = [];
  const second = new Set(x.teach.slice(Math.ceil(x.teach.length / 2)));
  for (const klass of x.project.classes)
    for (const l of lessonsByClass(x.maps, klass.id))
      if (c.params.subjectIds.includes(l.event.subjectId) && second.has(l.slot)) out.push({ message: `${x.n.s(l.event.subjectId)} for ${x.n.c(klass.id)} is in the afternoon (${slotName(x.profile, l.slot)}); core subjects are better earlier.`, slots: [{ classId: klass.id, day: l.day, slot: l.slot }] });
  return out;
}
