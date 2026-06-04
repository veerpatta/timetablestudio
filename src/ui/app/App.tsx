import { useEffect } from "react";
import { useProjectStore } from "../../store/projectStore";
import { useEditorStore } from "../../store/editorStore";
import { useDerived } from "./hooks";
import { TimetableGrid } from "../grid/TimetableGrid";
import { ViolationsPanel } from "../panels/ViolationsPanel";
import { TeacherLoadPanel } from "../panels/TeacherLoadPanel";
import { QuotaPanel } from "../panels/QuotaPanel";
import { CompleteButton } from "../solverui/CompleteButton";

export function App() {
  const init = useProjectStore((s) => s.init);
  const derived = useDerived();
  const { selectedDay, viewMode, past, future } = useEditorStore();
  const { setSelectedDay, setViewMode, undo, redo } = useEditorStore.getState();

  useEffect(() => {
    void init();
  }, [init]);

  if (!derived) {
    return <div className="p-6 text-slate-500">Loading…</div>;
  }
  const { project, timetable, violations, maps, quota } = derived;
  const days = project.profiles.find((p) => p.id === timetable.profileId)?.days ?? [];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
        <div>
          <h1 className="text-lg font-semibold">Timetable Studio</h1>
          <p className="text-xs text-slate-500">
            {project.school.name} · <span className="text-slate-400">{timetable.name}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <CompleteButton />
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

      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-6 py-2">
        <div className="flex gap-1" role="tablist" aria-label="Day">
          {days.map((d) => (
            <button
              key={d}
              type="button"
              role="tab"
              aria-selected={d === selectedDay}
              onClick={() => setSelectedDay(d)}
              className={`rounded px-3 py-1 text-sm ${
                d === selectedDay ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-700"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-1">
          {(["class", "teacher"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setViewMode(m)}
              className={`rounded px-3 py-1 text-sm capitalize ${
                m === viewMode ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700"
              }`}
            >
              {m} view
            </button>
          ))}
        </div>
      </div>

      <main className="grid grid-cols-1 gap-4 p-6 lg:grid-cols-[1fr_320px]">
        <div className="overflow-auto rounded border border-slate-200 bg-white p-2">
          <TimetableGrid
            project={project}
            timetable={timetable}
            day={selectedDay}
            viewMode={viewMode}
            violations={violations}
          />
          <p className="mt-2 text-xs text-slate-400">
            Drag a cell to move it within the day · 📍/📌 to pin · ELGA moves as one block.
          </p>
        </div>
        <aside className="flex flex-col gap-4">
          <ViolationsPanel violations={violations} />
          <TeacherLoadPanel project={project} maps={maps} day={selectedDay} />
          <QuotaPanel project={project} quota={quota} />
        </aside>
      </main>
    </div>
  );
}
