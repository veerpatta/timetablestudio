import { useMemo, useState } from "react";
import { useProjectStore } from "../../store/projectStore";
import { setClassSubjectQuota, copyClassQuotas, fillSubjectColumn } from "../../domain/projectEdit";
import type { Id, Project } from "../../domain/types";

/** Classes × subjects quota matrix with per-cell teacher assignment, per-class
 * running totals, and bulk tools (copy a class, fill a column) — the make-or-
 * break screen that replaces one-row-at-a-time quota entry (M13). */
export function QuotaMatrix() {
  const project = useProjectStore((s) => s.project)!;
  const setProject = useProjectStore((s) => s.setProject);
  const apply = (p: Project) => setProject(p);

  const profile = project.profiles.find(
    (p) => p.id === project.timetables.find((t) => t.id === project.activeTimetableId)?.profileId,
  );
  const slotsPerWeek = (profile?.days.length ?? 6) * (profile?.periods.length ?? 6);

  const reqOf = useMemo(() => {
    const m = new Map<string, { teacher: Id; periods: number }>();
    for (const r of project.requirements.curriculum) {
      m.set(`${r.classId}#${r.subjectId}`, { teacher: r.teacherIds[0] ?? "", periods: r.periodsPerWeek });
    }
    return m;
  }, [project]);

  const blockPeriodsByClass = useMemo(() => {
    const tt = project.timetables.find((t) => t.id === project.activeTimetableId);
    const byId = new Map(project.activities.map((a) => [a.id, a] as const));
    const counts = new Map<Id, number>();
    for (const pl of tt?.placements ?? []) {
      const a = byId.get(pl.activityId);
      if (a?.kind === "block") for (const c of a.classIds) counts.set(c, (counts.get(c) ?? 0) + a.length);
    }
    return counts;
  }, [project]);

  const qualifiedFor = (subjectId: Id) =>
    project.teachers.filter((t) => t.subjects.includes(subjectId));
  const defaultTeacher = (subjectId: Id): Id => {
    const q = qualifiedFor(subjectId)[0] ?? project.teachers[0];
    return q?.id ?? "";
  };

  const classTotal = (classId: Id) => {
    let sum = blockPeriodsByClass.get(classId) ?? 0;
    for (const s of project.subjects) sum += reqOf.get(`${classId}#${s.id}`)?.periods ?? 0;
    return sum;
  };

  const setPeriods = (classId: Id, subjectId: Id, raw: string) => {
    const n = /^\d+$/.test(raw.trim()) ? parseInt(raw.trim(), 10) : 0;
    const cur = reqOf.get(`${classId}#${subjectId}`);
    const teacher = cur?.teacher || defaultTeacher(subjectId);
    apply(setClassSubjectQuota(project, classId, subjectId, { teacher, periodsPerWeek: n }));
  };
  const setTeacher = (classId: Id, subjectId: Id, teacher: Id) => {
    const cur = reqOf.get(`${classId}#${subjectId}`);
    apply(setClassSubjectQuota(project, classId, subjectId, { teacher, periodsPerWeek: cur?.periods ?? 0 }));
  };

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold">Subjects &amp; Quotas</h2>
      <p className="mb-3 text-sm text-slate-500">
        How many periods a week each class gets of each subject, and who teaches it. Use the bulk
        tools to avoid filling cells one at a time.
      </p>

      <BulkTools project={project} apply={apply} defaultTeacher={defaultTeacher} />

      <div className="mt-4 overflow-auto rounded border border-slate-200">
        <table className="border-collapse text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-slate-100 px-2 py-1 text-left">Class</th>
              {project.subjects.map((s) => (
                <th key={s.id} className="min-w-24 border-l border-slate-200 bg-slate-50 px-1 py-1 text-left font-medium">
                  {s.name}
                </th>
              ))}
              <th className="border-l border-slate-200 bg-slate-100 px-2 py-1 text-right">Planned</th>
            </tr>
          </thead>
          <tbody>
            {project.classes.map((c) => {
              const total = classTotal(c.id);
              return (
                <tr key={c.id} className="border-t border-slate-100">
                  <th scope="row" className="sticky left-0 z-10 whitespace-nowrap bg-white px-2 py-1 text-left font-medium">
                    {c.name}
                  </th>
                  {project.subjects.map((s) => {
                    const cur = reqOf.get(`${c.id}#${s.id}`);
                    const periods = cur?.periods ?? 0;
                    return (
                      <td key={s.id} className="border-l border-slate-100 px-1 py-1 align-top">
                        <input
                          type="number"
                          min={0}
                          value={periods || ""}
                          onChange={(e) => setPeriods(c.id, s.id, e.target.value)}
                          aria-label={`${s.name} periods per week for ${c.name}`}
                          className="w-12 rounded border border-slate-200 px-1 py-0.5 text-right"
                        />
                        {periods > 0 && (
                          <select
                            value={cur?.teacher ?? ""}
                            onChange={(e) => setTeacher(c.id, s.id, e.target.value)}
                            aria-label={`Teacher for ${s.name} in ${c.name}`}
                            className="mt-0.5 block w-20 rounded border border-slate-200 px-0.5 py-0.5 text-[10px]"
                          >
                            {project.teachers.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                    );
                  })}
                  <td className={`border-l border-slate-200 px-2 py-1 text-right ${total > slotsPerWeek ? "text-hard" : "text-slate-500"}`}>
                    {total}/{slotsPerWeek}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BulkTools({
  project,
  apply,
  defaultTeacher,
}: {
  project: Project;
  apply: (p: Project) => void;
  defaultTeacher: (subjectId: Id) => Id;
}) {
  const [copyFrom, setCopyFrom] = useState("");
  const [fillSubject, setFillSubject] = useState("");
  const [fillPeriods, setFillPeriods] = useState(1);

  return (
    <div className="flex flex-col gap-2 rounded border border-slate-200 bg-slate-50 p-3 text-sm sm:flex-row sm:items-end sm:gap-6">
      <div className="flex items-end gap-2">
        <label className="block">
          <span className="text-xs text-slate-600">Copy one class's subjects to all others</span>
          <select value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)} className="mt-1 block rounded border border-slate-300 px-2 py-1">
            <option value="">Choose a class…</option>
            {project.classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={!copyFrom}
          onClick={() => apply(copyClassQuotas(project, copyFrom, project.classes.map((c) => c.id)))}
          className="rounded bg-slate-800 px-3 py-1 text-white disabled:opacity-40"
        >
          Copy to all
        </button>
      </div>

      <div className="flex items-end gap-2">
        <label className="block">
          <span className="text-xs text-slate-600">Fill a subject for every class</span>
          <select value={fillSubject} onChange={(e) => setFillSubject(e.target.value)} className="mt-1 block rounded border border-slate-300 px-2 py-1">
            <option value="">Choose a subject…</option>
            {project.subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <input
          type="number"
          min={0}
          value={fillPeriods}
          onChange={(e) => setFillPeriods(Math.max(0, Number(e.target.value)))}
          aria-label="Periods per week to fill"
          className="w-14 rounded border border-slate-300 px-2 py-1 text-right"
        />
        <button
          type="button"
          disabled={!fillSubject}
          onClick={() =>
            apply(
              fillSubjectColumn(project, fillSubject, defaultTeacher(fillSubject), fillPeriods, project.classes.map((c) => c.id)),
            )
          }
          className="rounded bg-slate-800 px-3 py-1 text-white disabled:opacity-40"
        >
          Fill column
        </button>
      </div>
    </div>
  );
}
