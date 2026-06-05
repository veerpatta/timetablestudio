import { useEffect, useState } from "react";
import { useProjectStore } from "../../store/projectStore";
import { useEditorStore } from "../../store/editorStore";
import { useUiStore } from "../../store/uiStore";
import { useDerived } from "./hooks";
import { useHashRoute } from "./useHashRoute";
import { Sidebar } from "./Sidebar";
import { Tour } from "./Tour";
import { nextStep } from "../../solver/guidance";
import { GridWorkspace } from "./GridWorkspace";
import { DraftSwitcher } from "./DraftSwitcher";
import { CompleteButton } from "../solverui/CompleteButton";
import { CandidateCompare } from "../solverui/CandidateCompare";
import { SubstitutionView } from "../substitution/SubstitutionView";
import { ExportImport } from "../io/ExportImport";
import { EmptyState } from "./EmptyState";
import { RecoveryScreen } from "./RecoveryScreen";
import { SetupWizard } from "../manage/SetupWizard";
import { QuotaMatrix } from "../manage/QuotaMatrix";
import { ClassesPage, TeachersPage, SettingsPage, BlocksPage } from "../manage/ManagePages";
import { RulesPage } from "../manage/RulesPage";

export function App() {
  const init = useProjectStore((s) => s.init);
  const loadDemo = useProjectStore((s) => s.loadDemo);
  const initialized = useProjectStore((s) => s.initialized);
  const storageStatus = useProjectStore((s) => s.storageStatus);
  const saveFailed = useProjectStore((s) => s.saveFailed);
  const bundledStale = useProjectStore((s) => s.bundledStale);
  const adoptBundled = useProjectStore((s) => s.adoptBundled);
  const dismissStale = useProjectStore((s) => s.dismissStale);
  const restorePrevious = useProjectStore((s) => s.restorePrevious);
  const project = useProjectStore((s) => s.project);
  const [undoKey, setUndoKey] = useState<string | null>(null);
  const derived = useDerived();
  const [view, navigate] = useHashRoute();
  const [showGenerate, setShowGenerate] = useState(false);
  const [showIO, setShowIO] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const { past, future } = useEditorStore();
  const { undo, redo } = useEditorStore.getState();
  const advanced = useUiStore((s) => s.advanced);
  const toggleAdvanced = useUiStore((s) => s.toggleAdvanced);

  useEffect(() => {
    void init();
  }, [init]);

  // Storage wedged/erroring — show a recovery screen, never an endless spinner.
  if (storageStatus === "error") {
    return <RecoveryScreen variant="storage-error" />;
  }
  if (!initialized) {
    // Bounded: init() always settles within the storage timeout (~3s) and flips
    // this to ready/error, so this spinner can't linger.
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
    // Project loaded but its active timetable is missing (corrupt/truncated
    // save). Don't strand on a spinner — offer backup + start-fresh.
    return <RecoveryScreen variant="corrupt-data" project={project} />;
  }
  const { timetable, violations, maps, quota } = derived;
  const hardCount = violations.filter((v) => v.severity === "hard").length;
  const days = project.profiles.find((p) => p.id === timetable.profileId)?.days ?? [];
  const hint = nextStep(project, timetable.id, hardCount);
  const onHint = () => {
    if (!hint) return;
    if (hint.cta === "Create timetable") setShowGenerate(true);
    else navigate(hint.view);
  };
  const onUpdateBundled = async () => {
    const ok = await adoptBundled();
    if (ok) setUndoKey(useProjectStore.getState().lastPreviousKey);
  };
  const onUndoUpdate = async () => {
    if (undoKey) await restorePrevious(undoKey);
    setUndoKey(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="app-shell">
      {saveFailed && (
        <div
          role="alert"
          className="no-print flex flex-wrap items-center justify-between gap-2 bg-amber-100 px-4 py-2 text-sm text-amber-900 sm:px-6"
        >
          <span>
            Your changes aren't being saved to this browser right now. Download a backup so you
            don't lose your work.
          </span>
          <button
            type="button"
            onClick={() => setShowIO(true)}
            className="rounded border border-amber-400 bg-white px-2 py-1 font-medium hover:bg-amber-50"
          >
            Download a backup
          </button>
        </div>
      )}
      {bundledStale && (
        <div
          role="alert"
          className="no-print flex flex-wrap items-center justify-between gap-2 bg-indigo-100 px-4 py-2 text-sm text-indigo-900 sm:px-6"
        >
          <span>
            The built-in school timetable has been updated. Load the latest? Your current
            timetable is kept as a draft you can restore anytime.
          </span>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => void onUpdateBundled()}
              className="rounded bg-indigo-600 px-2 py-1 font-medium text-white hover:bg-indigo-700"
            >
              Update timetable
            </button>
            <button
              type="button"
              onClick={dismissStale}
              className="rounded border border-indigo-400 bg-white px-2 py-1 font-medium hover:bg-indigo-50"
            >
              Not now
            </button>
          </div>
        </div>
      )}
      {undoKey && (
        <div
          role="status"
          className="no-print flex flex-wrap items-center justify-between gap-2 bg-emerald-100 px-4 py-2 text-sm text-emerald-900 sm:px-6"
        >
          <span>
            Updated to the latest school timetable. Your previous timetable is saved as a draft.
          </span>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => void onUndoUpdate()}
              className="rounded border border-emerald-500 bg-white px-2 py-1 font-medium hover:bg-emerald-50"
            >
              Undo
            </button>
            <button
              type="button"
              onClick={() => setUndoKey(null)}
              aria-label="Dismiss"
              className="rounded border border-emerald-400 bg-white px-2 py-1 font-medium hover:bg-emerald-50"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
      {hint && (
        <button
          type="button"
          onClick={onHint}
          className="no-print flex w-full items-center justify-between gap-2 border-b border-indigo-100 bg-indigo-50 px-4 py-1.5 text-left text-sm text-indigo-900 hover:bg-indigo-100 sm:px-6"
        >
          <span>
            <span className="font-medium">Next step:</span> {hint.message}
          </span>
          <span className="shrink-0 font-medium text-indigo-700">{hint.cta} →</span>
        </button>
      )}
      <header className="no-print flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-lg font-semibold">Timetable Studio</h1>
            <p className="text-xs text-slate-500">
              {project.school.name} ·{" "}
              {hardCount === 0 ? (
                <span className="text-emerald-600">Ready — no conflicts</span>
              ) : (
                <span className="text-hard">
                  {hardCount} {hardCount === 1 ? "conflict" : "conflicts"} to fix
                </span>
              )}
            </p>
          </div>
          <DraftSwitcher />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
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

      <div className="sm:flex">
        <Sidebar view={view} onNavigate={navigate} />
        <main className="min-w-0 flex-1">
          {view === "timetable" && (
            <GridWorkspace
              project={project}
              timetable={timetable}
              violations={violations}
              maps={maps}
              quota={quota}
              days={days}
            />
          )}
          {view === "teachers" && <TeachersPage />}
          {view === "classes" && <ClassesPage />}
          {view === "quotas" && <QuotaMatrix />}
          {view === "blocks" && <BlocksPage />}
          {view === "rules" && <RulesPage />}
          {view === "substitutions" && <SubstitutionView />}
          {view === "settings" && (
            <SettingsPage onStartDifferent={() => setShowWizard(true)} />
          )}
        </main>
      </div>
      </div>

      {showGenerate && <CandidateCompare onClose={() => setShowGenerate(false)} />}
      {showIO && <ExportImport onClose={() => setShowIO(false)} />}
      {showWizard && <SetupWizard onClose={() => setShowWizard(false)} />}
      <Tour />
    </div>
  );
}
