// Export a timetable to the legacy viewer's rawData text. PURE.
// Contract & rules: docs/DATA_MODEL.md § Legacy export.

import { deriveMaps } from "./derive";
import { DAY_TO_LONG, FREE, formatCell } from "./legacyFormat";
import type { Day, Id, Project } from "./types";

export function exportLegacyRawData(project: Project, timetableId: Id): string {
  const timetable = project.timetables.find((t) => t.id === timetableId);
  if (!timetable) throw new Error(`Timetable ${timetableId} not found`);
  const profile = project.profiles.find((p) => p.id === timetable.profileId);
  if (!profile) throw new Error(`Profile ${timetable.profileId} not found`);

  const teacherName = new Map<Id, string>();
  for (const t of project.teachers) teacherName.set(t.id, t.name);
  const subjectName = new Map<Id, string>();
  for (const s of project.subjects) subjectName.set(s.id, s.name);

  const maps = deriveMaps(project, timetable);
  const periodCount = profile.periods.length;

  const cellLabel = (classId: Id, day: Day, period: number): string => {
    const occ = maps.classCells.get(classId)?.get(`${day}#${period}`);
    if (!occ || occ.length === 0) return FREE;
    const activity = occ[0]!.activity;
    if (activity.kind === "block") {
      return formatCell(
        activity.name,
        activity.teacherIds.map((id) => teacherName.get(id) ?? id),
      );
    }
    return formatCell(
      subjectName.get(activity.subjectId) ?? activity.subjectId,
      activity.teacherIds.map((id) => teacherName.get(id) ?? id),
    );
  };

  const periodHeaders = Array.from({ length: periodCount }, (_, i) => `Period ${i + 1}`);
  const lines: string[] = [];

  for (const day of profile.days) {
    lines.push(DAY_TO_LONG[day]);
    lines.push(["Class", ...periodHeaders].join(","));
    for (const cls of project.classes) {
      const cells = Array.from({ length: periodCount }, (_, i) =>
        cellLabel(cls.id, day, i + 1),
      );
      lines.push([cls.name, ...cells].join(","));
    }
  }

  return lines.join("\n");
}
