import { localMustForbids } from "../domain/constraints";
import { requirementCoverage } from "../domain/coverage";
import { findProfile } from "../domain/derive";
import { placeNormalLesson } from "../domain/edit";
import { teachingSlots } from "../domain/profile";
import type { Day, Id, Project } from "../domain/types";
import { validate } from "../domain/validate";

export interface SearchUnit {
  classId: Id;
  subjectId: Id;
  ordinal: number;
}

export interface SearchOption {
  unit: SearchUnit;
  teacherId: Id;
  day: Day;
  slot: number;
}

export interface SearchDomain {
  unit: SearchUnit;
  options: SearchOption[];
}

export function outstandingUnits(project: Project, timetableId: Id): SearchUnit[] {
  const timetable = project.timetables.find((t) => t.id === timetableId);
  if (!timetable) return [];
  const units: SearchUnit[] = [];
  for (const row of requirementCoverage(project, timetable)) {
    for (let i = 0; i < row.short; i++) units.push({ classId: row.classId, subjectId: row.subjectId, ordinal: i });
  }
  return units;
}

export function buildSearchDomains(project: Project, timetableId: Id): SearchDomain[] {
  const timetable = project.timetables.find((t) => t.id === timetableId);
  const profile = timetable && findProfile(project, timetable);
  if (!timetable || !profile) return [];
  const units = outstandingUnits(project, timetableId);
  const domains: SearchDomain[] = [];
  for (const unit of units) {
    const options: SearchOption[] = [];
    const teachers = project.qualifications.filter((q) => q.classId === unit.classId && q.subjectId === unit.subjectId).map((q) => q.teacherId);
    for (const day of profile.days) {
      for (const slot of teachingSlots(profile)) {
        for (const teacherId of teachers) {
          if (localMustForbids(project, profile, { classId: unit.classId, subjectId: unit.subjectId, teacherIds: [teacherId], day, slot })) continue;
          const next = placeNormalLesson(project, timetableId, unit.classId, day, slot, unit.subjectId, [teacherId]);
          const tt = next.timetables.find((t) => t.id === timetableId)!;
          if (validate(next, tt).filter((v) => v.severity === "hard").length === 0) options.push({ unit, teacherId, day, slot });
        }
      }
    }
    domains.push({ unit, options });
  }
  domains.sort((a, b) => a.options.length - b.options.length);
  return domains;
}
