// Structural feasibility analysis — explains WHY a timetable can't be built,
// in plain language, WITHOUT running the solver. PURE (no DOM/window).
//
// These are necessary-condition checks: if any fires, no valid timetable exists,
// so we can name the bottleneck up front instead of letting the solver fail
// silently. (Passing all checks does not guarantee feasibility — the solver is
// still the final word — but a clean report means "no obvious blocker".)

import type { Id, Project, Timetable } from "../domain/types";

export type BlockerKind = "teacher-week" | "teacher-capacity" | "class-capacity";

export interface Blocker {
  kind: BlockerKind;
  entity: string; // teacher or class name
  message: string; // plain sentence naming the bottleneck
  suggestion: string;
}

export interface FeasibilityReport {
  ok: boolean; // no structural blocker found
  blockers: Blocker[];
}

function activeTimetable(project: Project, timetableId: Id): Timetable | undefined {
  return project.timetables.find((t) => t.id === timetableId);
}

/** Required weekly periods each teacher / class must receive, including blocks.
 * The ONE place this is computed — quota matrix, header hint and pre-flight all
 * read from here so the "planned vs slots" number can never diverge (M14). */
export function demand(project: Project) {
  const teacherWeek = new Map<Id, number>();
  const classWeek = new Map<Id, number>();
  const add = (m: Map<Id, number>, id: Id, n: number) => m.set(id, (m.get(id) ?? 0) + n);

  for (const r of project.requirements.curriculum) {
    add(classWeek, r.classId, r.periodsPerWeek);
    for (const t of r.teacherIds) add(teacherWeek, t, r.periodsPerWeek);
  }
  // Blocks: each occurrence consumes `length` periods for every class and teacher.
  const blockById = new Map(project.activities.filter((a) => a.kind === "block").map((a) => [a.id, a]));
  for (const br of project.requirements.blocks) {
    const block = blockById.get(br.blockActivityId);
    if (!block || block.kind !== "block") continue;
    const periods = block.length * br.occurrences.length;
    for (const c of block.classIds) add(classWeek, c, periods);
    for (const t of block.teacherIds) add(teacherWeek, t, periods);
  }
  return { teacherWeek, classWeek };
}

export interface ClassLoad {
  classId: Id;
  name: string;
  planned: number; // curriculum + block periods a week
  slots: number; // available periods a week
  unplanned: number; // slots − planned, clamped at 0 (free periods)
}

/** Per-class planned vs available periods, from the single `demand()` source. */
export function classLoads(project: Project, timetableId: Id): ClassLoad[] {
  const timetable = activeTimetable(project, timetableId);
  const profile = timetable && project.profiles.find((p) => p.id === timetable.profileId);
  const slots = (profile ? profile.days.length : 6) * (profile ? profile.periods.length : 6);
  const { classWeek } = demand(project);
  return project.classes.map((c) => {
    const planned = classWeek.get(c.id) ?? 0;
    return { classId: c.id, name: c.name, planned, slots, unplanned: Math.max(0, slots - planned) };
  });
}

export function diagnose(project: Project, timetableId: Id): FeasibilityReport {
  const timetable = activeTimetable(project, timetableId);
  const profile = timetable && project.profiles.find((p) => p.id === timetable.profileId);
  const dayCount = profile ? profile.days.length : 6;
  const periodCount = profile ? profile.periods.length : 6;
  const weekSlots = dayCount * periodCount;

  const teacherName = new Map(project.teachers.map((t) => [t.id, t.name] as const));
  const className = new Map(project.classes.map((c) => [c.id, c.name] as const));
  const { teacherWeek, classWeek } = demand(project);
  const blockers: Blocker[] = [];

  for (const t of project.teachers) {
    const need = teacherWeek.get(t.id) ?? 0;
    const name = teacherName.get(t.id) ?? t.id;
    if (need > t.maxPeriodsPerWeek) {
      blockers.push({
        kind: "teacher-week",
        entity: name,
        message: `${name} is needed for ${need} periods a week, but can teach at most ${t.maxPeriodsPerWeek}.`,
        suggestion: `Reduce a class's hours with ${name}, share the subject with another teacher, or raise ${name}'s weekly limit.`,
      });
    }
    const dayCapacity = dayCount * t.maxPeriodsPerDay;
    if (need <= t.maxPeriodsPerWeek && need > dayCapacity) {
      blockers.push({
        kind: "teacher-capacity",
        entity: name,
        message: `${name} is needed for ${need} periods, but only ${dayCapacity} fit across ${dayCount} days (max ${t.maxPeriodsPerDay}/day).`,
        suggestion: `Raise ${name}'s per-day limit, add a teaching day, or move some lessons to another teacher.`,
      });
    }
  }

  for (const c of project.classes) {
    const need = classWeek.get(c.id) ?? 0;
    const name = className.get(c.id) ?? c.id;
    if (need > weekSlots) {
      blockers.push({
        kind: "class-capacity",
        entity: name,
        message: `${name} needs ${need} periods a week, but the timetable only has ${weekSlots} (${dayCount} days × ${periodCount} periods).`,
        suggestion: `Reduce ${name}'s subject hours, or add more periods/days to the schedule.`,
      });
    }
  }

  return { ok: blockers.length === 0, blockers };
}
