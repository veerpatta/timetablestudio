import { useMemo, useState } from "react";
import { setQuotaPeriods } from "../../domain/projectEdit";
import { Modal } from "../common/Modal";
import type { Id, Project } from "../../domain/types";

interface Props {
  /** The normalized project inferred from a legacy import. */
  project: Project;
  onConfirm: (project: Project) => void;
  onCancel: () => void;
}

/** After a legacy import we infer weekly quotas from the timetable; this screen
 * lets the user CONFIRM reality ("Class 1 gets Maths 6×/week with Bindu") and
 * adjust before it becomes the working quota — instead of typing it from
 * scratch (M12 AC3). Per-class single lessons appear here; ELGA and senior
 * combined sections are shown as block periods in the per-class total. */
export function QuotaReview({ project, onConfirm, onCancel }: Props) {
  const subjectName = useMemo(
    () => new Map(project.subjects.map((s) => [s.id, s.name])),
    [project],
  );
  const teacherName = useMemo(
    () => new Map(project.teachers.map((t) => [t.id, t.name])),
    [project],
  );

  const profile = useMemo(() => {
    const tt = project.timetables.find((t) => t.id === project.activeTimetableId);
    return project.profiles.find((p) => p.id === tt?.profileId);
  }, [project]);
  const slotsPerWeek = (profile?.days.length ?? 6) * (profile?.periods.length ?? 6);

  // Block (ELGA + combined sections) periods already committed per class.
  const blockPeriodsByClass = useMemo(() => {
    const tt = project.timetables.find((t) => t.id === project.activeTimetableId);
    const byId = new Map(project.activities.map((a) => [a.id, a] as const));
    const counts = new Map<Id, number>();
    for (const pl of tt?.placements ?? []) {
      const a = byId.get(pl.activityId);
      if (!a || a.kind !== "block") continue;
      for (const c of a.classIds) counts.set(c, (counts.get(c) ?? 0) + a.length);
    }
    return counts;
  }, [project]);

  // Editable copy of the inferred weekly periods, keyed by requirement id.
  const [periods, setPeriods] = useState<Record<Id, string>>(() =>
    Object.fromEntries(
      project.requirements.curriculum.map((r) => [r.id, String(r.periodsPerWeek)]),
    ),
  );

  const byClass = useMemo(() => {
    const map = new Map<Id, typeof project.requirements.curriculum>();
    for (const c of project.classes) map.set(c.id, []);
    for (const r of project.requirements.curriculum) {
      const arr = map.get(r.classId) ?? [];
      arr.push(r);
      map.set(r.classId, arr);
    }
    return map;
  }, [project]);

  const valueOf = (id: Id) => periods[id] ?? "";
  const isValid = (v: string) => /^\d+$/.test(v.trim());
  const anyInvalid = Object.values(periods).some((v) => !isValid(v));

  const classTotal = (classId: Id) => {
    const reqs = byClass.get(classId) ?? [];
    const lessons = reqs.reduce((sum, r) => {
      const v = valueOf(r.id);
      return sum + (isValid(v) ? parseInt(v, 10) : 0);
    }, 0);
    return lessons + (blockPeriodsByClass.get(classId) ?? 0);
  };

  function handleConfirm() {
    let next = project;
    for (const r of project.requirements.curriculum) {
      const v = valueOf(r.id);
      if (isValid(v) && parseInt(v, 10) !== r.periodsPerWeek) {
        next = setQuotaPeriods(next, r.id, parseInt(v, 10));
      }
    }
    onConfirm(next);
  }

  return (
    <Modal onClose={onCancel} maxWidth="max-w-3xl" label="Review imported quotas">
      <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div>
          <h2 className="font-semibold">Check your weekly subjects</h2>
          <p className="text-xs text-slate-500">
            We read these from the timetable you imported. Adjust any that look wrong, then
            confirm — this becomes your weekly plan.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Close"
          className="text-slate-400 hover:text-slate-600"
        >
          ✕
        </button>
      </header>

      <div className="max-h-[60vh] space-y-4 overflow-y-auto p-4">
        {project.classes.map((c) => {
          const reqs = byClass.get(c.id) ?? [];
          const total = classTotal(c.id);
          const blocks = blockPeriodsByClass.get(c.id) ?? 0;
          return (
            <section key={c.id} className="rounded border border-slate-200">
              <div className="flex items-center justify-between bg-slate-50 px-3 py-2">
                <h3 className="text-sm font-semibold">{c.name}</h3>
                <span
                  className={`text-xs ${total > slotsPerWeek ? "text-hard" : "text-slate-500"}`}
                >
                  {total} of {slotsPerWeek} periods/week planned
                  {blocks > 0 ? ` (incl. ${blocks} in shared blocks)` : ""}
                </span>
              </div>
              {reqs.length === 0 ? (
                <p className="px-3 py-2 text-xs text-slate-400">
                  Only shared blocks (e.g. ELGA) — no single-class subjects inferred.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {reqs.map((r) => {
                    const v = valueOf(r.id);
                    const bad = !isValid(v);
                    return (
                      <li key={r.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                        <span className="flex-1">
                          {subjectName.get(r.subjectId) ?? r.subjectId}
                          <span className="text-slate-400">
                            {" "}
                            ·{" "}
                            {r.teacherIds.map((t) => teacherName.get(t) ?? t).join(", ") ||
                              "no teacher"}
                          </span>
                        </span>
                        <label className="flex items-center gap-1">
                          <input
                            type="number"
                            min={0}
                            inputMode="numeric"
                            value={v}
                            onChange={(e) =>
                              setPeriods((p) => ({ ...p, [r.id]: e.target.value }))
                            }
                            aria-label={`${subjectName.get(r.subjectId) ?? r.subjectId} periods per week for ${c.name}`}
                            aria-invalid={bad}
                            className={`w-16 rounded border px-2 py-1 text-right ${bad ? "border-hard bg-red-50" : "border-slate-300"}`}
                          />
                          <span className="text-xs text-slate-400">×/week</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
        {anyInvalid && (
          <p className="rounded bg-red-50 px-3 py-2 text-xs text-hard">
            Each subject needs a whole number of periods (0 or more). Fix the highlighted boxes
            to continue.
          </p>
        )}
      </div>

      <footer className="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={anyInvalid}
          className="rounded bg-indigo-600 px-4 py-1 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          Looks right — use these
        </button>
      </footer>
    </Modal>
  );
}
