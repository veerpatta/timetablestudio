import { totalShortfall } from "../domain/coverage";
import { findProfile } from "../domain/derive";
import { occupiedSlots, teachingSlots } from "../domain/profile";
import type { Constraint, Id, Project, Timetable } from "../domain/types";
import { validate } from "../domain/validate";
import type { FeasibilityReport } from "./types";

const names = <T extends { id: Id; name: string }>(items: T[]) => new Map(items.map((x) => [x.id, x.name]));

function activeTable(project: Project, timetableId: Id): Timetable | undefined {
  return project.timetables.find((t) => t.id === timetableId);
}

function pushUnique(list: string[], message: string): void {
  if (!list.includes(message)) list.push(message);
}

function teacherMaxMusts(project: Project): Extract<Constraint, { template: "teacher_max_per_week" }>[] {
  return project.constraints.filter((c): c is Extract<Constraint, { template: "teacher_max_per_week" }> => c.enabled && c.severity === "must" && c.template === "teacher_max_per_week");
}

export function analyzeFeasibility(project: Project, timetableId: Id): FeasibilityReport {
  const timetable = activeTable(project, timetableId);
  const profile = timetable && findProfile(project, timetable);
  const blockers: string[] = [];
  const relaxationSuggestions: string[] = [];
  if (!timetable || !profile) {
    return {
      status: "blocked",
      blockers: ["The active timetable is missing its school-day setup."],
      relaxationSuggestions: ["Open Setup and check the school day before generating."],
    };
  }

  const className = names(project.classes);
  const subjectName = names(project.subjects);
  const teacherName = names(project.teachers);
  const qualifiedByClassSubject = new Map<string, Id[]>();
  for (const q of project.qualifications) {
    const key = `${q.classId}#${q.subjectId}`;
    const list = qualifiedByClassSubject.get(key) ?? [];
    list.push(q.teacherId);
    qualifiedByClassSubject.set(key, list);
  }

  const classDemand = new Map<Id, number>();
  for (const req of project.requirements) {
    classDemand.set(req.classId, (classDemand.get(req.classId) ?? 0) + req.periodsPerWeek);
    const qualified = qualifiedByClassSubject.get(`${req.classId}#${req.subjectId}`) ?? [];
    if (req.periodsPerWeek > 0 && qualified.length === 0) {
      pushUnique(
        blockers,
        `No available teacher is qualified to teach ${subjectName.get(req.subjectId) ?? req.subjectId} to ${className.get(req.classId) ?? req.classId}.`,
      );
      pushUnique(relaxationSuggestions, `Assign a teacher for ${subjectName.get(req.subjectId) ?? req.subjectId}, or reduce that weekly requirement.`);
    }
  }

  const capacityPerClass = profile.days.length * teachingSlots(profile).length;
  for (const [classId, demand] of classDemand) {
    if (demand > capacityPerClass) {
      pushUnique(
        blockers,
        `${className.get(classId) ?? classId} needs ${demand} teaching periods, but only ${capacityPerClass} teaching slots exist in the week.`,
      );
      pushUnique(relaxationSuggestions, `Reduce weekly subject periods for ${className.get(classId) ?? classId}, or add teaching periods to the school day.`);
    }
  }

  for (const cap of teacherMaxMusts(project)) {
    const teacherId = cap.params.teacherId;
    let forcedDemand = 0;
    for (const req of project.requirements) {
      const qualified = qualifiedByClassSubject.get(`${req.classId}#${req.subjectId}`) ?? [];
      if (qualified.length === 1 && qualified[0] === teacherId) forcedDemand += req.periodsPerWeek;
    }
    if (forcedDemand > cap.params.max) {
      pushUnique(
        blockers,
        `${teacherName.get(teacherId) ?? teacherId} is the only qualified teacher for ${forcedDemand} required periods, but the limit is ${cap.params.max}.`,
      );
      pushUnique(relaxationSuggestions, `Raise ${teacherName.get(teacherId) ?? teacherId}'s weekly limit, reduce demand, or qualify another teacher.`);
    }
  }

  const pinnedIds = new Set(timetable.placements.filter((p) => p.pinned).map((p) => p.eventId));
  const eventIndex = new Map(project.events.map((e) => [e.id, e]));
  const pinnedCells = new Set<string>();
  for (const placement of timetable.placements.filter((p) => p.pinned)) {
    const event = eventIndex.get(placement.eventId);
    const slots = event ? occupiedSlots(profile, placement.slot, event.duration) : null;
    if (!event || !slots) continue;
    for (const slot of slots) for (const classId of event.classIds) pinnedCells.add(`${classId}#${placement.day}#${slot}`);
  }
  const hard = validate(project, timetable).filter((v) => v.severity === "hard");
  for (const v of hard) {
    if (v.slots.some((s) => (s.eventId && pinnedIds.has(s.eventId)) || (s.classId && pinnedCells.has(`${s.classId}#${s.day}#${s.slot}`)))) {
      pushUnique(blockers, `A locked lesson blocks a strict rule: ${v.message}`);
      pushUnique(relaxationSuggestions, "Unlock the lesson or relax the strict rule, then run Make timetable again.");
    }
  }

  if (blockers.length > 0) return { status: "blocked", blockers, relaxationSuggestions };
  if (totalShortfall(project, timetable) > 0 || hard.length > 0) return { status: "ready", blockers: [], relaxationSuggestions: [] };
  return { status: "ready", blockers: [], relaxationSuggestions: [] };
}
