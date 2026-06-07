// Reports & export view (RB7). A whole-school DAY sheet (the third school view, alongside
// class & teacher), teacher workload, and a one-click export of the legacy text file the
// old viewer reads. Print uses the browser's own print (the sheets are plain tables). All
// figures come from domain/reports (projections of derive), so they match the grid.

import { useState } from "react";
import { deriveMaps, findProfile, slotKey } from "../../domain/derive";
import { exportLegacyRawData } from "../../domain/exportLegacy";
import { freeCellCount, workloadReport } from "../../domain/reports";
import type { Day, Id, Project, Timetable } from "../../domain/types";

const DAYS: Day[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function downloadLegacy(project: Project, timetableId: Id): void {
  const text = exportLegacyRawData(project, timetableId);
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${project.school.name.replace(/[^\w]+/g, "_")}_timetable.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

export function ReportsView({ project, timetable, timetableId }: { project: Project; timetable: Timetable; timetableId: Id }): React.ReactElement {
  const profile = findProfile(project, timetable);
  const [day, setDay] = useState<Day>("Mon");
  const maps = deriveMaps(project, timetable);
  const subj = new Map(project.subjects.map((s) => [s.id, s.name]));
  const tea = new Map(project.teachers.map((t) => [t.id, t.name]));
  const teaching = profile ? profile.slots.filter((s) => s.teaching) : [];
  const workload = workloadReport(project, timetable);

  const cell = (classId: Id) => (slot: number) => {
    const ev = maps.classCells.get(classId)?.get(slotKey(day, slot))?.[0]?.event;
    if (!ev) return "";
    const who = ev.teacherIds.map((t) => tea.get(t) ?? t).join(", ");
    return `${subj.get(ev.subjectId) ?? ev.subjectId}${who ? ` · ${who}` : ""}`;
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => downloadLegacy(project, timetableId)} className="rounded bg-slate-800 px-3 py-1 text-sm font-medium text-white hover:bg-slate-700">
          Download timetable file
        </button>
        <button onClick={() => window.print()} className="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50">
          Print
        </button>
        <span className="text-sm text-slate-500">{freeCellCount(project, timetable)} free periods school-wide</span>
      </div>

      <section>
        <div className="mb-2 flex items-center gap-2">
          <h2 className="text-sm font-semibold">Whole-school day</h2>
          <select className="rounded border border-slate-300 px-2 py-1 text-sm" value={day} onChange={(e) => setDay(e.target.value as Day)}>
            {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div className="overflow-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="border bg-slate-100 p-1 text-left">Class</th>
                {teaching.map((s) => <th key={s.index} className="border bg-slate-100 p-1">{s.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {project.classes.map((c) => (
                <tr key={c.id}>
                  <th className="border bg-slate-50 p-1 text-left font-medium">{c.name}</th>
                  {teaching.map((s) => <td key={s.index} className="border p-1 align-top">{cell(c.id)(s.index)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Teacher workload</h2>
        <div className="overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border bg-slate-100 p-2 text-left">Teacher</th>
                <th className="border bg-slate-100 p-2">Periods / week</th>
                <th className="border bg-slate-100 p-2">Free</th>
              </tr>
            </thead>
            <tbody>
              {workload.map((r) => (
                <tr key={r.teacherId}>
                  <th className="border bg-slate-50 p-2 text-left font-medium">{r.name}</th>
                  <td className="border p-2 text-center">{r.periods}</td>
                  <td className="border p-2 text-center text-emerald-700">{r.free}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
