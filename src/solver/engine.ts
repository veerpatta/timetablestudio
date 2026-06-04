// Auto-complete / generate solver. PURE (no DOM/IndexedDB/window). Deterministic
// per seed: mulberry32 PRNG drives value ordering; MCV variable selection breaks
// ties by index. Blocks are pinned (frozen, H10); only missing requirement-
// periods are variables. canPlace mirrors every hard rule validate() checks, so
// a complete assignment is feasible by construction — but the caller should still
// assert validate()===0 hard (the honest oracle).

import { buildActivityIndex, occupiedPeriods } from "../domain/derive";
import { mulberry32, shuffled } from "./prng";
import { scoreTimetable } from "./score";
import type { SolveOptions, SolveResult } from "./types";
import type {
  CurriculumRequirement,
  Day,
  Id,
  Lesson,
  Placement,
  Project,
  Teacher,
  Timetable,
} from "../domain/types";

const teachersKey = (ids: Id[]): string => [...ids].sort().join("+");
const reqKey = (classId: Id, subjectId: Id, teacherIds: Id[]): string =>
  `${classId}|${subjectId}|${teachersKey(teacherIds)}`;

interface Variable {
  lessonId: Id;
  classId: Id;
  subjectId: Id;
  teacherIds: Id[];
  maxPerDay: number;
}

interface Slot {
  day: Day;
  period: number;
}

class Occupancy {
  classBusy = new Set<string>();
  teacherBusy = new Set<string>();
  teacherDay = new Map<string, number>();
  classSubjectDay = new Map<string, number>();

  // Class and teacher occupancy are counted SEPARATELY: a block occupies each
  // teacher once per period (not once per class), so teacher counts must not be
  // multiplied by class count.
  addClass(classId: Id, subjectId: Id, day: Day, period: number): void {
    this.classBusy.add(`${classId}#${day}#${period}`);
    const k = `${classId}#${subjectId}#${day}`;
    this.classSubjectDay.set(k, (this.classSubjectDay.get(k) ?? 0) + 1);
  }
  removeClass(classId: Id, subjectId: Id, day: Day, period: number): void {
    this.classBusy.delete(`${classId}#${day}#${period}`);
    const k = `${classId}#${subjectId}#${day}`;
    this.classSubjectDay.set(k, (this.classSubjectDay.get(k) ?? 1) - 1);
  }
  addTeacher(teacherId: Id, day: Day, period: number): void {
    this.teacherBusy.add(`${teacherId}#${day}#${period}`);
    this.teacherDay.set(`${teacherId}#${day}`, (this.teacherDay.get(`${teacherId}#${day}`) ?? 0) + 1);
  }
  removeTeacher(teacherId: Id, day: Day, period: number): void {
    this.teacherBusy.delete(`${teacherId}#${day}#${period}`);
    this.teacherDay.set(`${teacherId}#${day}`, (this.teacherDay.get(`${teacherId}#${day}`) ?? 1) - 1);
  }

  /** Place a single lesson (one class, shared teachers) at one slot. */
  addLesson(classId: Id, subjectId: Id, teacherIds: Id[], day: Day, period: number): void {
    this.addClass(classId, subjectId, day, period);
    for (const t of teacherIds) this.addTeacher(t, day, period);
  }
  removeLesson(classId: Id, subjectId: Id, teacherIds: Id[], day: Day, period: number): void {
    this.removeClass(classId, subjectId, day, period);
    for (const t of teacherIds) this.removeTeacher(t, day, period);
  }
}

function buildBaseOccupancy(
  base: Placement[],
  index: Map<Id, Project["activities"][number]>,
): Occupancy {
  const occ = new Occupancy();
  for (const p of base) {
    const a = index.get(p.activityId);
    if (!a) continue;
    const classIds = a.kind === "block" ? a.classIds : [a.classId];
    const subjectId = a.kind === "block" ? a.name : a.subjectId;
    const teacherIds = [...new Set(a.teacherIds)];
    for (const period of occupiedPeriods(a, p.period)) {
      for (const classId of classIds) occ.addClass(classId, subjectId, p.day, period);
      for (const t of teacherIds) occ.addTeacher(t, p.day, period); // once per period
    }
  }
  return occ;
}

export function solve(project: Project, timetableId: Id, options: SolveOptions): SolveResult {
  const start = Date.now();
  const maxMillis = options.maxMillis ?? 4000;
  const maxIterations = options.maxIterations ?? 200_000;
  const rng = mulberry32(options.seed);
  const timetable = project.timetables.find((t) => t.id === timetableId);
  if (!timetable) throw new Error(`Timetable ${timetableId} not found`);
  const profile = project.profiles.find((p) => p.id === timetable.profileId);
  const periodCount = profile ? profile.periods.length : 6;
  const days: Day[] = profile ? profile.days : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const index = buildActivityIndex(project);
  const teacherById = new Map<Id, Teacher>(project.teachers.map((t) => [t.id, t]));
  const unavailable = new Set<string>();
  for (const t of project.teachers) {
    for (const s of t.unavailable) unavailable.add(`${t.id}#${s.day}#${s.period}`);
  }

  // canonical lesson per requirement key
  const lessonByKey = new Map<string, Lesson>();
  for (const a of project.activities) {
    if (a.kind === "lesson") lessonByKey.set(reqKey(a.classId, a.subjectId, a.teacherIds), a);
  }

  // base = kept placements; complete keeps all, generate keeps only pinned
  const base: Placement[] =
    options.mode === "complete"
      ? timetable.placements.slice()
      : timetable.placements.filter((p) => p.pinned);

  // existing lesson count per requirement key (among base)
  const existing = new Map<string, number>();
  for (const p of base) {
    const a = index.get(p.activityId);
    if (a?.kind === "lesson") {
      const k = reqKey(a.classId, a.subjectId, a.teacherIds);
      existing.set(k, (existing.get(k) ?? 0) + 1);
    }
  }

  // variables = missing requirement-periods
  const variables: Variable[] = [];
  for (const req of project.requirements.curriculum) {
    const k = reqKey(req.classId, req.subjectId, req.teacherIds);
    const lesson = lessonByKey.get(k);
    if (!lesson) continue; // requirement without a lesson activity — skip
    const need = req.periodsPerWeek - (existing.get(k) ?? 0);
    for (let i = 0; i < Math.max(0, need); i++) {
      variables.push({
        lessonId: lesson.id,
        classId: req.classId,
        subjectId: req.subjectId,
        teacherIds: [...new Set(req.teacherIds)],
        maxPerDay: req.maxPerDay ?? 2,
      });
    }
  }

  const occ = buildBaseOccupancy(base, index);

  const canPlace = (v: Variable, day: Day, period: number): boolean => {
    // H6: every assigned teacher must be qualified for the subject. Holds for
    // derived requirements, but checked here to keep "feasible by construction".
    if (!v.teacherIds.every((t) => teacherById.get(t)?.subjects.includes(v.subjectId) ?? false))
      return false;
    if (occ.classBusy.has(`${v.classId}#${day}#${period}`)) return false;
    if ((occ.classSubjectDay.get(`${v.classId}#${v.subjectId}#${day}`) ?? 0) >= v.maxPerDay)
      return false;
    for (const t of v.teacherIds) {
      if (occ.teacherBusy.has(`${t}#${day}#${period}`)) return false;
      if (unavailable.has(`${t}#${day}#${period}`)) return false;
      const cap = teacherById.get(t)?.maxPeriodsPerDay ?? 6;
      if ((occ.teacherDay.get(`${t}#${day}`) ?? 0) >= cap) return false;
    }
    return true;
  };

  const legalSlots = (v: Variable): Slot[] => {
    const out: Slot[] = [];
    for (const day of days) {
      for (let period = 1; period <= periodCount; period++) {
        if (canPlace(v, day, period)) out.push({ day, period });
      }
    }
    return out;
  };

  const assigned: Placement[] = [];
  let best: Placement[] = [];
  let iterations = 0;
  let lastProgress = 0;
  let aborted = false;

  const overBudget = (): boolean =>
    Date.now() - start > maxMillis || iterations > maxIterations || (options.shouldCancel?.() ?? false);

  const remaining = variables.map((_, i) => i);

  const search = (rem: number[]): boolean => {
    if (rem.length === 0) return true;
    if (overBudget()) {
      aborted = true;
      return false;
    }
    // MCV: choose remaining variable with fewest legal slots (tie -> lowest index)
    let pickPos = -1;
    let pickSlots: Slot[] = [];
    let pickCount = Infinity;
    for (let i = 0; i < rem.length; i++) {
      const slots = legalSlots(variables[rem[i]!]!);
      if (slots.length < pickCount) {
        pickCount = slots.length;
        pickPos = i;
        pickSlots = slots;
        if (pickCount === 0) break; // dead end now
      }
    }
    if (pickCount === 0) return false;

    const varIndex = rem[pickPos]!;
    const v = variables[varIndex]!;
    const nextRem = rem.slice(0, pickPos).concat(rem.slice(pickPos + 1));

    for (const slot of shuffled(pickSlots, rng)) {
      iterations++;
      occ.addLesson(v.classId, v.subjectId, v.teacherIds, slot.day, slot.period);
      assigned.push({ activityId: v.lessonId, day: slot.day, period: slot.period, pinned: false });
      if (assigned.length > best.length) best = assigned.slice();
      if (options.onProgress && iterations - lastProgress >= 256) {
        lastProgress = iterations;
        options.onProgress({ iteration: iterations, bestScore: 0, hardViolations: 0 });
      }
      if (search(nextRem)) return true;
      assigned.pop();
      occ.removeLesson(v.classId, v.subjectId, v.teacherIds, slot.day, slot.period);
      if (aborted) return false;
    }
    return false;
  };

  const solved = search(remaining);
  const chosen = solved ? assigned : best;
  const placements = [...base, ...chosen];
  const finalTimetable: Timetable = { ...timetable, placements };
  const breakdown = scoreTimetable(project, finalTimetable);

  return {
    placements,
    score: breakdown.score,
    violations: breakdown.violations,
    seed: options.seed,
    feasible: breakdown.hard === 0,
    iterations,
    millis: Date.now() - start,
    complete: solved,
  };
}

// Exposed for tests that want to assert against requirements directly.
export type { CurriculumRequirement };
