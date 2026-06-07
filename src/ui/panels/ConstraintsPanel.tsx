// Constraints panel (C3) — create, toggle and remove APPLIED constraints. Each is a
// plain fill-in-the-blank sentence; turning one on immediately changes validation
// (cells highlight) and Fill-the-gaps (it respects must-constraints). No codes shown.
// C4 adds the rest of the catalog + "suggest constraints"; C3 ships three templates.

import { useState } from "react";
import { constraintSentence } from "../../domain/constraints";
import type { Constraint, ConstraintSeverity, ConstraintTemplate, HalfOfDay, Project } from "../../domain/types";

interface Props {
  project: Project;
  onAdd: (c: Constraint) => void;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
}

let seq = 0;
const newId = () => `con:${Date.now().toString(36)}:${seq++}`;

export function ConstraintsPanel({ project, onAdd, onToggle, onRemove }: Props): React.ReactElement {
  const [template, setTemplate] = useState<ConstraintTemplate>("subject_half_of_day");
  const [severity, setSeverity] = useState<ConstraintSeverity>("must");
  const [subjectId, setSubjectId] = useState(project.subjects[0]?.id ?? "");
  const [classId, setClassId] = useState(project.classes[0]?.id ?? "");
  const [teacherId, setTeacherId] = useState(project.teachers.find((t) => t.schedulable)?.id ?? "");
  const [half, setHalf] = useState<HalfOfDay>("first");
  const [max, setMax] = useState(30);

  const teachers = project.teachers.filter((t) => t.schedulable).sort((a, b) => a.name.localeCompare(b.name));
  const subjects = [...project.subjects].sort((a, b) => a.name.localeCompare(b.name));

  const build = (): Constraint => {
    const base = { id: newId(), weight: severity === "prefer" ? 3 : 1, enabled: true };
    if (template === "subject_half_of_day")
      return { ...base, scope: "subject", severity, template, params: { subjectIds: [subjectId], classIds: [classId], half } };
    if (template === "teacher_max_per_week")
      return { ...base, scope: "teacher", severity, template, params: { teacherId, max } };
    return { ...base, scope: "class", severity, template, params: { classId } };
  };

  const preview = (() => {
    try { return constraintSentence(project, build()); } catch { return ""; }
  })();

  return (
    <div className="max-w-2xl">
      <h2 className="mb-1 text-lg font-semibold">Constraints</h2>
      <p className="mb-4 text-sm text-slate-500">
        Rules the timetable must (or should) follow. A “must” is flagged in red on the grid and respected when filling gaps; a “should” is a gentle preference.
      </p>

      <div className="mb-5 rounded border border-slate-200 bg-slate-50 p-3 text-sm">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <select className="rounded border border-slate-300 px-2 py-1" value={template} onChange={(e) => setTemplate(e.target.value as ConstraintTemplate)}>
            <option value="subject_half_of_day">A subject in the first/second half of the day</option>
            <option value="teacher_max_per_week">A teacher’s weekly period limit</option>
            <option value="class_teacher_p1">Class teacher takes period 1 daily</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {template === "subject_half_of_day" && (
            <>
              <select className="rounded border border-slate-300 px-2 py-1" value={subjectId} onChange={(e) => setSubjectId(e.target.value)} aria-label="Subject">
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <span>in the</span>
              <select className="rounded border border-slate-300 px-2 py-1" value={half} onChange={(e) => setHalf(e.target.value as HalfOfDay)} aria-label="Half of day">
                <option value="first">first half</option>
                <option value="second">second half</option>
              </select>
              <span>for</span>
              <select className="rounded border border-slate-300 px-2 py-1" value={classId} onChange={(e) => setClassId(e.target.value)} aria-label="Class">
                {project.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </>
          )}
          {template === "teacher_max_per_week" && (
            <>
              <select className="rounded border border-slate-300 px-2 py-1" value={teacherId} onChange={(e) => setTeacherId(e.target.value)} aria-label="Teacher">
                {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <span>teaches at most</span>
              <input type="number" min={1} className="w-16 rounded border border-slate-300 px-2 py-1" value={max} onChange={(e) => setMax(Number(e.target.value))} aria-label="Max periods per week" />
              <span>periods a week</span>
            </>
          )}
          {template === "class_teacher_p1" && (
            <>
              <select className="rounded border border-slate-300 px-2 py-1" value={classId} onChange={(e) => setClassId(e.target.value)} aria-label="Class">
                {project.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <span>’s class teacher takes period 1 every day</span>
            </>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select className="rounded border border-slate-300 px-2 py-1" value={severity} onChange={(e) => setSeverity(e.target.value as ConstraintSeverity)} aria-label="Strength">
            <option value="must">Must (hard)</option>
            <option value="prefer">Should (soft)</option>
          </select>
          <button onClick={() => onAdd(build())} className="rounded bg-slate-800 px-3 py-1 text-white">Add constraint</button>
          {preview && <span className="text-xs italic text-slate-500">“{preview}”</span>}
        </div>
      </div>

      <h3 className="mb-2 text-sm font-semibold">Your constraints</h3>
      {project.constraints.length === 0 ? (
        <p className="text-sm text-slate-400">None yet. Add one above.</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded border border-slate-200">
          {project.constraints.map((c) => (
            <li key={c.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              <input type="checkbox" checked={c.enabled} onChange={() => onToggle(c.id)} aria-label={`Toggle ${constraintSentence(project, c)}`} />
              <span className={`flex-1 ${c.enabled ? "" : "text-slate-400 line-through"}`}>{constraintSentence(project, c)}</span>
              <span className={`rounded px-2 py-0.5 text-xs ${c.severity === "must" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>
                {c.severity === "must" ? "Must" : "Should"}
              </span>
              <button onClick={() => onRemove(c.id)} className="rounded border border-slate-300 px-2 py-0.5 text-xs hover:bg-slate-50">Remove</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
