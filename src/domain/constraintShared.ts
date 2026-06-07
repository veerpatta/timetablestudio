// Shared helpers for the constraint engine (PURE) — used by the local predicates
// (constraints.ts) and the aggregate evaluators (constraintAggregates.ts). Kept in one
// place so both sides read the timetable the same way (the one-oracle discipline).

import type { DerivedMaps } from "./derive";
import { teachingSlots } from "./profile";
import type { Day, Id, Profile, Project, TimetableEvent, Violation } from "./types";

/** A single placed (or candidate) lesson — the unit a placement-local predicate judges. */
export interface PlacedLesson {
  classId: Id;
  subjectId: Id;
  teacherIds: Id[];
  day: Day;
  slot: number;
}

/** A violation before the orchestrator stamps constraintId + severity. */
export interface PartialViolation {
  message: string;
  slots: Violation["slots"];
}

export interface Names {
  s: (id: Id) => string;
  c: (id: Id) => string;
  t: (id: Id) => string;
}
export function names(project: Project): Names {
  return {
    s: (id) => project.subjects.find((x) => x.id === id)?.name ?? id,
    c: (id) => project.classes.find((x) => x.id === id)?.name ?? id,
    t: (id) => project.teachers.find((x) => x.id === id)?.name ?? id,
  };
}

export const slotName = (profile: Profile, n: number): string =>
  profile.slots.find((s) => s.index === n)?.label ?? `slot ${n}`;

export const firstHalf = (profile: Profile): Set<number> => {
  const teach = teachingSlots(profile);
  return new Set(teach.slice(0, Math.ceil(teach.length / 2)));
};
export const lastTeachingSlot = (profile: Profile): number => {
  const teach = teachingSlots(profile);
  return teach[teach.length - 1]!;
};

export interface Lesson { day: Day; slot: number; event: TimetableEvent; }

export function lessonsByClass(maps: DerivedMaps, classId: Id): Lesson[] {
  const out: Lesson[] = [];
  for (const [key, occ] of maps.classCells.get(classId) ?? []) {
    const [day, slot] = key.split("#");
    if (occ[0]) out.push({ day: day as Day, slot: Number(slot), event: occ[0].event });
  }
  return out;
}
export function lessonsByTeacher(maps: DerivedMaps, teacherId: Id): Lesson[] {
  const out: Lesson[] = [];
  for (const [key, occ] of maps.teacherCells.get(teacherId) ?? []) {
    const [day, slot] = key.split("#");
    if (occ[0]) out.push({ day: day as Day, slot: Number(slot), event: occ[0].event });
  }
  return out;
}
export const byDay = <T extends { day: Day }>(items: T[]): Map<Day, T[]> => {
  const m = new Map<Day, T[]>();
  for (const it of items) (m.get(it.day) ?? m.set(it.day, []).get(it.day)!).push(it);
  return m;
};

/** Longest run of consecutive teaching slots among the given slot indices. */
export function longestRun(slots: number[], teach: number[]): number {
  const idx = slots.map((s) => teach.indexOf(s)).filter((i) => i >= 0).sort((a, b) => a - b);
  let run = idx.length ? 1 : 0;
  let max = run;
  for (let i = 1; i < idx.length; i++) {
    run = idx[i] === idx[i - 1]! + 1 ? run + 1 : 1;
    max = Math.max(max, run);
  }
  return max;
}

/** Context handed to every aggregate evaluator. */
export interface EvalCtx {
  project: Project;
  maps: DerivedMaps;
  profile: Profile;
  teach: number[];
  n: Names;
}
