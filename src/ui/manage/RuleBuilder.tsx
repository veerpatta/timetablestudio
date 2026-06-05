import { useMemo, useState } from "react";
import { Modal } from "../common/Modal";
import { Chips } from "../common/Chips";
import { ruleSentence } from "../../domain/ruleText";
import { RULE_TEMPLATES } from "../../domain/ruleText";
import { applyEntityUpdates, nextRuleId, type EntityUpdate } from "../../domain/ruleEdit";
import { FIELDS, buildRule, type FieldDesc, type RuleDraft } from "./ruleFields";
import type { Day, Project, Rule, RuleSeverity, RuleTemplate } from "../../domain/types";

interface Props {
  project: Project;
  onSave: (rule: Rule, entityUpdates: EntityUpdate[]) => void;
  onClose: () => void;
}

export function RuleBuilder({ project, onSave, onClose }: Props) {
  const profile = project.profiles.find(
    (p) => p.id === project.timetables.find((t) => t.id === project.activeTimetableId)?.profileId,
  );
  const ppd = profile?.periods.length ?? 6;
  const profileDays: Day[] = profile?.days ?? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const subjects = project.subjects.map((s) => s.name);
  const classNames = project.classes.map((c) => c.name);
  const teachers = project.teachers.map((t) => t.name);
  const blocks = project.activities.filter((a) => a.kind === "block");

  const [template, setTemplate] = useState<RuleTemplate>("R4");
  const meta = RULE_TEMPLATES.find((t) => t.id === template)!;
  const [severity, setSeverity] = useState<RuleSeverity>(meta.defaultSeverity);
  const [draft, setDraft] = useState<RuleDraft>({});

  const set = (key: string, value: RuleDraft[string]) => setDraft((d) => ({ ...d, [key]: value }));
  const toggleIn = (key: string, value: string) => {
    const cur = (Array.isArray(draft[key]) ? draft[key] : []) as string[];
    set(key, cur.includes(value) ? cur.filter((x) => x !== value) : [...cur, value]);
  };
  const onTemplate = (t: RuleTemplate) => {
    setTemplate(t);
    setDraft({});
    setSeverity(RULE_TEMPLATES.find((x) => x.id === t)!.defaultSeverity);
  };

  const built = useMemo(
    () => buildRule(template, draft, { id: "preview", severity, weight: meta.defaultWeight }),
    [template, draft, severity, meta.defaultWeight],
  );
  const preview =
    "rule" in built ? ruleSentence(applyEntityUpdates(project, built.entityUpdates), built.rule) : null;

  const save = () => {
    if (!("rule" in built)) return;
    const id = nextRuleId(project, template);
    const real = buildRule(template, draft, { id, severity, weight: meta.defaultWeight });
    if ("rule" in real) onSave(real.rule, real.entityUpdates);
  };

  return (
    <Modal onClose={onClose} label="Add a rule" maxWidth="max-w-xl">
      <div className="p-5">
        <h2 className="mb-3 text-lg font-semibold">Add a rule</h2>
        <label className="block text-sm">
          <span className="text-slate-600">Rule type</span>
          <select
            value={template}
            onChange={(e) => onTemplate(e.target.value as RuleTemplate)}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
          >
            {RULE_TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </label>

        <div className="mt-4 space-y-3">
          {FIELDS[template].map((f) => (
            <Field
              key={f.key}
              f={f}
              draft={draft}
              set={set}
              toggleIn={toggleIn}
              ppd={ppd}
              days={profileDays}
              subjects={subjects}
              classNames={classNames}
              teachers={teachers}
              blocks={blocks.map((b) => ({ id: b.id, name: b.kind === "block" ? b.name : b.id }))}
            />
          ))}
          {FIELDS[template].length === 0 && (
            <p className="text-sm text-slate-500">This rule has no settings — it applies school-wide.</p>
          )}
        </div>

        <div className="mt-4 flex items-center gap-2 text-sm">
          <span className="text-slate-600">Strength:</span>
          {(["must", "prefer"] as RuleSeverity[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSeverity(s)}
              aria-pressed={severity === s}
              className={`rounded px-2 py-0.5 ${severity === s ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-700"}`}
            >
              {s === "must" ? "Must (hard)" : "Prefer (soft)"}
            </button>
          ))}
        </div>

        <div className="mt-4 rounded bg-slate-50 p-3 text-sm">
          <span className="text-slate-500">Reads as: </span>
          {preview ? (
            <span className="font-medium text-slate-800">“{preview}”</span>
          ) : (
            <span className="text-amber-700">{"error" in built ? built.error : "Fill in the blanks"}</span>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50">
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!("rule" in built)}
            className="rounded bg-indigo-600 px-3 py-1 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
          >
            Add rule
          </button>
        </div>
      </div>
    </Modal>
  );
}

interface FieldProps {
  f: FieldDesc;
  draft: RuleDraft;
  set: (key: string, value: RuleDraft[string]) => void;
  toggleIn: (key: string, value: string) => void;
  ppd: number;
  days: Day[];
  subjects: string[];
  classNames: string[];
  teachers: string[];
  blocks: { id: string; name: string }[];
}

function Field({ f, draft, set, toggleIn, ppd, days, subjects, classNames, teachers, blocks }: FieldProps) {
  const arrVal = (Array.isArray(draft[f.key]) ? draft[f.key] : []) as string[];
  const label = <span className="text-xs font-medium text-slate-600">{f.label}</span>;

  const select = (options: string[], placeholder: string) => (
    <select
      value={typeof draft[f.key] === "string" ? (draft[f.key] as string) : ""}
      onChange={(e) => set(f.key, e.target.value)}
      aria-label={f.label}
      className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );

  const toggleRow = (values: string[], selected: string[]) => (
    <div className="mt-1 flex flex-wrap gap-1">
      {values.map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => toggleIn(f.key, v)}
          aria-pressed={selected.includes(v)}
          className={`rounded px-2 py-0.5 text-sm ${selected.includes(v) ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-700"}`}
        >
          {v}
        </button>
      ))}
    </div>
  );

  switch (f.kind) {
    case "subjectSingle":
      return <label className="block">{label}{select(subjects, "— pick a subject —")}</label>;
    case "classSingle":
      return <label className="block">{label}{select(classNames, "— pick a class —")}</label>;
    case "teacher":
      return <label className="block">{label}{select(teachers, "— pick a teacher —")}</label>;
    case "blockRef":
      return (
        <label className="block">
          {label}
          <select
            value={typeof draft[f.key] === "string" ? (draft[f.key] as string) : ""}
            onChange={(e) => set(f.key, e.target.value)}
            aria-label={f.label}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
          >
            <option value="">— pick a block —</option>
            {blocks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
      );
    case "subjectMulti":
    case "coreSubjectMulti":
      return (
        <div>
          {label}
          <Chips
            ariaLabel={f.label}
            placeholder="add a subject…"
            suggestions={subjects}
            values={arrVal}
            onAdd={(v) => subjects.includes(v) && set(f.key, [...arrVal, v])}
            onRemove={(v) => set(f.key, arrVal.filter((x) => x !== v))}
          />
        </div>
      );
    case "classScope":
      return (
        <div>
          {label} <span className="text-xs text-slate-400">(leave empty = all classes)</span>
          <Chips
            ariaLabel={f.label}
            placeholder="add a class…"
            suggestions={classNames}
            values={arrVal}
            onAdd={(v) => classNames.includes(v) && set(f.key, [...arrVal, v])}
            onRemove={(v) => set(f.key, arrVal.filter((x) => x !== v))}
          />
        </div>
      );
    case "periodSet":
      return <div>{label}{toggleRow(Array.from({ length: ppd }, (_, i) => String(i + 1)), arrVal)}</div>;
    case "daySet":
      return <div>{label}{toggleRow(days, arrVal)}</div>;
    case "half": {
      const cur = typeof draft[f.key] === "string" ? (draft[f.key] as string) : "";
      return (
        <div>
          {label}
          <div className="mt-1 flex flex-wrap gap-1">
            {["first", "second"].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => set(f.key, v)}
                aria-pressed={cur === v}
                className={`rounded px-2 py-0.5 text-sm ${cur === v ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-700"}`}
              >
                {v} half
              </button>
            ))}
          </div>
        </div>
      );
    }
    case "number":
      return (
        <label className="block">
          {label}
          <input
            type="number"
            min={f.min}
            max={f.max}
            value={typeof draft[f.key] === "number" ? (draft[f.key] as number) : ""}
            onChange={(e) => set(f.key, e.target.value === "" ? undefined : Number(e.target.value))}
            aria-label={f.label}
            className="mt-1 block w-24 rounded border border-slate-300 px-2 py-1 text-sm"
          />
        </label>
      );
  }
}
