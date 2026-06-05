import type { Day, Project, Violation } from "../../domain/types";
import { useUiStore } from "../../store/uiStore";
import { ruleSentence, RULE_TEMPLATES } from "../../domain/ruleText";

interface Props {
  violations: Violation[];
  /** When given, rule (R*) violations are grouped under the rule's own sentence. */
  project?: Project;
  /** Jump the grid to the day/period a conflict touches. */
  onJump?: (day: Day, period: number) => void;
}

const isRule = (id: string) => /^R\d+$/.test(id);

export function ViolationsPanel({ violations, project, onJump }: Props) {
  const advanced = useUiStore((s) => s.advanced);
  const hard = violations.filter((v) => v.severity === "hard");
  const soft = violations.filter((v) => v.severity === "soft");

  // Rule violations group by template; everything else stays flat.
  const flat = violations.filter((v) => !isRule(v.constraintId));
  const ruleGroups = new Map<string, Violation[]>();
  for (const v of violations) {
    if (!isRule(v.constraintId)) continue;
    const arr = ruleGroups.get(v.constraintId) ?? [];
    arr.push(v);
    ruleGroups.set(v.constraintId, arr);
  }

  const groupHeader = (constraintId: string): string => {
    const rules = project?.rules.filter((r) => r.enabled && r.template === constraintId) ?? [];
    if (project && rules.length === 1) return ruleSentence(project, rules[0]!);
    return RULE_TEMPLATES.find((t) => t.id === constraintId)?.title ?? constraintId;
  };

  const Row = ({ v, i }: { v: Violation; i: number }) => {
    const slot = v.slots.find((s) => s.period >= 1) ?? v.slots[0];
    const jumpable = onJump && slot && slot.period >= 1;
    return (
      <li key={i} className="flex items-start gap-2 px-3 py-2 text-xs">
        <span
          className={`mt-1 h-2 w-2 shrink-0 rounded-full ${v.severity === "hard" ? "bg-hard" : "bg-soft"}`}
          aria-hidden
        />
        <div className="min-w-0">
          <span className="text-slate-700">{v.message}</span>
          {jumpable && (
            <button
              type="button"
              onClick={() => onJump!(slot!.day, slot!.period)}
              className="ml-1 text-sky-600 hover:underline"
            >
              view
            </button>
          )}
          {advanced && (
            <span className="ml-1 font-mono text-[10px] text-slate-400">[{v.constraintId}]</span>
          )}
        </div>
      </li>
    );
  };

  return (
    <section className="rounded border border-slate-200 bg-white">
      <header className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
        <h2 className="text-sm font-semibold">Things to fix</h2>
        <span className="text-xs">
          <span className={hard.length ? "font-semibold text-hard" : "text-slate-400"}>
            {hard.length} {hard.length === 1 ? "clash" : "clashes"}
          </span>
          {" · "}
          <span className={soft.length ? "font-semibold text-soft" : "text-slate-400"}>
            {soft.length} {soft.length === 1 ? "suggestion" : "suggestions"}
          </span>
        </span>
      </header>
      {violations.length === 0 ? (
        <p className="px-3 py-2 text-xs text-emerald-600">No conflicts — everything fits. ✓</p>
      ) : (
        <div className="max-h-72 overflow-auto">
          {flat.length > 0 && (
            <ul className="divide-y divide-slate-100">
              {flat.map((v, i) => (
                <Row key={i} v={v} i={i} />
              ))}
            </ul>
          )}
          {[...ruleGroups.entries()].map(([constraintId, vs]) => (
            <div key={constraintId} className="border-t border-slate-100">
              <p className="bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-500">
                Rule: {groupHeader(constraintId)}
              </p>
              <ul className="divide-y divide-slate-100">
                {vs.map((v, i) => (
                  <Row key={i} v={v} i={i} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
