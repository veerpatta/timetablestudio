import { useEditorStore } from "../../store/editorStore";
import type { DerivedMaps } from "../../domain/derive";
import type { QuotaStatus } from "../../domain/validate";
import type { Day, Project, Timetable, Violation } from "../../domain/types";
import { TimetableGrid } from "../grid/TimetableGrid";
import { WeekGrid } from "../grid/WeekGrid";
import { ViolationsPanel } from "../panels/ViolationsPanel";
import { TeacherLoadPanel } from "../panels/TeacherLoadPanel";
import { QuotaPanel } from "../panels/QuotaPanel";
import { Glossary } from "../common/Glossary";
import { ScenarioBar } from "../scenario/ScenarioBar";
import { SwapFinder } from "../scenario/SwapFinder";

interface Props {
  project: Project;
  timetable: Timetable;
  violations: Violation[];
  maps: DerivedMaps;
  quota: QuotaStatus[];
  days: Day[];
}

export function GridWorkspace({ project, timetable, violations, maps, quota, days }: Props) {
  const { selectedDay, viewMode, gridView, weekScope } = useEditorStore();
  const { setSelectedDay, setViewMode, setGridView, setWeekScope } = useEditorStore.getState();

  const scope =
    weekScope ?? (project.classes[0] ? { kind: "class" as const, id: project.classes[0].id } : null);

  return (
    <>
      <div className="no-print px-4 pt-3 sm:px-6">
        <ScenarioBar />
      </div>
      <div className="no-print flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-2 sm:px-6">
        <div className="flex gap-1">
          {(["day", "week"] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGridView(g)}
              className={`rounded px-3 py-1 text-sm ${g === gridView ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700"}`}
            >
              {g === "day" ? "Whole school" : "One person/class"}
            </button>
          ))}
        </div>

        {gridView === "day" ? (
          <>
            <div className="flex flex-wrap gap-1" role="tablist" aria-label="Day">
              {days.map((d) => (
                <button
                  key={d}
                  type="button"
                  role="tab"
                  aria-selected={d === selectedDay}
                  onClick={() => setSelectedDay(d)}
                  className={`rounded px-3 py-1 text-sm ${d === selectedDay ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-700"}`}
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
                  className={`rounded px-3 py-1 text-sm capitalize ${m === viewMode ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700"}`}
                >
                  {m} view
                </button>
              ))}
            </div>
          </>
        ) : (
          <label className="ml-auto flex items-center gap-1 text-sm">
            Show
            <select
              value={scope ? `${scope.kind}:${scope.id}` : ""}
              onChange={(e) => {
                const [kind, id] = e.target.value.split(/:(.+)/);
                setWeekScope({ kind: kind as "class" | "teacher", id: id! });
              }}
              className="rounded border border-slate-300 px-2 py-1"
            >
              <optgroup label="Classes">
                {project.classes.map((c) => (
                  <option key={c.id} value={`class:${c.id}`}>{c.name}</option>
                ))}
              </optgroup>
              <optgroup label="Teachers">
                {project.teachers.map((t) => (
                  <option key={t.id} value={`teacher:${t.id}`}>{t.name}</option>
                ))}
              </optgroup>
            </select>
          </label>
        )}
      </div>

      <main className="grid grid-cols-1 gap-4 p-4 sm:p-6 lg:grid-cols-[1fr_320px]">
        <div className="overflow-auto rounded border border-slate-200 bg-white p-2">
          {gridView === "day" ? (
            <>
              <TimetableGrid
                project={project}
                timetable={timetable}
                day={selectedDay}
                viewMode={viewMode}
                violations={violations}
              />
              <p className="no-print mt-2 text-xs text-slate-400">
                Drag a cell to move it within the day · pin<Glossary term="pin" /> to lock it · ELGA shows as one block.
              </p>
            </>
          ) : scope ? (
            <WeekGrid project={project} timetable={timetable} scope={scope} violations={violations} />
          ) : null}
        </div>
        <aside className="no-print flex flex-col gap-4">
          {gridView === "day" && <SwapFinder project={project} timetable={timetable} />}
          <ViolationsPanel violations={violations} project={project} onJump={(d) => setSelectedDay(d)} />
          <TeacherLoadPanel project={project} maps={maps} day={selectedDay} />
          <QuotaPanel project={project} quota={quota} />
        </aside>
      </main>
    </>
  );
}
