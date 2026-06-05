import { useState } from "react";
import { useProjectStore } from "../../store/projectStore";
import { ruleSentence } from "../../domain/ruleText";
import { removeRule, toggleRule, addRuleWithBacking } from "../../domain/ruleEdit";
import { indianK12Defaults } from "../../domain/rulePresets";
import { RuleBuilder } from "./RuleBuilder";
import { DetectProposals } from "./DetectProposals";
import { Glossary } from "../common/Glossary";
import type { Project } from "../../domain/types";

export function RulesPage() {
  const project = useProjectStore((s) => s.project)!;
  const setProject = useProjectStore((s) => s.setProject);
  const apply = (p: Project) => setProject(p);
  const timetable =
    project.timetables.find((t) => t.id === project.activeTimetableId) ?? project.timetables[0];

  const [showBuilder, setShowBuilder] = useState(false);
  const [showDetect, setShowDetect] = useState(false);

  const applyDefaults = () => {
    let next = project;
    for (const r of indianK12Defaults(project)) {
      if (!next.rules.some((x) => x.id === r.id)) next = { ...next, rules: [...next.rules, r] };
    }
    apply(next);
  };

  return (
    <div className="mx-auto max-w-3xl p-4">
      <h2 className="text-lg font-semibold">
        Rules <Glossary term="rule" />
      </h2>
      <p className="mb-3 text-sm text-slate-500">
        Plain-language constraints the timetable should follow. “Must” rules are hard (shown as
        conflicts); “Prefer” rules are soft (gentle nudges the generator tries to honour).
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => setShowBuilder(true)} className="rounded bg-indigo-600 px-3 py-1 text-sm font-medium text-white hover:bg-indigo-700">
          + Add rule
        </button>
        {timetable && (
          <button type="button" onClick={() => setShowDetect(true)} className="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50">
            Detect from timetable
          </button>
        )}
        <button type="button" onClick={applyDefaults} className="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50">
          Apply Indian K-12 defaults
        </button>
      </div>

      {project.rules.length === 0 ? (
        <p className="rounded border border-dashed border-slate-300 p-4 text-sm text-slate-500">
          No rules yet. Add one, detect the rules already in your timetable, or apply the defaults.
        </p>
      ) : (
        <ul className="space-y-2">
          {project.rules.map((r) => (
            <li key={r.id} className="flex items-start justify-between gap-3 rounded border border-slate-200 p-2 text-sm">
              <div className="min-w-0">
                <span className={r.enabled ? "text-slate-800" : "text-slate-400 line-through"}>
                  {ruleSentence(project, r)}
                </span>
                <span className={`ml-2 rounded px-1.5 py-0.5 text-[10px] font-medium ${r.severity === "must" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>
                  {r.severity === "must" ? "must" : "prefer"}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => apply(toggleRule(project, r.id))}
                  aria-pressed={r.enabled}
                  className={`rounded px-2 py-0.5 text-xs ${r.enabled ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600"}`}
                >
                  {r.enabled ? "On" : "Off"}
                </button>
                <button type="button" onClick={() => apply(removeRule(project, r.id))} aria-label={`Remove rule`} className="text-slate-400 hover:text-hard">
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {showBuilder && (
        <RuleBuilder
          project={project}
          onSave={(rule, updates) => {
            apply(addRuleWithBacking(project, rule, updates));
            setShowBuilder(false);
          }}
          onClose={() => setShowBuilder(false)}
        />
      )}
      {showDetect && timetable && (
        <DetectProposals project={project} timetable={timetable} apply={apply} onClose={() => setShowDetect(false)} />
      )}
    </div>
  );
}
