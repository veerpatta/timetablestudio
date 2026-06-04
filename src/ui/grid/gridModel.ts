// Pure view-model for the timetable grid. No React. Builds rows × period cells
// for either the class view or the teacher view of a single day, plus the
// per-cell conflict overlay derived from Violation[]. Unit-testable in Node.

import { buildActivityIndex, occupiedPeriods } from "../../domain/derive";
import type { PlacementRef } from "../../domain/edit";
import type {
  Day,
  Id,
  Project,
  Timetable,
  Violation,
} from "../../domain/types";

export interface GridCell {
  period: number;
  label: string; // "" for an empty (Free) cell
  ref?: PlacementRef; // present iff a placement occupies this cell
  pinned: boolean;
  isBlock: boolean;
  severity?: "hard" | "soft"; // worst conflict touching this cell
}

export interface GridRow {
  id: Id;
  label: string;
  cells: GridCell[]; // length = periodCount
}

function periodCount(project: Project, timetable: Timetable): number {
  const profile = project.profiles.find((p) => p.id === timetable.profileId);
  return profile ? profile.periods.length : 6;
}

function nameMaps(project: Project) {
  const teacher = new Map(project.teachers.map((t) => [t.id, t.name] as const));
  const subject = new Map(project.subjects.map((s) => [s.id, s.name] as const));
  const className = new Map(project.classes.map((c) => [c.id, c.name] as const));
  return { teacher, subject, className };
}

/** Worst severity per `${rowId}#${period}` for the given day. */
function conflictOverlay(
  violations: Violation[],
  day: Day,
  rowKey: "classId" | "teacherId",
): Map<string, "hard" | "soft"> {
  const overlay = new Map<string, "hard" | "soft">();
  for (const v of violations) {
    for (const s of v.slots) {
      if (s.day !== day || s.period < 1) continue;
      const id = s[rowKey];
      if (!id) continue;
      const key = `${id}#${s.period}`;
      if (v.severity === "hard" || !overlay.has(key)) overlay.set(key, v.severity);
    }
  }
  return overlay;
}

function emptyCells(count: number): GridCell[] {
  return Array.from({ length: count }, (_, i) => ({
    period: i + 1,
    label: "",
    pinned: false,
    isBlock: false,
  }));
}

export function buildClassRows(
  project: Project,
  timetable: Timetable,
  day: Day,
  violations: Violation[],
): GridRow[] {
  const count = periodCount(project, timetable);
  const index = buildActivityIndex(project);
  const names = nameMaps(project);
  const overlay = conflictOverlay(violations, day, "classId");
  const byKey = new Map<string, GridCell>();

  for (const placement of timetable.placements) {
    if (placement.day !== day) continue;
    const activity = index.get(placement.activityId);
    if (!activity) continue;
    const classIds = activity.kind === "block" ? activity.classIds : [activity.classId];
    const teacherLabel = activity.teacherIds
      .map((id) => names.teacher.get(id) ?? id)
      .join(" / ");
    const subjectLabel =
      activity.kind === "block" ? activity.name : names.subject.get(activity.subjectId) ?? activity.subjectId;
    const ref: PlacementRef = {
      activityId: activity.id,
      day: placement.day,
      period: placement.period, // block: START period
    };
    for (const classId of classIds) {
      for (const period of occupiedPeriods(activity, placement.period)) {
        byKey.set(`${classId}#${period}`, {
          period,
          label: teacherLabel ? `${subjectLabel} (${teacherLabel})` : subjectLabel,
          ref,
          pinned: placement.pinned,
          isBlock: activity.kind === "block",
          severity: overlay.get(`${classId}#${period}`),
        });
      }
    }
  }

  return project.classes.map((c) => ({
    id: c.id,
    label: c.name,
    cells: emptyCells(count).map(
      (empty, i) => byKey.get(`${c.id}#${i + 1}`) ?? { ...empty, severity: overlay.get(`${c.id}#${i + 1}`) },
    ),
  }));
}

export function buildTeacherRows(
  project: Project,
  timetable: Timetable,
  day: Day,
  violations: Violation[],
): GridRow[] {
  const count = periodCount(project, timetable);
  const index = buildActivityIndex(project);
  const names = nameMaps(project);
  const overlay = conflictOverlay(violations, day, "teacherId");
  const byKey = new Map<string, GridCell>();

  for (const placement of timetable.placements) {
    if (placement.day !== day) continue;
    const activity = index.get(placement.activityId);
    if (!activity) continue;
    const classLabel =
      activity.kind === "block"
        ? activity.name
        : names.className.get(activity.classId) ?? activity.classId;
    const subjectLabel =
      activity.kind === "block" ? activity.name : names.subject.get(activity.subjectId) ?? activity.subjectId;
    const ref: PlacementRef = {
      activityId: activity.id,
      day: placement.day,
      period: placement.period,
    };
    for (const teacherId of activity.teacherIds) {
      for (const period of occupiedPeriods(activity, placement.period)) {
        byKey.set(`${teacherId}#${period}`, {
          period,
          label: activity.kind === "block" ? activity.name : `${subjectLabel} · ${classLabel}`,
          ref,
          pinned: placement.pinned,
          isBlock: activity.kind === "block",
          severity: overlay.get(`${teacherId}#${period}`),
        });
      }
    }
  }

  return project.teachers.map((t) => ({
    id: t.id,
    label: t.name,
    cells: emptyCells(count).map(
      (empty, i) => byKey.get(`${t.id}#${i + 1}`) ?? { ...empty, severity: overlay.get(`${t.id}#${i + 1}`) },
    ),
  }));
}
