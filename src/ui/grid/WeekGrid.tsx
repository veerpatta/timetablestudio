// Read-only week grid for one class (RB1). Columns = the profile's slots (Assembly,
// P1..P4, Recess, P5..P8); rows = the six days. Reads the shared derive() occupancy,
// so ELGA and senior joint classes appear exactly as the single events they are.
// RB2 makes this editable (legal-only picker) and adds the teacher/day views.

import { deriveMaps, slotKey } from "../../domain/derive";
import { findProfile } from "../../domain/derive";
import type { Day, Id, Project, Timetable } from "../../domain/types";

const DAYS: Day[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface Props {
  project: Project;
  timetable: Timetable;
  classId: Id;
}

export function WeekGrid({ project, timetable, classId }: Props): React.ReactElement {
  const profile = findProfile(project, timetable);
  if (!profile) return <p>Unknown profile.</p>;
  const maps = deriveMaps(project, timetable);
  const subjects = new Map(project.subjects.map((s) => [s.id, s.name]));
  const teachers = new Map(project.teachers.map((t) => [t.id, t.name]));
  const byClass = maps.classCells.get(classId);

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr>
          <th className="border bg-slate-100 p-2 text-left">Day</th>
          {profile.slots.map((s) => (
            <th
              key={s.index}
              className={`border p-2 ${s.teaching ? "bg-slate-100" : "bg-slate-200 text-slate-500"}`}
            >
              <div className="font-semibold">{s.label}</div>
              <div className="text-[10px] font-normal text-slate-400">
                {s.start}–{s.end}
              </div>
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
                return (
                  <td key={s.index} className="border bg-slate-50 p-2 text-center text-slate-400">
                    {s.label}
                  </td>
                );
              }
              const occ = byClass?.get(slotKey(day, s.index));
              const event = occ?.[0]?.event;
              if (!event) {
                return <td key={s.index} className="border p-2 text-center text-slate-300">—</td>;
              }
              const who = event.teacherIds.map((t) => teachers.get(t) ?? t).join(", ");
              const tint =
                event.type === "team_block"
                  ? "bg-amber-50"
                  : event.type === "joint_class"
                    ? "bg-violet-50"
                    : event.type === "free" || event.type === "self_study"
                      ? "bg-slate-50"
                      : "";
              return (
                <td key={s.index} className={`border p-2 align-top ${tint}`}>
                  <div className="font-medium text-slate-800">{subjects.get(event.subjectId) ?? event.subjectId}</div>
                  {who && <div className="text-[11px] text-slate-500">{who}</div>}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
