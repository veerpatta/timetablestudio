import { useMemo, useState } from "react";
import { useProjectStore } from "../../store/projectStore";
import { proposeSubstitutions, type CoverItem } from "../../domain/substitution";
import type { Day } from "../../domain/types";
import { Modal } from "../common/Modal";

const statusStyle: Record<CoverItem["status"], string> = {
  "owner-decision": "border-hard bg-red-50",
  "needs-cover": "border-soft bg-amber-50",
  partial: "border-slate-300 bg-slate-50",
};

export function SubstitutionView({ onClose }: { onClose: () => void }) {
  const project = useProjectStore((s) => s.project);
  const [day, setDay] = useState<Day>("Mon");
  const [absent, setAbsent] = useState<Set<string>>(new Set());

  const profileId = project?.timetables.find((t) => t.id === project.activeTimetableId)?.profileId;
  const profileDays = project?.profiles.find((p) => p.id === profileId)?.days ?? [];

  const plan = useMemo(() => {
    if (!project || absent.size === 0) return null;
    return proposeSubstitutions(project, project.activeTimetableId!, {
      day,
      absentTeacherIds: [...absent],
    });
  }, [project, day, absent]);

  if (!project) return null;

  const toggle = (id: string) =>
    setAbsent((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Modal onClose={onClose} maxWidth="max-w-3xl" label="Substitution assistant">
        <header className="no-print flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="font-semibold">Substitution assistant</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                document.body.classList.add("print-subs");
                const cleanup = () => {
                  document.body.classList.remove("print-subs");
                  window.removeEventListener("afterprint", cleanup);
                };
                window.addEventListener("afterprint", cleanup);
                window.print();
              }}
              disabled={!plan}
              className="rounded bg-slate-800 px-3 py-1 text-sm text-white disabled:opacity-40"
            >
              🖨 Print day sheet
            </button>
            <button type="button" onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-600">
              ✕
            </button>
          </div>
        </header>

        <div className="no-print flex flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-3 text-sm">
          <label className="flex items-center gap-1">
            Day
            <select
              value={day}
              onChange={(e) => setDay(e.target.value as Day)}
              className="rounded border border-slate-300 px-1 py-0.5"
            >
              {profileDays.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <span className="text-slate-400">Absent:</span>
          <div className="flex flex-wrap gap-1">
            {project.teachers.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => toggle(t.id)}
                className={`rounded px-2 py-0.5 text-xs ${
                  absent.has(t.id) ? "bg-hard text-white" : "bg-slate-100 text-slate-700"
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4">
          <div className="mb-3">
            <h3 className="text-lg font-semibold">Substitution sheet — {day}</h3>
            <p className="text-sm text-slate-500">
              Absent: {[...absent].map((id) => project.teachers.find((t) => t.id === id)?.name ?? id).join(", ") || "—"}
            </p>
          </div>

          {!plan ? (
            <p className="text-sm text-slate-400">Select one or more absent teachers above.</p>
          ) : plan.items.length === 0 ? (
            <p className="text-sm text-emerald-600">No affected periods on {day}. ✓</p>
          ) : (
            <ul className="space-y-2">
              {plan.items.map((item, i) => (
                <li key={i} className={`rounded border px-3 py-2 ${statusStyle[item.status]}`}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">
                      {item.classLabel} · {item.subjectLabel} · P{item.periods.join(", P")}
                    </span>
                    <span className="text-xs uppercase tracking-wide text-slate-500">
                      {item.status === "owner-decision"
                        ? "Owner decision"
                        : item.status === "partial"
                          ? "Proceeds (reduced staff)"
                          : "Needs cover"}
                    </span>
                  </div>
                  {item.status === "owner-decision" && (
                    <p className="mt-1 text-xs text-hard">
                      ELGA level group — cannot be auto-covered. Owner must decide (merge levels,
                      cancel, or reassign manually). Absent: {item.absentTeacherIds.join(", ")}.
                    </p>
                  )}
                  {item.status === "partial" && (
                    <p className="mt-1 text-xs text-slate-600">
                      Co-taught — proceeds with {item.presentTeacherIds.join(", ")} (absent:{" "}
                      {item.absentTeacherIds.join(", ")}).
                    </p>
                  )}
                  {item.status === "needs-cover" && (
                    <p className="mt-1 text-xs text-slate-700">
                      Cover for {item.absentTeacherIds.join(", ")}:{" "}
                      {item.candidates.length === 0 ? (
                        <span className="text-hard">no free qualified teacher available</span>
                      ) : (
                        item.candidates
                          .slice(0, 3)
                          .map((c) => `${c.teacherName}${c.createsGap ? " (gap)" : ""}`)
                          .join(", ")
                      )}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
    </Modal>
  );
}
