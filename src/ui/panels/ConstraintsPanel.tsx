// Constraints panel (M23) — Rules/Preferences two-section UI. Rules are hard limits the
// planner always respects; Preferences are soft targets it tries to meet. No raw
// must/prefer codes are ever shown to the user — tierLabel() is the single source of truth
// for the vocabulary.

import { useMemo, useState } from "react";
import { CATALOG, descriptorFor, type Field } from "../../domain/constraintCatalog";
import { constraintSentence, tierLabel } from "../../domain/constraints";
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

function safeSentence(project: Project, c: Constraint): string {
  try { return constraintSentence(project, c); } catch { return c.template; }
}

export function ConstraintsPanel({ project, timetable, onAdd, onToggle, onRemove }: Props): React.ReactElement {
  const profile = findProfile(project, timetable) ?? project.profiles[0]!;
  const slots = useMemo(() => teachingSlots(profile), [profile]);
  const [template, setTemplate] = useState<ConstraintTemplate>("subject_half_of_day");
  const desc = descriptorFor(template);
  const [values, setValues] = useState<Values>(() => defaultValues(desc.fields, project, slots));

  const reset = (t: ConstraintTemplate) => {
    const d = descriptorFor(t);
    setTemplate(t);
    setValues(defaultValues(d.fields, project, slots));
  };
  const toggleIn = (key: string, val: string) =>
    setValues((v) => {
      const arr = (v[key] as string[]) ?? [];
      return { ...v, [key]: arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val] };
    });

  const buildWith = (severity: ConstraintSeverity): Constraint => ({
    id: newId(), scope: desc.scope, severity, weight: severity === "prefer" ? 3 : 1, enabled: true,
    template, params: { ...values },
  } as unknown as Constraint);

  const ready = desc.fields.every((f) => {
    const v = values[f.key];
    if (f.kind === "subjects" || f.kind === "classes" || f.kind === "slots") return (v as string[]).length > 0;
    return v !== "" && v != null;
  });
  const preview = ready ? safeSentence(project, buildWith("must")) : "";

  const moveTier = (c: Constraint) => {
    const newSeverity: ConstraintSeverity = c.severity === "must" ? "prefer" : "must";
    onAdd({ ...c, severity: newSeverity, weight: newSeverity === "prefer" ? 3 : 1 });
  };

  const rules = project.constraints.filter((c) => c.severity === "must");
  const prefs = project.constraints.filter((c) => c.severity === "prefer");

  const suggestions = useMemo(() => suggestConstraints(project, timetable), [project, timetable]);
  const existingKeys = new Set(project.constraints.map((c) => `${c.template}|${JSON.stringify(c.params)}`));
  const freshSuggestions = suggestions.filter((s) => !existingKeys.has(`${s.template}|${JSON.stringify(s.params)}`)).slice(0, 12);

  return (
    <div className="max-w-2xl">
      <h2 className="mb-1 text-lg font-semibold">Rules & Preferences</h2>
      <p className="mb-4 text-sm text-slate-500">
        Rules are hard limits the planner always respects. Preferences are soft targets it tries to meet.
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
          <button
            disabled={!ready}
            onClick={() => onAdd(buildWith("must"))}
            className="rounded bg-rose-700 px-3 py-1 text-sm font-medium text-white disabled:opacity-40 hover:bg-rose-800"
          >
            Add Rule
          </button>
          <button
            disabled={!ready}
            onClick={() => onAdd(buildWith("prefer"))}
            className="rounded bg-amber-600 px-3 py-1 text-sm font-medium text-white disabled:opacity-40 hover:bg-amber-700"
          >
            Add Preference
          </button>
          {preview && <span className="text-xs italic text-slate-500">"{preview}"</span>}
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

      <TierSection
        title={`${tierLabel("must")}s`}
        count={rules.length}
        constraints={rules}
        dotClass="bg-rose-500"
        borderClass="border-rose-100"
        rowClass="bg-rose-50/40"
        hint="Hard limits — the planner always respects these."
        moveLabel={`→ ${tierLabel("prefer")}`}
        moveTitleLabel={tierLabel("prefer")}
        moveClass="border-amber-300 text-amber-700 hover:bg-amber-50"
        project={project}
        onToggle={onToggle}
        onRemove={onRemove}
        onMove={moveTier}
      />

      <div className="my-3 border-t border-slate-100" />

      <TierSection
        title={`${tierLabel("prefer")}s`}
        count={prefs.length}
        constraints={prefs}
        dotClass="bg-amber-500"
        borderClass="border-amber-100"
        rowClass="bg-amber-50/40"
        hint="Soft targets — the planner tries its best but may miss some."
        moveLabel={`→ ${tierLabel("must")}`}
        moveTitleLabel={tierLabel("must")}
        moveClass="border-rose-300 text-rose-700 hover:bg-rose-50"
        project={project}
        onToggle={onToggle}
        onRemove={onRemove}
        onMove={moveTier}
      />
    </div>
  );
}

function TierSection({
  title, count, constraints, dotClass, borderClass, rowClass, hint,
  moveLabel, moveTitleLabel, moveClass, project, onToggle, onRemove, onMove,
}: {
  title: string; count: number; constraints: Constraint[]; dotClass: string; borderClass: string;
  rowClass: string; hint: string; moveLabel: string; moveTitleLabel: string; moveClass: string;
  project: Project; onToggle: (id: string) => void; onRemove: (id: string) => void; onMove: (c: Constraint) => void;
}): React.ReactElement {
  return (
    <section>
      <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">
        <span className={`inline-block h-2.5 w-2.5 rounded-full ${dotClass}`} />
        {title} · {count}
      </h3>
      <p className="mb-2 text-xs text-slate-500">{hint}</p>
      {constraints.length === 0 ? (
        <p className="py-2 text-sm text-slate-400">None yet. Use the form above to add one.</p>
      ) : (
        <ul className={`divide-y divide-slate-100 rounded border ${borderClass}`}>
          {constraints.map((c) => (
            <li key={c.id} className={`flex items-center gap-2 px-3 py-2 text-sm ${rowClass}`}>
              <input
                type="checkbox"
                checked={c.enabled}
                onChange={() => onToggle(c.id)}
                aria-label={`Toggle ${safeSentence(project, c)}`}
              />
              <span className={`flex-1 ${c.enabled ? "" : "text-slate-400 line-through"}`}>
                {safeSentence(project, c)}
              </span>
              <button
                onClick={() => onMove(c)}
                className={`rounded border px-2 py-0.5 text-xs ${moveClass}`}
                title={`Move to ${moveTitleLabel}s`}
              >
                {moveLabel}
              </button>
              <button onClick={() => onRemove(c.id)} className="rounded border border-slate-300 px-2 py-0.5 text-xs hover:bg-slate-50">
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
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
