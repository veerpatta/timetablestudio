// Operational tools view (RB8): substitution planner + named versions. Both reuse the
// pure cores (substitute, diffTimetables) and the undoable store path — nothing silent.

import { useState } from "react";
import { slotLabel } from "../../domain/profile";
import { absentTeacherPlan } from "../../domain/substitute";
import { diffProjects } from "../../domain/diffTimetables";
import { findProfile } from "../../domain/derive";
import { useProjectStore } from "../../store/projectStore";
import type { Project, Timetable } from "../../domain/types";

export function ToolsView({ project, timetable }: { project: Project; timetable: Timetable }): React.ReactElement {
  const { place, saveVersion, restoreVersion, deleteVersion, versions } = useProjectStore();
  const profile = findProfile(project, timetable);
  const schedulable = project.teachers.filter((t) => t.schedulable);
  const [teacherId, setTeacherId] = useState(schedulable[0]?.id ?? "");
  const [versionName, setVersionName] = useState("");
  const tName = (id: string) => project.teachers.find((t) => t.id === id)?.name ?? id;
  const cName = (id: string) => project.classes.find((c) => c.id === id)?.name ?? id;
  const sName = (id: string) => project.subjects.find((s) => s.id === id)?.name ?? id;
  const sl = (n: number) => (profile ? slotLabel(profile, n) : `${n}`);

  const plan = teacherId ? absentTeacherPlan(project, timetable, teacherId) : [];

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section>
        <h2 className="mb-2 text-sm font-semibold">If a teacher is away</h2>
        <select className="mb-3 rounded border border-slate-300 px-2 py-1 text-sm" value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
          {schedulable.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        {plan.length === 0 ? (
          <p className="text-sm text-slate-500">{tName(teacherId)} has no lessons to cover.</p>
        ) : (
          <ul className="space-y-2">
            {plan.map((r) => (
              <li key={`${r.day}#${r.slot}`} className="rounded border border-slate-200 p-2 text-sm">
                <div className="font-medium">
                  {r.day} {sl(r.slot)} · {sName(r.subjectId)} <span className="text-slate-500">({r.classIds.map(cName).join(", ")})</span>
                </div>
                {r.isBlock ? (
                  <p className="text-xs text-amber-700">Team block — arrange a cover by hand.</p>
                ) : r.covers.length === 0 ? (
                  <p className="text-xs text-rose-600">No free, qualified cover available.</p>
                ) : (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {r.covers.map((cid) => (
                      <button
                        key={cid}
                        disabled={r.classIds.length !== 1}
                        title={r.classIds.length === 1 ? `Assign ${tName(cid)}` : "Combined class — reassign by hand"}
                        onClick={() => place(r.classIds[0]!, r.day, r.slot, r.subjectId, [cid])}
                        className="rounded bg-emerald-600 px-2 py-0.5 text-xs text-white hover:bg-emerald-700 disabled:opacity-40"
                      >
                        {tName(cid)}
                      </button>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Saved versions</h2>
        <div className="mb-3 flex gap-2">
          <input
            value={versionName}
            onChange={(e) => setVersionName(e.target.value)}
            placeholder="Name this version"
            className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
          />
          <button
            onClick={() => { if (versionName.trim()) { saveVersion(versionName.trim()); setVersionName(""); } }}
            className="rounded bg-slate-800 px-3 py-1 text-sm font-medium text-white hover:bg-slate-700"
          >
            Save current
          </button>
        </div>
        {versions.length === 0 ? (
          <p className="text-sm text-slate-500">No saved versions yet.</p>
        ) : (
          <ul className="space-y-1">
            {versions.map((v) => {
              const changes = diffProjects(v.project, project).length;
              return (
                <li key={v.id} className="flex items-center justify-between gap-2 rounded border border-slate-200 px-3 py-2 text-sm">
                  <span>
                    {v.name}{" "}
                    <span className="text-xs text-slate-500">{changes === 0 ? "(matches now)" : `(${changes} cell${changes === 1 ? "" : "s"} differ)`}</span>
                  </span>
                  <span className="flex gap-2">
                    <button onClick={() => restoreVersion(v.id)} className="rounded border border-slate-300 px-2 py-0.5 text-xs hover:bg-slate-50">Restore</button>
                    <button onClick={() => deleteVersion(v.id)} className="text-xs text-rose-600 hover:underline">Delete</button>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
