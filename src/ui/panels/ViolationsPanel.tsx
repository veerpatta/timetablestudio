import type { Day, Violation } from "../../domain/types";
import { useUiStore } from "../../store/uiStore";

interface Props {
  violations: Violation[];
  /** Jump the grid to the day/period a conflict touches. */
  onJump?: (day: Day, period: number) => void;
}

export function ViolationsPanel({ violations, onJump }: Props) {
  const advanced = useUiStore((s) => s.advanced);
  const hard = violations.filter((v) => v.severity === "hard");
  const soft = violations.filter((v) => v.severity === "soft");

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
        <ul className="max-h-64 divide-y divide-slate-100 overflow-auto">
          {violations.map((v, i) => {
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
          })}
        </ul>
      )}
    </section>
  );
}
