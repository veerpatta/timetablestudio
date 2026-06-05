import { Modal } from "../common/Modal";
import { changeLedger } from "../../domain/scenario";
import type { Project, Timetable } from "../../domain/types";

/** Side-by-side change view: the diff grid as a readable ledger of cell changes
 * plus the problems-fixed / problems-created counts. */
export function ScenarioCompare({
  project,
  base,
  branch,
  onClose,
}: {
  project: Project;
  base: Timetable;
  branch: Timetable;
  onClose: () => void;
}) {
  const ledger = changeLedger(project, base, branch);

  return (
    <Modal onClose={onClose} label="Compare changes" maxWidth="max-w-2xl">
      <div className="p-5">
        <h2 className="text-lg font-semibold">What this change does</h2>
        <p className="mt-1 text-sm text-slate-600">
          {ledger.changes.length} cell{ledger.changes.length === 1 ? "" : "s"} changed
          {" · "}
          <span className={ledger.fixed ? "font-medium text-emerald-600" : "text-slate-400"}>
            fixes {ledger.fixed} problem{ledger.fixed === 1 ? "" : "s"}
          </span>
          {" · "}
          <span className={ledger.created ? "font-medium text-hard" : "text-slate-400"}>
            creates {ledger.created} new problem{ledger.created === 1 ? "" : "s"}
          </span>
        </p>
        {ledger.changes.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No changes yet — edit the scenario to see a comparison.</p>
        ) : (
          <ul className="mt-4 max-h-96 divide-y divide-slate-100 overflow-auto text-sm">
            {ledger.changes.map((c) => (
              <li key={`${c.classId}#${c.day}#${c.period}`} className="flex items-center gap-2 py-1.5">
                <span className="w-40 shrink-0 text-slate-500">
                  {c.className} · {c.day} P{c.period}
                </span>
                <span className="text-slate-400 line-through">{c.before || "Free"}</span>
                <span aria-hidden>→</span>
                <span className="font-medium text-slate-800">{c.after || "Free"}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
