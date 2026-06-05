// Diff two timetables (same project) by class cell. PURE. Used by candidate
// compare to show "what changes" between an option and the current timetable.

import { buildActivityIndex, occupiedPeriods } from "./derive";
import type { Day, Id, Placement, Project } from "./types";

export interface CellChange {
  classId: Id;
  className: string;
  day: Day;
  period: number;
  before: string; // "" = was empty
  after: string; // "" = becomes empty
}

function classCellLabels(project: Project, placements: Placement[]): Map<string, string> {
  const index = buildActivityIndex(project);
  const subjectName = new Map(project.subjects.map((s) => [s.id, s.name] as const));
  const teacherName = new Map(project.teachers.map((t) => [t.id, t.name] as const));
  const out = new Map<string, string>();
  for (const p of placements) {
    const a = index.get(p.activityId);
    if (!a) continue;
    const classIds = a.kind === "block" ? a.classIds : [a.classId];
    const label =
      a.kind === "block"
        ? a.name
        : `${subjectName.get(a.subjectId) ?? a.subjectId} (${a.teacherIds.map((id) => teacherName.get(id) ?? id).join(" / ")})`;
    for (const classId of classIds) {
      for (const period of occupiedPeriods(a, p.period)) {
        out.set(`${classId}#${p.day}#${period}`, label);
      }
    }
  }
  return out;
}

/** Cells whose class occupancy differs between `before` and `after`. */
export function diffTimetables(
  project: Project,
  before: Placement[],
  after: Placement[],
): CellChange[] {
  const className = new Map(project.classes.map((c) => [c.id, c.name] as const));
  const a = classCellLabels(project, before);
  const b = classCellLabels(project, after);
  const keys = new Set([...a.keys(), ...b.keys()]);
  const changes: CellChange[] = [];
  for (const key of keys) {
    const before1 = a.get(key) ?? "";
    const after1 = b.get(key) ?? "";
    if (before1 === after1) continue;
    // key is `${classId}#${day}#${period}` — classId/day contain no "#".
    const parts = key.split("#");
    const cid = parts[0]!;
    changes.push({
      classId: cid,
      className: className.get(cid) ?? cid,
      day: parts[1] as Day,
      period: Number(parts[2]),
      before: before1,
      after: after1,
    });
  }
  changes.sort(
    (x, y) => x.className.localeCompare(y.className) || x.day.localeCompare(y.day) || x.period - y.period,
  );
  return changes;
}
