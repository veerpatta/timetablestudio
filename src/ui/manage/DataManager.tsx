import { useState } from "react";
import { useProjectStore } from "../../store/projectStore";
import { quotaStatus } from "../../domain/validate";
import {
  addClass,
  removeClass,
  addTeacher,
  setTeacher,
  removeTeacher,
  addQuota,
  removeQuota,
  setSchoolName,
} from "../../domain/projectEdit";
import type { Day, Project, SchoolClass } from "../../domain/types";

const TABS = ["School", "Classes", "Teachers", "Subjects & Quotas"] as const;
type Tab = (typeof TABS)[number];

function inferGroup(name: string): SchoolClass["group"] {
  const n = Number(name.match(/(\d+)/)?.[1] ?? NaN);
  if (n >= 1 && n <= 5) return "primary";
  if (n >= 11) return "senior";
  return "middle";
}

export function DataManager({ onClose }: { onClose: () => void }) {
  const project = useProjectStore((s) => s.project);
  const setProject = useProjectStore((s) => s.setProject);
  const [tab, setTab] = useState<Tab>("Classes");
  const [newClass, setNewClass] = useState("");
  const [newTeacher, setNewTeacher] = useState("");
  const [q, setQ] = useState({ classId: "", subjectId: "", teacher: "", periodsPerWeek: 5 });

  if (!project) return null;
  const apply = (p: Project) => setProject(p);
  const days: Day[] =
    project.profiles.find((p) => p.id === project.timetables.find((t) => t.id === project.activeTimetableId)?.profileId)?.days ?? [];

  return (
    <div className="modal-overlay fixed inset-0 z-20 flex items-start justify-center overflow-auto bg-black/40 p-4 sm:p-6">
      <div className="modal-card w-full max-w-3xl rounded-lg bg-white shadow-xl">
        <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="font-semibold">Manage school data</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-600">✕</button>
        </header>

        <nav className="flex gap-1 border-b border-slate-200 px-4 py-2 text-sm">
          {TABS.map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)} className={`rounded px-3 py-1 ${tab === t ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}>{t}</button>
          ))}
        </nav>

        <div className="max-h-[60vh] overflow-auto p-4 text-sm">
          {tab === "School" && (
            <label className="block">
              <span className="text-slate-600">School name</span>
              <input value={project.school.name} onChange={(e) => apply(setSchoolName(project, e.target.value))} className="mt-1 w-full rounded border border-slate-300 px-2 py-1" />
              <span className="mt-2 block text-xs text-slate-400">Days: {days.join(", ")} · {(project.profiles[0]?.periods.length ?? 0)} periods/day</span>
            </label>
          )}

          {tab === "Classes" && (
            <div className="space-y-2">
              <ul className="divide-y divide-slate-100">
                {project.classes.map((c) => (
                  <li key={c.id} className="flex items-center justify-between py-1">
                    <span>{c.name} <span className="text-xs text-slate-400">({c.group})</span></span>
                    <button type="button" onClick={() => apply(removeClass(project, c.id))} className="text-slate-400 hover:text-hard" aria-label={`Remove ${c.name}`}>✕</button>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2 pt-2">
                <input value={newClass} onChange={(e) => setNewClass(e.target.value)} placeholder="New class name" className="flex-1 rounded border border-slate-300 px-2 py-1" />
                <button type="button" onClick={() => { if (newClass.trim()) { apply(addClass(project, newClass.trim(), inferGroup(newClass))); setNewClass(""); } }} className="rounded bg-indigo-600 px-3 py-1 text-white">Add</button>
              </div>
            </div>
          )}

          {tab === "Teachers" && (
            <div className="space-y-2">
              <ul className="divide-y divide-slate-100">
                {project.teachers.map((t) => (
                  <li key={t.id} className="flex items-center gap-2 py-1">
                    <span className="w-24 shrink-0">{t.name}</span>
                    <input value={t.subjects.join(", ")} onChange={(e) => apply(setTeacher(project, t.id, { subjects: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) }))} className="flex-1 rounded border border-slate-300 px-2 py-1 text-xs" />
                    <button type="button" onClick={() => apply(removeTeacher(project, t.id))} className="text-slate-400 hover:text-hard" aria-label={`Remove ${t.name}`}>✕</button>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2 pt-2">
                <input value={newTeacher} onChange={(e) => setNewTeacher(e.target.value)} placeholder="New teacher name" className="flex-1 rounded border border-slate-300 px-2 py-1" />
                <button type="button" onClick={() => { if (newTeacher.trim()) { apply(addTeacher(project, newTeacher.trim())); setNewTeacher(""); } }} className="rounded bg-indigo-600 px-3 py-1 text-white">Add</button>
              </div>
            </div>
          )}

          {tab === "Subjects & Quotas" && (
            <div className="space-y-2">
              <table className="w-full text-xs">
                <thead><tr className="text-slate-500"><th className="px-1 py-1 text-left">Class</th><th className="text-left">Subject</th><th className="text-left">Teacher</th><th className="text-right">Per week</th><th /></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {quotaStatus(project, project.timetables.find((t) => t.id === project.activeTimetableId)!).map((s) => {
                    const r = project.requirements.curriculum.find((x) => x.id === s.requirementId)!;
                    return (
                      <tr key={s.requirementId}>
                        <td className="px-1 py-1">{s.classId}</td>
                        <td>{s.subjectId}</td>
                        <td>{r.teacherIds.join(", ")}</td>
                        <td className="text-right">{s.placed}/{s.required}</td>
                        <td className="text-right"><button type="button" onClick={() => apply(removeQuota(project, s.requirementId))} className="text-slate-400 hover:text-hard" aria-label="Remove quota">✕</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="flex flex-wrap items-end gap-2 border-t border-slate-100 pt-2">
                <select value={q.classId} onChange={(e) => setQ({ ...q, classId: e.target.value })} className="rounded border border-slate-300 px-2 py-1"><option value="">Class…</option>{project.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                <input list="mgr-subjects" placeholder="Subject" value={q.subjectId} onChange={(e) => setQ({ ...q, subjectId: e.target.value })} className="w-28 rounded border border-slate-300 px-2 py-1" />
                <datalist id="mgr-subjects">{project.subjects.map((s) => <option key={s.id} value={s.id} />)}</datalist>
                <select value={q.teacher} onChange={(e) => setQ({ ...q, teacher: e.target.value })} className="rounded border border-slate-300 px-2 py-1"><option value="">Teacher…</option>{project.teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
                <input type="number" min={1} max={20} value={q.periodsPerWeek} onChange={(e) => setQ({ ...q, periodsPerWeek: Number(e.target.value) })} className="w-16 rounded border border-slate-300 px-2 py-1" />
                <button type="button" disabled={!q.classId || !q.subjectId || !q.teacher} onClick={() => { apply(addQuota(project, q)); setQ({ classId: "", subjectId: "", teacher: "", periodsPerWeek: 5 }); }} className="rounded bg-indigo-600 px-3 py-1 text-white disabled:opacity-40">Add quota</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
