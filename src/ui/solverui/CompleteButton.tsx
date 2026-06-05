import { useState } from "react";
import { useProjectStore } from "../../store/projectStore";
import { useEditorStore } from "../../store/editorStore";
import { runSolver, type RunHandle } from "./runSolver";

export function CompleteButton() {
  const project = useProjectStore((s) => s.project);
  const addDraft = useProjectStore((s) => s.addDraft);
  const [running, setRunning] = useState(false);
  const [handle, setHandle] = useState<RunHandle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seed, setSeed] = useState(1);

  if (!project) return null;

  const onComplete = async () => {
    setError(null);
    setRunning(true);
    const h = runSolver({
      project,
      timetableId: project.activeTimetableId!,
      mode: "complete",
      seed,
      maxMillis: 5000,
    });
    setHandle(h);
    try {
      const done = await h.promise;
      addDraft(
        done.feasible ? "Filled-in timetable" : "Filled-in timetable (still has conflicts)",
        done.placements,
      );
      useEditorStore.setState({ past: [], future: [] }); // fresh history for the new draft
      setSeed((s) => s + 1); // vary internally so repeated fills differ; not shown
    } catch (e) {
      if ((e as Error).message !== "cancelled") setError((e as Error).message);
    } finally {
      setRunning(false);
      setHandle(null);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {running ? (
        <>
          <span className="text-xs text-slate-500">Working…</span>
          <button
            type="button"
            onClick={() => handle?.cancel()}
            className="rounded border border-hard px-2 py-1 text-sm text-hard"
          >
            Cancel
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={onComplete}
          title="Fill empty periods automatically, keeping what you've pinned"
          className="rounded bg-emerald-600 px-3 py-1 text-sm font-medium text-white hover:bg-emerald-700"
        >
          Fill the gaps
        </button>
      )}
      {error && <span className="text-xs text-hard">⚠ {error}</span>}
    </div>
  );
}
