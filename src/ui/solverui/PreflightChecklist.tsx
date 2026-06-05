import type { Preflight, PreflightItem } from "../../solver/guidance";

const ICON: Record<PreflightItem["status"], string> = {
  ok: "✓",
  warn: "⚠",
  blocker: "✗",
};
const TONE: Record<PreflightItem["status"], string> = {
  ok: "text-emerald-600",
  warn: "text-amber-600",
  blocker: "text-hard",
};

/** The readable pre-flight checklist shown before generation (M14): quotas,
 * teacher/class capacity, block fit, and free-period warnings — each explained
 * in a sentence so a blocker is understood before the solver runs. */
export function PreflightChecklist({ preflight }: { preflight: Preflight }) {
  return (
    <div className="rounded border border-slate-200 p-3">
      <p className="mb-2 text-xs font-semibold text-slate-700">Before we build it — a quick check</p>
      <ul className="space-y-1.5 text-xs">
        {preflight.items.map((item, i) => (
          <li key={i} className="flex gap-2">
            <span className={`shrink-0 font-semibold ${TONE[item.status]}`} aria-hidden>
              {ICON[item.status]}
            </span>
            <span>
              <span className={item.status === "blocker" ? "text-hard" : "text-slate-700"}>
                {item.label}
              </span>
              {item.detail && <span className="block text-slate-400">{item.detail}</span>}
            </span>
          </li>
        ))}
      </ul>
      {!preflight.ok ? (
        <p className="mt-2 text-xs text-hard">Fix the ✗ items above, then create your options.</p>
      ) : (
        preflight.items.some((i) => i.status === "warn") && (
          <p className="mt-2 text-xs text-slate-500">
            You can still create options — the unplanned periods will simply be left free.
          </p>
        )
      )}
    </div>
  );
}
