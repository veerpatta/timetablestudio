import type { Violation } from "../../domain/types";

export function ViolationsPanel({ violations }: { violations: Violation[] }) {
  const hard = violations.filter((v) => v.severity === "hard");
  const soft = violations.filter((v) => v.severity === "soft");

  return (
    <section className="rounded border border-slate-200 bg-white">
      <header className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
        <h2 className="text-sm font-semibold">Conflicts</h2>
        <span className="text-xs">
          <span className={hard.length ? "font-semibold text-hard" : "text-slate-400"}>
            {hard.length} hard
          </span>
          {" · "}
          <span className={soft.length ? "font-semibold text-soft" : "text-slate-400"}>
            {soft.length} soft
          </span>
        </span>
      </header>
      {violations.length === 0 ? (
        <p className="px-3 py-2 text-xs text-emerald-600">No conflicts — feasible. ✓</p>
      ) : (
        <ul className="max-h-64 divide-y divide-slate-100 overflow-auto">
          {violations.map((v, i) => (
            <li key={i} className="flex gap-2 px-3 py-2 text-xs">
              <span
                className={`mt-0.5 shrink-0 rounded px-1 font-mono text-[10px] text-white ${
                  v.severity === "hard" ? "bg-hard" : "bg-soft"
                }`}
              >
                {v.constraintId}
              </span>
              <span className="text-slate-700">{v.message}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
