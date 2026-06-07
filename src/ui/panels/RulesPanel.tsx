// Rules view (RB6). Sentence-first: every rule reads as plain English (ruleSentence), with
// a toggle to turn it on/off and a remove. "Suggested rules" detects patterns already true
// in the timetable (blocks, doubles, teacher caps) — one click adds one (never silent). A
// must-rule that's broken shows up as a problem in "Things to fix"; a prefer-rule as a
// gentle "could be better".

import { ruleSentence } from "../../domain/ruleText";
import { suggestRules } from "../../domain/suggestRules";
import type { Id, Project, Rule, Timetable } from "../../domain/types";

interface Props {
  project: Project;
  timetable: Timetable;
  onAdd: (rule: Rule) => void;
  onToggle: (id: Id) => void;
  onRemove: (id: Id) => void;
}

export function RulesPanel({ project, timetable, onAdd, onToggle, onRemove }: Props): React.ReactElement {
  const active = project.rules;
  const activeIds = new Set(active.map((r) => r.id));
  const suggestions = suggestRules(project, timetable).filter((s) => !activeIds.has(s.id));

  return (
    <div className="space-y-5">
      <section>
        <h2 className="mb-2 text-sm font-semibold">Your rules · {active.length}</h2>
        {active.length === 0 ? (
          <p className="text-sm text-slate-500">No rules yet. Add one from the suggestions below.</p>
        ) : (
          <ul className="space-y-1">
            {active.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 rounded border border-slate-200 px-3 py-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={r.enabled} onChange={() => onToggle(r.id)} />
                  <span className={r.enabled ? "" : "text-slate-400 line-through"}>{ruleSentence(r, project)}</span>
                  <span className="rounded bg-slate-100 px-1.5 text-[10px] uppercase text-slate-500">{r.severity === "must" ? "must" : "prefer"}</span>
                </label>
                <button onClick={() => onRemove(r.id)} className="text-xs text-rose-600 hover:underline">Remove</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Suggested rules · {suggestions.length}</h2>
        <p className="mb-2 text-xs text-slate-500">Patterns already in your timetable — add the ones you want to keep.</p>
        {suggestions.length === 0 ? (
          <p className="text-sm text-slate-500">Nothing new to suggest.</p>
        ) : (
          <ul className="max-h-96 space-y-1 overflow-auto">
            {suggestions.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 rounded border border-slate-100 bg-slate-50 px-3 py-2">
                <span className="text-sm text-slate-700">{ruleSentence(s, project)}</span>
                <button onClick={() => onAdd(s)} className="rounded bg-slate-800 px-2 py-1 text-xs font-medium text-white hover:bg-slate-700">
                  Add
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
