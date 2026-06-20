// Subject quotas (OVERHAUL B) — the "compulsory subjects per week" editor the app never had.
// Per class, set how many periods each subject must run each week. The planner treats these
// as demand to fill, and the coverage check flags any class that falls short. Plain numbers,
// no jargon; every edit is undoable + persisted through the store.

import { useState } from "react";
import { requirementCoverage } from "../../domain/coverage";
import type { Id, Project, Timetable } from "../../domain/types";
import { useProjectStore } from "../../store/projectStore";

export function QuotasView({ project, timetable }: { project: Project; timetable: Timetable }): React.ReactElement {
  const store = useProjectStore();
  const [classId, setClassId] = useState<Id>(project.classes[0]!.id);
  const [adding, setAdding] = useState("");

  const cls = project.classes.find((c) => c.id === classId) ?? project.classes[0]!;
  const coverage = requirementCoverage(project, timetable).filter((c) => c.classId === cls.id);
  const subjName = new Map(project.subjects.map((s) => [s.id, s.name]));
  const required = new Set(coverage.map((c) => c.subjectId));
  const totalRequired = coverage.reduce((n, c) => n + c.required, 0);
  const totalGap = coverage.reduce((n, c) => n + c.short, 0);

  // subjects not yet required for this class (offer those someone is qualified to teach first)
  const qualified = new Set(project.qualifications.filter((q) => q.classId === cls.id).map((q) => q.subjectId));
  const addable = project.subjects
    .filter((s) => !required.has(s.id) && s.kind !== "fixed")
    .sort((a, b) => Number(qualified.has(b.id)) - Number(qualified.has(a.id)) || a.name.localeCompare(b.name));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-slate-500">Class</span>
          <select className="ts-input" value={cls.id} onChange={(e) => setClassId(e.target.value)}>
            {project.classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <div className="text-sm text-slate-500">
          <span className="font-semibold text-slate-700">{totalRequired}</span> periods/week required
          {totalGap > 0 && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">{totalGap} not yet placed</span>}
        </div>
      </div>

      <div className="ts-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Subject</th>
              <th className="px-4 py-2 font-medium">Periods / week</th>
              <th className="px-4 py-2 font-medium">In timetable</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {coverage.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">No subjects required yet. Add one below.</td></tr>
            )}
            {coverage.map((row) => (
              <tr key={row.subjectId} className="hover:bg-slate-50">
                <td className="px-4 py-2 font-medium text-slate-800">{subjName.get(row.subjectId) ?? row.subjectId}</td>
                <td className="px-4 py-2">
                  <input
                    type="number"
                    min={0}
                    max={40}
                    aria-label={`Periods per week of ${subjName.get(row.subjectId) ?? row.subjectId}`}
                    value={row.required}
                    onChange={(e) => store.setRequirementPeriods(cls.id, row.subjectId, Number(e.target.value))}
                    className="ts-input w-20"
                  />
                </td>
                <td className="px-4 py-2">
                  {row.short === 0 ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">{row.placed} placed</span>
                  ) : (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">{row.placed} of {row.required} · {row.short} short</span>
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => store.removeRequirement(cls.id, row.subjectId)} className="text-xs font-medium text-rose-600 hover:underline">Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select className="ts-input" value={adding} onChange={(e) => setAdding(e.target.value)}>
          <option value="">Add a required subject…</option>
          {addable.map((s) => (
            <option key={s.id} value={s.id}>{s.name}{qualified.has(s.id) ? "" : " (no teacher yet)"}</option>
          ))}
        </select>
        <button
          className="ts-btn-ghost"
          disabled={!adding}
          onClick={() => {
            if (!adding) return;
            store.setRequirementPeriods(cls.id, adding, 1);
            setAdding("");
          }}
        >
          + Add subject
        </button>
        <p className="text-xs text-slate-500">After changing quotas, run <span className="font-medium">Make timetable</span> to place the new periods.</p>
      </div>
    </div>
  );
}
