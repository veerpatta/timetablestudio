// Pure view-model for a single class's or single teacher's WEEK (rows = periods,
// columns = days). No React. A block (e.g. ELGA) renders as one vertical band
// spanning its periods within a day column. Unit-testable in Node.

import { buildActivityIndex, occupiedPeriods } from "../../domain/derive";
import type { Day, Id, Project, Timetable, Violation } from "../../domain/types";

export interface WeekCell {
  day: Day;
  period: number;
  label: string;
  isBlock: boolean;
  rowSpan?: number; // band origin spans this many period-rows in its day column
  covered?: boolean; // covered by a band origin above — renderer skips it
  severity?: "hard" | "soft";
}

export interface WeekView {
  scopeLabel: string;
  days: Day[];
  periodCount: number;
  rows: { period: number; cells: WeekCell[] }[];
}

export type WeekScope = { kind: "class" | "teacher"; id: Id };

export function buildWeekView(
  project: Project,
  timetable: Timetable,
  scope: WeekScope,
  violations: Violation[] = [],
): WeekView {
  const profile = project.profiles.find((p) => p.id === timetable.profileId);
  const days: Day[] = profile ? profile.days : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const periodCount = profile ? profile.periods.length : 6;
  const index = buildActivityIndex(project);
  const teacher = new Map(project.teachers.map((t) => [t.id, t.name] as const));
  const subject = new Map(project.subjects.map((s) => [s.id, s.name] as const));
  const className = new Map(project.classes.map((c) => [c.id, c.name] as const));

  const scopeLabel =
    scope.kind === "class"
      ? className.get(scope.id) ?? scope.id
      : teacher.get(scope.id) ?? scope.id;

  // conflict overlay for this scope
  const overlay = new Map<string, "hard" | "soft">();
  const slotKey = scope.kind === "class" ? "classId" : "teacherId";
  for (const v of violations) {
    for (const s of v.slots) {
      if (s[slotKey] !== scope.id || s.period < 1) continue;
      const key = `${s.day}#${s.period}`;
      if (v.severity === "hard" || !overlay.has(key)) overlay.set(key, v.severity);
    }
  }

  const cell = new Map<string, WeekCell>();
  for (const placement of timetable.placements) {
    const a = index.get(placement.activityId);
    if (!a) continue;
    const involves =
      scope.kind === "class"
        ? a.kind === "block"
          ? a.classIds.includes(scope.id)
          : a.classId === scope.id
        : a.teacherIds.includes(scope.id);
    if (!involves) continue;
    const periods = occupiedPeriods(a, placement.period);
    const label =
      a.kind === "block"
        ? a.name
        : scope.kind === "class"
          ? `${subject.get(a.subjectId) ?? a.subjectId} · ${a.teacherIds.map((id) => teacher.get(id) ?? id).join(" / ")}`
          : `${subject.get(a.subjectId) ?? a.subjectId} · ${className.get(a.classId) ?? a.classId}`;
    for (const period of periods) {
      cell.set(`${placement.day}#${period}`, {
        day: placement.day,
        period,
        label,
        isBlock: a.kind === "block",
        severity: overlay.get(`${placement.day}#${period}`),
      });
    }
    if (a.kind === "block" && periods.length > 1) {
      const origin = cell.get(`${placement.day}#${periods[0]!}`)!;
      origin.rowSpan = periods.length;
      for (const period of periods.slice(1)) {
        const c = cell.get(`${placement.day}#${period}`);
        if (c) c.covered = true;
      }
    }
  }

  const rows = Array.from({ length: periodCount }, (_, i) => {
    const period = i + 1;
    return {
      period,
      cells: days.map(
        (day) =>
          cell.get(`${day}#${period}`) ?? {
            day,
            period,
            label: "",
            isBlock: false,
            severity: overlay.get(`${day}#${period}`),
          },
      ),
    };
  });

  return { scopeLabel, days, periodCount, rows };
}
