// Inline, glanceable health (RB2): a class status dot (gaps in the week) and a
// teacher load bar (periods used vs available, free count). Both read the shared
// deriveMaps occupancy, so they track edits live. Plain words, no codes.

import { deriveMaps, findProfile, slotKey } from "../../domain/derive";
import { teachingSlots } from "../../domain/profile";
import type { Day, Id, Project, Timetable } from "../../domain/types";

const DAYS: Day[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function occupiedCount(map: Map<string, unknown> | undefined, slots: number[]): number {
  let n = 0;
  for (const day of DAYS) for (const slot of slots) if (map?.has(slotKey(day, slot))) n++;
  return n;
}

export function ClassHealth({ project, timetable, classId }: { project: Project; timetable: Timetable; classId: Id }): React.ReactElement | null {
  const profile = findProfile(project, timetable);
  if (!profile) return null;
  const slots = teachingSlots(profile);
  const total = slots.length * DAYS.length;
  const filled = occupiedCount(deriveMaps(project, timetable).classCells.get(classId), slots);
  const gaps = total - filled;
  return (
    <span className="flex items-center gap-1.5 text-sm text-slate-600">
      <span className={`inline-block h-2.5 w-2.5 rounded-full ${gaps === 0 ? "bg-emerald-500" : "bg-amber-500"}`} />
      {gaps === 0 ? "Full week" : `${gaps} empty ${gaps === 1 ? "period" : "periods"}`}
    </span>
  );
}

export function TeacherLoad({ project, timetable, teacherId }: { project: Project; timetable: Timetable; teacherId: Id }): React.ReactElement | null {
  const profile = findProfile(project, timetable);
  const teacher = project.teachers.find((t) => t.id === teacherId);
  if (!profile || !teacher) return null;
  const slots = teachingSlots(profile);
  const blocked = new Set(teacher.unavailable.map((u) => `${u.day}#${u.slot}`));
  let available = 0;
  for (const day of DAYS) for (const slot of slots) if (!blocked.has(`${day}#${slot}`)) available++;
  const used = occupiedCount(deriveMaps(project, timetable).teacherCells.get(teacherId), slots);
  const pct = available === 0 ? 0 : Math.round((used / available) * 100);
  return (
    <div className="flex items-center gap-2 text-sm text-slate-600">
      <div className="h-2.5 w-32 overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full ${pct >= 95 ? "bg-rose-500" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${pct}%` }} />
      </div>
      <span>{used}/{available} periods · {available - used} free</span>
    </div>
  );
}
