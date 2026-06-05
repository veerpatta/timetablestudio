import { useState } from "react";
import { useProjectStore } from "../../store/projectStore";
import { useScenarioStore } from "../../store/scenarioStore";
import { changeLedger } from "../../domain/scenario";
import { ScenarioCompare } from "./ScenarioCompare";
import { RegenerateControl } from "./RegenerateControl";

/** "Try a change" workbench bar: branch the live timetable, edit/regenerate the
 * branch, compare, then promote (undoable) or discard. */
export function ScenarioBar() {
  const project = useProjectStore((s) => s.project);
  const { active, baseId, branchId, start, discard, promote } = useScenarioStore();
  const [showCompare, setShowCompare] = useState(false);

  if (!project) return null;

  if (!active) {
    return (
      <div className="no-print mb-3 flex items-center justify-between rounded border border-dashed border-indigo-200 bg-indigo-50/50 px-3 py-2 text-sm">
        <span className="text-slate-600">Want to experiment without touching the live timetable?</span>
        <button
          type="button"
          onClick={start}
          className="rounded bg-indigo-600 px-3 py-1 font-medium text-white hover:bg-indigo-700"
        >
          Try a change
        </button>
      </div>
    );
  }

  const base = project.timetables.find((t) => t.id === baseId);
  const branch = project.timetables.find((t) => t.id === branchId);
  if (!base || !branch) return null;
  const ledger = changeLedger(project, base, branch);

  return (
    <div className="no-print mb-3 rounded border border-indigo-300 bg-indigo-50 px-3 py-2 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-indigo-900">
          <span className="font-semibold">Trying a change</span> · {ledger.changes.length} cell
          {ledger.changes.length === 1 ? "" : "s"} changed · fixes {ledger.fixed} · creates {ledger.created}
        </span>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setShowCompare(true)} className="rounded border border-indigo-300 bg-white px-2 py-1 hover:bg-indigo-50">
            Compare
          </button>
          <button type="button" onClick={promote} className="rounded bg-emerald-600 px-3 py-1 font-medium text-white hover:bg-emerald-700">
            Promote to live
          </button>
          <button type="button" onClick={discard} className="rounded border border-slate-300 bg-white px-2 py-1 hover:bg-slate-50">
            Discard
          </button>
        </div>
      </div>
      <div className="mt-2 border-t border-indigo-200 pt-2">
        <RegenerateControl project={project} timetableId={branch.id} />
      </div>
      {showCompare && <ScenarioCompare project={project} base={base} branch={branch} onClose={() => setShowCompare(false)} />}
    </div>
  );
}
