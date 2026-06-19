// Read-only teacher week (RB2 second view). Same deriveMaps occupancy as the class
// view, so a class edit shows up here instantly — and a joint/team event appears as
// ONE cell listing all the classes it covers (e.g. Pradhyuman → all three streams).

import { deriveMaps, findProfile, slotKey } from "../../domain/derive";
import type { Day, Id, Project, Timetable } from "../../domain/types";

const DAYS: Day[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface Props {
  project: Project;
  timetable: Timetable;
  teacherId: Id;
  selected?: { classId: Id; day: Day; slot: number } | null;
  onSelectCell?: (classId: Id, day: Day, slot: number) => void;
}

export function TeacherGrid({ project, timetable, teacherId, selected, onSelectCell }: Props): React.ReactElement {
  const profile = findProfile(project, timetable);
  if (!profile) return <p>Unknown profile.</p>;
  const maps = deriveMaps(project, timetable);
  const subjects = new Map(project.subjects.map((s) => [s.id, s.name]));
  const classNames = new Map(project.classes.map((c) => [c.id, c.name]));
  const teacher = project.teachers.find((t) => t.id === teacherId);
  const byTeacher = maps.teacherCells.get(teacherId);
  const unavailable = new Set((teacher?.unavailable ?? []).map((u) => `${u.day}#${u.slot}`));

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr>
          <th className="border bg-slate-100 p-2 text-left">Day</th>
          {profile.slots.map((s) => (
            <th key={s.index} className={`border p-2 ${s.teaching ? "bg-slate-100" : "bg-slate-200 text-slate-500"}`}>
              {s.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {DAYS.map((day) => (
          <tr key={day}>
            <th className="border bg-slate-100 p-2 text-left">{day}</th>
            {profile.slots.map((s) => {
              if (!s.teaching) {
                return <td key={s.index} className="border bg-slate-50 p-2 text-center text-slate-400">{s.label}</td>;
              }
              const event = byTeacher?.get(slotKey(day, s.index))?.[0]?.event;
              if (!event) {
                const blocked = unavailable.has(`${day}#${s.index}`);
                return (
                  <td key={s.index} className={`border p-2 text-center text-xs ${blocked ? "bg-slate-100 text-slate-400" : "text-emerald-600"}`}>
                    {blocked ? "—" : "free"}
                  </td>
                );
              }
              const where = event.classIds.map((c) => classNames.get(c) ?? c).join(", ");
              const firstClass = event.classIds[0]!;
              const isSel = selected?.classId === firstClass && selected.day === day && selected.slot === s.index;
              const interactive = onSelectCell ? "cursor-pointer hover:bg-sky-50" : "";
              const ring = isSel ? "ring-2 ring-inset ring-sky-500" : "";
              const cellLabel = `${teacher?.name ?? teacherId} ${day} ${s.label}`;
              return (
                <td
                  key={s.index}
                  role={onSelectCell ? "button" : undefined}
                  tabIndex={onSelectCell ? 0 : undefined}
                  aria-label={onSelectCell ? cellLabel : undefined}
                  onClick={onSelectCell ? () => onSelectCell(firstClass, day, s.index) : undefined}
                  onKeyDown={(e) => {
                    if (!onSelectCell) return;
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelectCell(firstClass, day, s.index);
                    }
                  }}
                  className={`border p-2 align-top ${interactive} ${ring}`}
                >
                  <div className="font-medium text-slate-800">{subjects.get(event.subjectId) ?? event.subjectId}</div>
                  <div className="text-[11px] text-slate-500">{where}</div>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
