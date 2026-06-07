// Per-student personal timetable (C7, the AC piece). Pick an elective class + a combination
// and see exactly what that student attends — three chosen electives, Self Study for the
// dropped one, and every compulsory lesson — with no non-chosen subject. Pure projection
// (domain/studentView), so it always matches the grid.

import { useState } from "react";
import { findProfile } from "../../domain/derive";
import { studentTimetable } from "../../domain/studentView";
import type { Day, Id, Project, Timetable } from "../../domain/types";

const DAYS: Day[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function PersonalTimetable({ project, timetable }: { project: Project; timetable: Timetable }): React.ReactElement | null {
  const withGroups = project.classes.filter((c) => project.studentGroups.some((g) => g.classId === c.id));
  const [classId, setClassId] = useState<Id>(withGroups[0]?.id ?? "");
  const groups = project.studentGroups.filter((g) => g.classId === classId);
  const [groupId, setGroupId] = useState<Id>(groups[0]?.id ?? "");
  if (withGroups.length === 0) return null; // no electives configured → no personal view

  const activeGroupId = groups.some((g) => g.id === groupId) ? groupId : (groups[0]?.id ?? "");
  const profile = findProfile(project, timetable);
  const teaching = profile ? profile.slots.filter((s) => s.teaching) : [];
  const subj = new Map(project.subjects.map((s) => [s.id, s.name]));
  const tea = new Map(project.teachers.map((t) => [t.id, t.name]));
  const personal = studentTimetable(project, timetable, activeGroupId);

  const onClass = (id: Id) => {
    setClassId(id);
    setGroupId(project.studentGroups.find((g) => g.classId === id)?.id ?? "");
  };
  const cell = (day: Day, slot: number) => {
    const ev = personal.get(`${day}#${slot}`)?.event;
    if (!ev) return null;
    const who = ev.teacherIds.map((t) => tea.get(t) ?? t).join(", ");
    return (
      <>
        <span className="font-medium">{subj.get(ev.subjectId) ?? ev.subjectId}</span>
        {who && <span className="block text-[10px] text-slate-500">{who}</span>}
      </>
    );
  };

  return (
    <section>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold">Student timetable</h2>
        <select aria-label="Class" className="rounded border border-slate-300 px-2 py-1 text-sm" value={classId} onChange={(e) => onClass(e.target.value)}>
          {withGroups.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select aria-label="Combination" className="rounded border border-slate-300 px-2 py-1 text-sm" value={activeGroupId} onChange={(e) => setGroupId(e.target.value)}>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </div>
      <div className="overflow-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="border bg-slate-100 p-1 text-left">Day</th>
              {teaching.map((s) => <th key={s.index} className="border bg-slate-100 p-1">{s.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {DAYS.map((d) => (
              <tr key={d}>
                <th className="border bg-slate-50 p-1 text-left font-medium">{d}</th>
                {teaching.map((s) => <td key={s.index} className="border p-1 align-top">{cell(d, s.index)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
