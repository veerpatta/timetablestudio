import { useEffect, useState } from "react";
import { useProjectStore } from "../../store/projectStore";
import { useEditorStore } from "../../store/editorStore";
import { useUiStore } from "../../store/uiStore";
import { useDerived } from "./hooks";
import { GridWorkspace } from "./GridWorkspace";
import { CompleteButton } from "../solverui/CompleteButton";
import { CandidateCompare } from "../solverui/CandidateCompare";
import { SubstitutionView } from "../substitution/SubstitutionView";
import { ExportImport } from "../io/ExportImport";
import { EmptyState } from "./EmptyState";
import { SetupWizard } from "../manage/SetupWizard";
import { DataManager } from "../manage/DataManager";

export function App() {
  const init = useProjectStore((s) => s.init);
  const loadDemo = useProjectStore((s) => s.loadDemo);
  const initialized = useProjectStore((s) => s.initialized);
  const project = useProjectStore((s) => s.project);
  const derived = useDerived();
  const [showGenerate, setShowGenerate] = useState(false);
  const [showSubs, setShowSubs] = useState(false);
  const [showIO, setShowIO] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [showData, setShowData] = useState(false);
  const { past, future } = useEditorStore();
  const { undo, redo } = useEditorStore.getState();
  const advanced = useUiStore((s) => s.advanced);
  const toggleAdvanced = useUiStore((s) => s.toggleAdvanced);

  useEffect(() => {
    void init();
  }, [init]);

  if (!initialized) {
    return <div className="p-6 text-slate-500">Loading…</div>;
  }
  if (!project) {
    return (
      <>
        <EmptyState
          onSetup={() => setShowWizard(true)}
          onImport={() => setShowIO(true)}
          onDemo={loadDemo}
        />
        {showWizard && <SetupWizard onClose={() => setShowWizard(false)} />}
        {showIO && <ExportImport onClose={() => setShowIO(false)} />}
      </>
    );
  }
  if (!derived) {
    return <div className="p-6 text-slate-500">Loading…</div>;
  }
  const { timetable, violations, maps, quota } = derived;
  const hardCount = violations.filter((v) => v.severity === "hard").length;
  const days = project.profiles.find((p) => p.id === timetable.profileId)?.days ?? [];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="app-shell">
      <header className="no-print flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
        <div>
          <h1 className="text-lg font-semibold">Timetable Studio</h1>
          <p className="text-xs text-slate-500">
            {project.school.name} · <span className="text-slate-400">{timetable.name}</span> ·{" "}
            {hardCount === 0 ? (
              <span className="text-emerald-600">Ready — no conflicts</span>
            ) : (
              <span className="text-hard">
                {hardCount} {hardCount === 1 ? "conflict" : "conflicts"} to fix
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <CompleteButton />
          <button
            type="button"
            onClick={() => setShowGenerate(true)}
            className="rounded bg-indigo-600 px-3 py-1 font-medium text-white hover:bg-indigo-700"
          >
            Create timetables
          </button>
          <button
            type="button"
            onClick={() => setShowData(true)}
            className="rounded border border-slate-300 px-3 py-1 hover:bg-slate-50"
          >
            🏫 Data
          </button>
          <button
            type="button"
            onClick={() => setShowSubs(true)}
            className="rounded border border-slate-300 px-3 py-1 hover:bg-slate-50"
          >
            🧑‍🏫 Substitutions
          </button>
          <button
            type="button"
            onClick={() => setShowIO(true)}
            className="rounded border border-slate-300 px-3 py-1 hover:bg-slate-50"
          >
            📤 File
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded border border-slate-300 px-3 py-1 hover:bg-slate-50"
          >
            🖨 Print
          </button>
          <button
            type="button"
            onClick={toggleAdvanced}
            aria-pressed={advanced}
            title="Show developer details (codes, seeds, scores)"
            className={`rounded border px-3 py-1 ${advanced ? "border-slate-800 bg-slate-800 text-white" : "border-slate-300 hover:bg-slate-50"}`}
          >
            Advanced
          </button>
          <span className="mx-1 h-5 w-px bg-slate-200" />
          <button
            type="button"
            onClick={undo}
            disabled={past.length === 0}
            className="rounded border border-slate-300 px-2 py-1 disabled:opacity-40"
          >
            ↶ Undo
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={future.length === 0}
            className="rounded border border-slate-300 px-2 py-1 disabled:opacity-40"
          >
            ↷ Redo
          </button>
        </div>
      </header>

      <GridWorkspace
        project={project}
        timetable={timetable}
        violations={violations}
        maps={maps}
        quota={quota}
        days={days}
      />
      </div>

      {showGenerate && <CandidateCompare onClose={() => setShowGenerate(false)} />}
      {showSubs && <SubstitutionView onClose={() => setShowSubs(false)} />}
      {showIO && <ExportImport onClose={() => setShowIO(false)} />}
      {showData && <DataManager onClose={() => setShowData(false)} />}
      {showWizard && <SetupWizard onClose={() => setShowWizard(false)} />}
    </div>
  );
}
