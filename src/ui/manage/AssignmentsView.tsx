// "Who teaches what" (C2): for one class, set the class teacher (+ the optional
// "takes period 1 daily" rule), and edit which teacher may teach each subject — the
// qualification matrix that powers the legal-only picker. Plain language throughout.

import { useState } from "react";
import { qualifiedTeachers } from "../../domain/assign";
import type { Project } from "../../domain/types";
import { useProjectStore } from "../../store/projectStore";

const P1_RULE_ID = (classId: string) => `R4:${classId}`;

export function AssignmentsView({ project }: { project: Project }): React.ReactElement {
  const store = useProjectStore();
  const [classId, setClassId] = useState(project.classes[0]!.id);
  const klass = project.classes.find((c) => c.id === classId) ?? project.classes[0]!;
  const teachersById = new Map(project.teachers.map((t) => [t.id, t.name]));
  const schedulable = project.teachers.filter((t) => t.schedulable).sort((a, b) => a.name.localeCompare(b.name));
  const subjects = [...project.subjects].sort((a, b) => a.name.localeCompare(b.name));
  const p1On = project.rules.some((r) => r.id === P1_RULE_ID(classId) && r.enabled);

  const toggleP1 = () => {
    if (p1On) store.removeRule(P1_RULE_ID(classId));
    else store.addRule({ id: P1_RULE_ID(classId), template: "R4", classId, enabled: true, severity: "prefer", weight: 3 });
  };

  return (
    <div>
      <label className="mb-4 flex items-center gap-2 text-sm">
        <span className="text-slate-500">Class</span>
        <select className="rounded border border-slate-300 px-2 py-1" value={classId} onChange={(e) => setClassId(e.target.value)}>
          {project.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>

      <div className="mb-5 rounded border border-slate-200 bg-slate-50 p-3">
        <h3 className="mb-2 text-sm font-semibold">Class teacher</h3>
        <label className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-slate-500">{klass.name}’s class teacher is</span>
          <select
            className="rounded border border-slate-300 px-2 py-1"
            value={klass.classTeacherId ?? ""}
            onChange={(e) => store.setClassTeacher(classId, e.target.value || undefined)}
          >
            <option value="">— none —</option>
            {schedulable.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
        <label className={`mt-2 flex items-center gap-2 text-sm ${klass.classTeacherId ? "" : "text-slate-400"}`}>
          <input type="checkbox" checked={p1On} disabled={!klass.classTeacherId} onChange={toggleP1} />
          <span>The class teacher takes period 1 every day</span>
        </label>
        {!klass.classTeacherId && <p className="mt-1 text-xs text-slate-400">Choose a class teacher to enable this.</p>}
      </div>

      <h3 className="mb-2 text-sm font-semibold">Who can teach each subject to {klass.name}</h3>
      <ul className="divide-y divide-slate-100 rounded border border-slate-200">
        {subjects.map((s) => {
          const qualified = qualifiedTeachers(project, s.id, classId);
          const available = schedulable.filter((t) => !qualified.includes(t.id));
          return (
            <li key={s.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
              <span className="w-32 shrink-0 font-medium">{s.name}</span>
              <div className="flex flex-1 flex-wrap items-center gap-1">
                {qualified.length === 0 && <span className="text-xs text-slate-400">no one yet</span>}
                {qualified.map((tid) => (
                  <span key={tid} className="inline-flex items-center gap-1 rounded bg-sky-100 px-2 py-0.5 text-xs text-sky-800">
                    {teachersById.get(tid) ?? tid}
                    <button
                      onClick={() => store.removeQualification(tid, s.id, classId)}
                      className="text-sky-500 hover:text-sky-800"
                      aria-label={`Remove ${teachersById.get(tid) ?? tid} from ${s.name}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
                <select
                  className="rounded border border-slate-300 px-1 py-0.5 text-xs"
                  value=""
                  onChange={(e) => e.target.value && store.addQualification(e.target.value, s.id, classId)}
                  aria-label={`Add a teacher for ${s.name}`}
                >
                  <option value="">+ teacher</option>
                  {available.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-slate-400">
        Only qualified teachers appear when you click a cell to edit it. Removing a qualification a lesson relies on shows up as something to fix — it’s never hidden.
      </p>
    </div>
  );
}
