import type { QuotaStatus } from "../../domain/validate";
import type { Project } from "../../domain/types";

const statusColor: Record<QuotaStatus["status"], string> = {
  ok: "text-emerald-600",
  short: "text-soft",
  excess: "text-hard",
};

export function QuotaPanel({ project, quota }: { project: Project; quota: QuotaStatus[] }) {
  const className = new Map(project.classes.map((c) => [c.id, c.name] as const));
  const subjectName = new Map(project.subjects.map((s) => [s.id, s.name] as const));

  return (
    <section className="rounded border border-slate-200 bg-white">
      <header className="border-b border-slate-200 px-3 py-2">
        <h2 className="text-sm font-semibold">Quota (placed / required)</h2>
      </header>
      {quota.length === 0 ? (
        <p className="px-3 py-2 text-xs text-slate-400">
          No curriculum requirements defined yet.
        </p>
      ) : (
        <ul className="max-h-64 divide-y divide-slate-100 overflow-auto text-xs">
          {quota.map((q) => (
            <li key={q.requirementId} className="flex justify-between px-3 py-1">
              <span className="text-slate-700">
                {className.get(q.classId) ?? q.classId} · {subjectName.get(q.subjectId) ?? q.subjectId}
              </span>
              <span className={statusColor[q.status]}>
                {q.placed}/{q.required}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
