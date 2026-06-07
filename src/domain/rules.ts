// Configurable rule engine (PURE) — RB6. Compiles each enabled Rule (R1–R15) to a
// predicate over (project, timetable) producing Violations in the shared shape. `must`
// rules count as hard (joined into validate()), `prefer` rules as soft. Messages are plain
// language (no codes on the main surface); constraintId stays the template id for keys.
//
// Decision (legal-only ripple): must-rules are surfaced as hard violations (so canMove /
// canSwap / suggestFixes respect them for free, gating on hard count), but legalOptions /
// the solver do NOT pre-exclude them — they show up as fixable issues. The picker still
// never offers an unqualified or clashing cell (the task's explicit guarantee). See
// DATA_MODEL § legal-move rule + DECISIONS.

import { deriveMaps, findProfile } from "./derive";
import { teachingSlots } from "./profile";
import type { Day, Id, Profile, Project, Rule, Timetable, TimetableEvent, Violation } from "./types";

interface Lesson {
  day: Day;
  slot: number;
  event: TimetableEvent;
}

const slotName = (profile: Profile, n: number): string => profile.slots.find((s) => s.index === n)?.label ?? `slot ${n}`;

function lessonsByClass(maps: ReturnType<typeof deriveMaps>, classId: Id): Lesson[] {
  const out: Lesson[] = [];
  for (const [key, occ] of maps.classCells.get(classId) ?? []) {
    const [day, slot] = key.split("#");
    if (occ[0]) out.push({ day: day as Day, slot: Number(slot), event: occ[0].event });
  }
  return out;
}
function lessonsByTeacher(maps: ReturnType<typeof deriveMaps>, teacherId: Id): Lesson[] {
  const out: Lesson[] = [];
  for (const [key, occ] of maps.teacherCells.get(teacherId) ?? []) {
    const [day, slot] = key.split("#");
    if (occ[0]) out.push({ day: day as Day, slot: Number(slot), event: occ[0].event });
  }
  return out;
}
const byDay = <T extends { day: Day }>(items: T[]): Map<Day, T[]> => {
  const m = new Map<Day, T[]>();
  for (const it of items) (m.get(it.day) ?? m.set(it.day, []).get(it.day)!).push(it);
  return m;
};

export function evaluateRules(project: Project, timetable: Timetable): Violation[] {
  const profile = findProfile(project, timetable);
  if (!profile) return [];
  const maps = deriveMaps(project, timetable);
  const sName = (id: Id) => project.subjects.find((s) => s.id === id)?.name ?? id;
  const cName = (id: Id) => project.classes.find((c) => c.id === id)?.name ?? id;
  const tName = (id: Id) => project.teachers.find((t) => t.id === id)?.name ?? id;
  const teach = teachingSlots(profile);

  const out: Violation[] = [];
  for (const rule of project.rules) {
    if (!rule.enabled) continue;
    const sev: Violation["severity"] = rule.severity === "must" ? "hard" : "soft";
    const add = (message: string, slots: Violation["slots"]) => out.push({ constraintId: rule.template, severity: sev, message, slots });
    evalRule(rule, { project, tt: timetable, maps, profile, teach, sName, cName, tName, add });
  }
  return out;
}

interface Ctx {
  project: Project;
  tt: Timetable;
  maps: ReturnType<typeof deriveMaps>;
  profile: Profile;
  teach: number[];
  sName: (id: Id) => string;
  cName: (id: Id) => string;
  tName: (id: Id) => string;
  add: (message: string, slots: Violation["slots"]) => void;
}

function evalRule(rule: Rule, c: Ctx): void {
  switch (rule.template) {
    case "R1": // subject ONLY in given slots
      for (const classId of rule.classIds)
        for (const l of lessonsByClass(c.maps, classId))
          if (rule.subjectIds.includes(l.event.subjectId) && !rule.slots.includes(l.slot))
            c.add(`${c.sName(l.event.subjectId)} for ${c.cName(classId)} is at ${slotName(c.profile, l.slot)}, which isn't an allowed period for it.`, [{ classId, day: l.day, slot: l.slot }]);
      break;
    case "R2": // subject NEVER in given slots
      for (const classId of rule.classIds)
        for (const l of lessonsByClass(c.maps, classId))
          if (rule.subjectIds.includes(l.event.subjectId) && rule.slots.includes(l.slot))
            c.add(`${c.sName(l.event.subjectId)} for ${c.cName(classId)} is at ${slotName(c.profile, l.slot)}, where it isn't allowed.`, [{ classId, day: l.day, slot: l.slot }]);
      break;
    case "R3": { // subject in first/second half
      const mid = Math.ceil(c.teach.length / 2);
      const firstHalf = new Set(c.teach.slice(0, mid));
      for (const classId of rule.classIds)
        for (const l of lessonsByClass(c.maps, classId)) {
          if (!rule.subjectIds.includes(l.event.subjectId)) continue;
          const inFirst = firstHalf.has(l.slot);
          if ((rule.half === "first") !== inFirst)
            c.add(`${c.sName(l.event.subjectId)} for ${c.cName(classId)} should be in the ${rule.half} half of the day but is at ${slotName(c.profile, l.slot)}.`, [{ classId, day: l.day, slot: l.slot }]);
        }
      break;
    }
    case "R4": { // class teacher takes the first period daily
      const klass = c.project.classes.find((k) => k.id === rule.classId);
      const ct = klass?.classTeacherId;
      if (!ct) break;
      const p1 = c.teach[0]!;
      const lessons = lessonsByClass(c.maps, rule.classId);
      for (const day of c.profile.days) {
        const at = lessons.find((l) => l.day === day && l.slot === p1);
        const ok = at && at.event.teacherIds.includes(ct) && (!rule.subjectId || at.event.subjectId === rule.subjectId);
        if (!ok) c.add(`${c.cName(rule.classId)} should start ${day} with ${c.tName(ct)} (the class teacher), but doesn't.`, [{ classId: rule.classId, day, slot: p1 }]);
      }
      break;
    }
    case "R5": { // subject at the same period every day
      const lessons = lessonsByClass(c.maps, rule.classId).filter((l) => l.event.subjectId === rule.subjectId);
      for (const l of lessons)
        if (rule.slot != null ? l.slot !== rule.slot : new Set(lessons.map((x) => x.slot)).size > 1)
          c.add(`${c.sName(rule.subjectId)} in ${c.cName(rule.classId)} should be at the same period each day, but ${l.day} has it at ${slotName(c.profile, l.slot)}.`, [{ classId: rule.classId, day: l.day, slot: l.slot }]);
      break;
    }
    case "R6": { // double period N×/week
      const doubles = c.tt.placements.filter((p) => {
        const e = c.maps.eventIndex.get(p.eventId);
        return e && e.subjectId === rule.subjectId && e.classIds.includes(rule.classId) && e.duration === 2;
      }).length;
      if (doubles !== rule.count)
        c.add(`${c.cName(rule.classId)} should have ${rule.count} double period(s) of ${c.sName(rule.subjectId)} a week, but has ${doubles}.`, [{ classId: rule.classId, day: "Mon", slot: c.teach[0]! }]);
      break;
    }
    case "R7": { // block placements share one start slot
      const starts = new Set(c.tt.placements.filter((p) => p.eventId === rule.eventId).map((p) => p.slot));
      if (starts.size > 1)
        c.add(`The ${c.sName(c.maps.eventIndex.get(rule.eventId)?.subjectId ?? "")} block starts at different periods on different days.`, [{ eventId: rule.eventId, day: "Mon", slot: c.teach[0]! }]);
      break;
    }
    case "R8": // teacher not available at given slots
      for (const l of lessonsByTeacher(c.maps, rule.teacherId))
        if (rule.slots.some((s) => s.day === l.day && s.slot === l.slot))
          c.add(`${c.tName(rule.teacherId)} is scheduled at ${l.day} ${slotName(c.profile, l.slot)} but is marked unavailable then.`, [{ teacherId: rule.teacherId, day: l.day, slot: l.slot }]);
      break;
    case "R9": { // board class — core subjects in first three periods
      const earlyThree = new Set(c.teach.slice(0, 3));
      const core = new Set(rule.coreSubjectIds);
      for (const l of lessonsByClass(c.maps, rule.classId)) {
        if (!earlyThree.has(l.slot)) continue;
        const subj = c.project.subjects.find((s) => s.id === l.event.subjectId);
        if (subj?.kind === "academic" && !core.has(l.event.subjectId))
          c.add(`${c.cName(rule.classId)} (board class) has ${c.sName(l.event.subjectId)} at ${slotName(c.profile, l.slot)} — keep the first three periods for core subjects.`, [{ classId: rule.classId, day: l.day, slot: l.slot }]);
      }
      break;
    }
    case "R10": // spread across ≥ minDays
      for (const classId of rule.classIds) {
        const days = new Set(lessonsByClass(c.maps, classId).filter((l) => l.event.subjectId === rule.subjectId).map((l) => l.day));
        if (days.size > 0 && days.size < rule.minDays)
          c.add(`${c.sName(rule.subjectId)} for ${c.cName(classId)} is only on ${days.size} day(s); spread it across at least ${rule.minDays}.`, [{ classId, day: "Mon", slot: c.teach[0]! }]);
      }
      break;
    case "R11": // max per day of subject
      for (const [day, ls] of byDay(lessonsByClass(c.maps, rule.classId))) {
        const n = ls.filter((l) => l.event.subjectId === rule.subjectId).length;
        if (n > rule.maxPerDay)
          c.add(`${c.cName(rule.classId)} has ${n} periods of ${c.sName(rule.subjectId)} on ${day} (max ${rule.maxPerDay}).`, [{ classId: rule.classId, day, slot: c.teach[0]! }]);
      }
      break;
    case "R12": { // teacher caps
      const ls = lessonsByTeacher(c.maps, rule.teacherId);
      if (ls.length > rule.maxPerWeek) c.add(`${c.tName(rule.teacherId)} teaches ${ls.length} periods a week (max ${rule.maxPerWeek}).`, [{ teacherId: rule.teacherId, day: "Mon", slot: c.teach[0]! }]);
      for (const [day, dayLs] of byDay(ls))
        if (dayLs.length > rule.maxPerDay) c.add(`${c.tName(rule.teacherId)} teaches ${dayLs.length} periods on ${day} (max ${rule.maxPerDay}).`, [{ teacherId: rule.teacherId, day, slot: c.teach[0]! }]);
      break;
    }
    case "R13": // compact days (few gaps)
      for (const t of c.project.teachers) {
        if (!t.schedulable) continue;
        for (const [day, ls] of byDay(lessonsByTeacher(c.maps, t.id))) {
          const used = ls.map((l) => c.teach.indexOf(l.slot)).filter((i) => i >= 0).sort((a, b) => a - b);
          if (used.length < 2) continue;
          const gaps = used[used.length - 1]! - used[0]! - (used.length - 1);
          if (gaps > 0) c.add(`${c.tName(t.id)} has ${gaps} free gap(s) between lessons on ${day}.`, [{ teacherId: t.id, day, slot: c.teach[used[0]!]! }]);
        }
      }
      break;
    case "R14": // subject A before subject B on the same day
      for (const [day, ls] of byDay(lessonsByClass(c.maps, rule.classId))) {
        const a = ls.filter((l) => l.event.subjectId === rule.beforeSubjectId).map((l) => l.slot);
        const b = ls.filter((l) => l.event.subjectId === rule.afterSubjectId).map((l) => l.slot);
        if (a.length && b.length && Math.max(...a) > Math.min(...b))
          c.add(`On ${day}, ${c.sName(rule.beforeSubjectId)} should come before ${c.sName(rule.afterSubjectId)} in ${c.cName(rule.classId)}.`, [{ classId: rule.classId, day, slot: Math.min(...b) }]);
      }
      break;
    case "R15": // max consecutive periods
      for (const [day, ls] of byDay(lessonsByTeacher(c.maps, rule.teacherId))) {
        const idx = ls.map((l) => c.teach.indexOf(l.slot)).filter((i) => i >= 0).sort((a, b) => a - b);
        let run = idx.length ? 1 : 0;
        let max = run;
        for (let i = 1; i < idx.length; i++) {
          run = idx[i] === idx[i - 1]! + 1 ? run + 1 : 1;
          max = Math.max(max, run);
        }
        if (max > rule.maxConsecutive)
          c.add(`${c.tName(rule.teacherId)} teaches ${max} periods in a row on ${day} (max ${rule.maxConsecutive}).`, [{ teacherId: rule.teacherId, day, slot: c.teach[idx[0]!]! }]);
      }
      break;
  }
}

