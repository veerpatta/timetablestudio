// Constraints panel (C3–C4) — create/toggle/remove APPLIED constraints + one-click
// "Suggest constraints". The builder is DATA-DRIVEN from constraintCatalog.ts (a field
// table), so all 24 templates render through one generic form. Plain language, no codes.

import { useMemo, useState } from "react";
import { CATALOG, descriptorFor, type Field } from "../../domain/constraintCatalog";
import { constraintSentence } from "../../domain/constraints";
import { suggestConstraints } from "../../domain/suggestConstraints";
import { teachingSlots } from "../../domain/profile";
import { findProfile } from "../../domain/derive";
import type { Constraint, ConstraintSeverity, ConstraintTemplate, Project, Timetable } from "../../domain/types";

interface Props {
  project: Project;
  timetable: Timetable;
  onAdd: (c: Constraint) => void;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
}

let seq = 0;
const newId = () => `con:${seq++}:${Math.floor(Math.random() * 1e6)}`;

type Values = Record<string, string | string[] | number>;

function defaultValues(fields: Field[], project: Project, slots: number[]): Values {
  const v: Values = {};
  for (const f of fields) {
    if (f.kind === "subjects" || f.kind === "classes" || f.kind === "slots") v[f.key] = [];
    else if (f.kind === "subject") v[f.key] = project.subjects[0]?.id ?? "";
    else if (f.kind === "class") v[f.key] = project.classes[0]?.id ?? "";
    else if (f.kind === "teacher") v[f.key] = project.teachers.find((t) => t.schedulable)?.id ?? "";
    else if (f.kind === "half") v[f.key] = "first";
    else if (f.kind === "number") v[f.key] = f.def;
  }
  void slots;
  return v;
}

export function ConstraintsPanel({ project, timetable, onAdd, onToggle, onRemove }: Props): React.ReactElement {
  const profile = findProfile(project, timetable) ?? project.profiles[0]!;
  const slots = useMemo(() => teachingSlots(profile), [profile]);
  const [template, setTemplate] = useState<ConstraintTemplate>("subject_half_of_day");
  const [severity, setSeverity] = useState<ConstraintSeverity>("must");
  const desc = descriptorFor(template);
  const [values, setValues] = useState<Values>(() => defaultValues(desc.fields, project, slots));

  const reset = (t: ConstraintTemplate) => {
    const d = descriptorFor(t);
    setTemplate(t);
    setSeverity(d.defaultSeverity);
    setValues(defaultValues(d.fields, project, slots));
  };
  const toggleIn = (key: string, val: string) =>
    setValues((v) => {
      const arr = (v[key] as string[]) ?? [];
      return { ...v, [key]: arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val] };
    });

  const build = (): Constraint => ({
    id: newId(), scope: desc.scope, severity, weight: severity === "prefer" ? 3 : 1, enabled: true,
    template, params: { ...values },
  } as unknown as Constraint);

  const ready = desc.fields.every((f) => {
    const v = values[f.key];
    if (f.kind === "subjects" || f.kind === "classes" || f.kind === "slots") return (v as string[]).length > 0;
    return v !== "" && v != null;
  });
  const preview = ready ? safeSentence(project, build()) : "";

  const suggestions = useMemo(() => suggestConstraints(project, timetable), [project, timetable]);
  const existingKeys = new Set(project.constraints.map((c) => `${c.template}|${JSON.stringify(c.params)}`));
  const freshSuggestions = suggestions.filter((s) => !existingKeys.has(`${s.template}|${JSON.stringify(s.params)}`)).slice(0, 12);

  return (
    <div className="max-w-2xl">
      <h2 className="mb-1 text-lg font-semibold">Constraints</h2>
      <p className="mb-4 text-sm text-slate-500">
        Rules the timetable must (or should) follow. A “must” shows in red on the grid and is respected when filling gaps; a “should” is a gentle preference.
      </p>

      <div className="mb-5 rounded border border-slate-200 bg-slate-50 p-3 text-sm">
        <select className="mb-2 w-full rounded border border-slate-300 px-2 py-1" value={template} onChange={(e) => reset(e.target.value as ConstraintTemplate)}>
          {CATALOG.map((d) => <option key={d.template} value={d.template}>{d.label}</option>)}
        </select>

        <div className="flex flex-col gap-2">
          {desc.fields.map((f) => (
            <FieldInput key={f.key} field={f} project={project} slots={slots} values={values} setValues={setValues} toggleIn={toggleIn} />
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select className="rounded border border-slate-300 px-2 py-1" value={severity} onChange={(e) => setSeverity(e.target.value as ConstraintSeverity)} aria-label="Strength">
            <option value="must">Must (hard)</option>
            <option value="prefer">Should (soft)</option>
          </select>
          <button disabled={!ready} onClick={() => onAdd(build())} className="rounded bg-slate-800 px-3 py-1 text-white disabled:opacity-40">Add constraint</button>
          {preview && <span className="text-xs italic text-slate-500">“{preview}”</span>}
        </div>
      </div>

      {freshSuggestions.length > 0 && (
        <div className="mb-5">
          <h3 className="mb-2 text-sm font-semibold">Suggested from your timetable</h3>
          <ul className="divide-y divide-slate-100 rounded border border-slate-200">
            {freshSuggestions.map((s) => (
              <li key={s.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                <span className="flex-1 text-slate-600">{safeSentence(project, s)}</span>
                <button onClick={() => onAdd({ ...s, id: newId() })} className="rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700 hover:bg-emerald-100">Add</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <h3 className="mb-2 text-sm font-semibold">Your constraints</h3>
      {project.constraints.length === 0 ? (
        <p className="text-sm text-slate-400">None yet. Add one above, or pick a suggestion.</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded border border-slate-200">
          {project.constraints.map((c) => (
            <li key={c.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              <input type="checkbox" checked={c.enabled} onChange={() => onToggle(c.id)} aria-label={`Toggle ${safeSentence(project, c)}`} />
              <span className={`flex-1 ${c.enabled ? "" : "text-slate-400 line-through"}`}>{safeSentence(project, c)}</span>
              <span className={`rounded px-2 py-0.5 text-xs ${c.severity === "must" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>{c.severity === "must" ? "Must" : "Should"}</span>
              <button onClick={() => onRemove(c.id)} className="rounded border border-slate-300 px-2 py-0.5 text-xs hover:bg-slate-50">Remove</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function safeSentence(project: Project, c: Constraint): string {
  try { return constraintSentence(project, c); } catch { return c.template; }
}

function FieldInput({ field, project, slots, values, setValues, toggleIn }: {
  field: Field; project: Project; slots: number[]; values: Values;
  setValues: React.Dispatch<React.SetStateAction<Values>>; toggleIn: (key: string, val: string) => void;
}): React.ReactElement {
  const profile = project.profiles.find((p) => p.isDefault) ?? project.profiles[0]!;
  const teachers = project.teachers.filter((t) => t.schedulable).sort((a, b) => a.name.localeCompare(b.name));
  const subjects = [...project.subjects].sort((a, b) => a.name.localeCompare(b.name));
  const label = <span className="text-xs text-slate-500">{field.label}</span>;

  if (field.kind === "number")
    return <label className="flex items-center gap-2">{label}<input type="number" className="w-20 rounded border border-slate-300 px-2 py-1" value={values[field.key] as number} onChange={(e) => setValues((v) => ({ ...v, [field.key]: Number(e.target.value) }))} aria-label={field.label} /></label>;
  if (field.kind === "half")
    return <label className="flex items-center gap-2">{label}<select className="rounded border border-slate-300 px-2 py-1" value={values[field.key] as string} onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))} aria-label={field.label}><option value="first">first half</option><option value="second">second half</option></select></label>;
  if (field.kind === "teacher" || field.kind === "subject" || field.kind === "class") {
    const opts = field.kind === "teacher" ? teachers : field.kind === "subject" ? subjects : project.classes;
    return <label className="flex items-center gap-2">{label}<select className="rounded border border-slate-300 px-2 py-1" value={values[field.key] as string} onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))} aria-label={field.label}>{opts.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>;
  }
  // multi: subjects / classes / slots → checkbox group
  const options = field.kind === "subjects" ? subjects.map((s) => ({ id: s.id, name: s.name }))
    : field.kind === "classes" ? project.classes.map((c) => ({ id: c.id, name: c.name }))
    : slots.map((s) => ({ id: String(s), name: profile.slots.find((x) => x.index === s)?.label ?? `P${s}` }));
  const sel = (values[field.key] as string[]) ?? [];
  return (
    <div>
      <div className="mb-1">{label}</div>
      <div className="flex max-h-28 flex-wrap gap-2 overflow-auto rounded border border-slate-200 bg-white p-2">
        {options.map((o) => (
          <label key={o.id} className="inline-flex items-center gap-1 text-xs">
            <input type="checkbox" checked={sel.includes(o.id)} onChange={() => toggleIn(field.key, o.id)} aria-label={`${field.label}: ${o.name}`} />
            {o.name}
          </label>
        ))}
      </div>
    </div>
  );
}
