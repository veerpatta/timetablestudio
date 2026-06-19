import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { useMemo, useState } from "react";
import { validate } from "../../domain/validate";
import type { Constraint, Day } from "../../domain/types";
import { runGenerate } from "../../solver/fillClient";
import type { GenerateResult } from "../../solver/generate";
import { useProjectStore } from "../../store/projectStore";
import { DayGrid } from "../grid/DayGrid";
import { TeacherGrid } from "../grid/TeacherGrid";
import { WeekGrid } from "../grid/WeekGrid";
import { InsightsView } from "../insights/InsightsView";
import { ManageView } from "../manage/ManageView";
import { CellInspector, type SelectedCell } from "../panels/CellInspector";
import { ClassHealth, TeacherLoad } from "../panels/Insights";
import { FillReview } from "../panels/FillReview";
import { IssuesPanel } from "../panels/Issues";
import { ConstraintsPanel } from "../panels/ConstraintsPanel";
import { ReportsView } from "../reports/ReportsView";
import { ToolsView } from "../tools/ToolsView";

type Section = "timetable" | "requests" | "staff" | "insights" | "reports" | "tools";
type Mode = "class" | "teacher" | "day";

const DAYS: Day[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function parseCell(id: string | number) {
  const [day, slot] = String(id).split("#");
  return { day: day as Day, slot: Number(slot) };
}

export function App(): React.ReactElement {
  const store = useProjectStore();
  const {
    project,
    timetableId,
    place,
    clear,
    tryDrop,
    applyFix,
    addConstraint,
    updateConstraint,
    toggleConstraint,
    removeConstraint,
    setRequirementPeriods,
    setRequirementPreferDouble,
    undo,
    past,
  } = store;
  const timetable = project.timetables.find((t) => t.id === timetableId)!;

  const [section, setSection] = useState<Section>("timetable");
  const [mode, setMode] = useState<Mode>("class");
  const [classSel, setClassId] = useState(project.classes[0]!.id);
  const [teacherSel, setTeacherId] = useState(project.teachers.find((t) => t.schedulable)!.id);
  const [day, setDay] = useState<Day>("Mon");
  const [selected, setSelected] = useState<SelectedCell | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [fillResult, setFillResult] = useState<GenerateResult | null>(null);
  const [filling, setFilling] = useState(false);

  const classId = project.classes.some((c) => c.id === classSel) ? classSel : project.classes[0]!.id;
  const teacherId = project.teachers.some((t) => t.id === teacherSel && t.schedulable)
    ? teacherSel
    : project.teachers.find((t) => t.schedulable)!.id;
  const violations = useMemo(() => validate(project, timetable), [project, timetable]);
  const clashCount = violations.filter((v) => v.severity === "hard").length;
  const softCount = violations.filter((v) => v.severity === "soft").length;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const selectCell = (cell: SelectedCell) => {
    setSection("timetable");
    setSelected(cell);
    setFlash(null);
  };

  const addOrUpdateConstraint = (constraint: Constraint) => {
    if (project.constraints.some((c) => c.id === constraint.id)) updateConstraint(constraint);
    else addConstraint(constraint);
    setFlash("Request added as a preference. You can make it strict from Requests.");
  };

  const runFill = async (seeds: number, label: string) => {
    setFilling(true);
    setFlash(null);
    const result = await runGenerate(project, timetableId, seeds);
    setFilling(false);
    if (result.added.length === 0 && result.blockers.length === 0) {
      setFlash(`${label}: no gaps to fill.`);
      return;
    }
    setFillResult(result);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    if (!e.over) return;
    const source = { classId, ...parseCell(e.active.id) };
    const target = { classId, ...parseCell(e.over.id) };
    const r = tryDrop(source, target);
    setSelected(null);
    setFlash(r === "swapped" ? "Swapped. Both lessons stay valid." : r === "moved" ? "Moved." : "That drop would clash.");
  };

  const nav = (s: Section, label: string) => (
    <button
      onClick={() => { setSection(s); setSelected(null); }}
      className={`w-full rounded px-3 py-2 text-left text-sm ${section === s ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
    >
      {label}
    </button>
  );
  const modeBtn = (m: Mode, label: string) => (
    <button onClick={() => { setMode(m); setSelected(null); }} className={`rounded px-3 py-1.5 text-sm ${mode === m ? "bg-sky-600 text-white" : "bg-slate-100 text-slate-700"}`}>
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[180px_minmax(0,1fr)]">
        <nav aria-label="Workbench sections" className="no-print border-b border-slate-200 bg-white p-3 lg:border-b-0 lg:border-r">
          <div className="mb-4">
            <div className="text-sm font-semibold text-slate-900">Timetable Studio</div>
            <div className="text-xs text-slate-500">VPPS workbench</div>
          </div>
          <div className="grid grid-cols-3 gap-1 lg:block lg:space-y-1">
            {nav("timetable", "Timetable")}
            {nav("requests", "Requests")}
            {nav("staff", "Staff")}
            {nav("insights", "Insights")}
            {nav("reports", "Reports")}
            {nav("tools", "Tools")}
          </div>
        </nav>

        <main className="min-w-0 p-4">
          <header className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold">{project.school.name}</h1>
              <p className="text-sm text-slate-500">Real 2026-27 timetable · 8 periods · Mon-Sat</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded px-3 py-1.5 text-sm font-medium ${clashCount === 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                {clashCount === 0 ? "All clear" : `${clashCount} to fix`}
              </span>
              {softCount > 0 && <span className="rounded bg-amber-100 px-3 py-1.5 text-sm font-medium text-amber-700">{softCount} requests to improve</span>}
              <button onClick={() => runFill(8, "Fill gaps")} disabled={filling || fillResult !== null} className="rounded bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-40">
                {filling ? "Checking..." : "Fill gaps"}
              </button>
              <button onClick={() => runFill(32, "Deeper check")} disabled={filling || fillResult !== null} className="rounded border border-sky-200 bg-white px-3 py-1.5 text-sm text-sky-700 hover:bg-sky-50 disabled:opacity-40">
                Deeper check
              </button>
              <button onClick={undo} disabled={past.length === 0} className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm disabled:opacity-40">Undo</button>
            </div>
          </header>

          {fillResult && (
            <FillReview
              project={project}
              result={fillResult}
              onAccept={() => {
                const n = fillResult.added.length;
                applyFix(fillResult.project);
                setFillResult(null);
                setFlash(`Accepted ${n} suggested ${n === 1 ? "change" : "changes"}.`);
              }}
              onReject={() => { setFillResult(null); setFlash("Discarded the suggested changes."); }}
            />
          )}

          <IssuesPanel
            project={project}
            timetable={timetable}
            onJump={(c, d, slot) => { setSection("timetable"); setMode("class"); setClassId(c); selectCell({ classId: c, day: d, slot }); }}
            onFix={(next) => { applyFix(next); setSelected(null); setFlash("Fixed. You can Undo it."); }}
          />

          {flash && <p className="no-print mb-3 rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600" role="status">{flash}</p>}

          {section === "timetable" ? (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
              <section className="min-w-0 rounded border border-slate-200 bg-white">
                <div className="no-print flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-3">
                  <div className="flex gap-1">{modeBtn("class", "Class")}{modeBtn("teacher", "Teacher")}{modeBtn("day", "Day")}</div>
                  {mode === "class" ? (
                    <label className="flex items-center gap-2 text-sm">
                      <span className="text-slate-500">Class</span>
                      <select className="rounded border border-slate-300 px-2 py-1" value={classId} onChange={(e) => { setClassId(e.target.value); setSelected(null); }}>
                        {project.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                      <ClassHealth project={project} timetable={timetable} classId={classId} />
                    </label>
                  ) : mode === "teacher" ? (
                    <label className="flex items-center gap-2 text-sm">
                      <span className="text-slate-500">Teacher</span>
                      <select className="rounded border border-slate-300 px-2 py-1" value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
                        {project.teachers.filter((t) => t.schedulable).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                      <TeacherLoad project={project} timetable={timetable} teacherId={teacherId} />
                    </label>
                  ) : (
                    <label className="flex items-center gap-2 text-sm">
                      <span className="text-slate-500">Day</span>
                      <select className="rounded border border-slate-300 px-2 py-1" value={day} onChange={(e) => { setDay(e.target.value as Day); setSelected(null); }}>
                        {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </label>
                  )}
                </div>
                <div className="overflow-auto p-3">
                  {mode === "class" ? (
                    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                      <WeekGrid
                        project={project}
                        timetable={timetable}
                        classId={classId}
                        selected={selected?.classId === classId ? selected : null}
                        onSelectCell={(d, slot) => selectCell({ classId, day: d, slot })}
                        violations={violations}
                      />
                    </DndContext>
                  ) : mode === "teacher" ? (
                    <TeacherGrid
                      project={project}
                      timetable={timetable}
                      teacherId={teacherId}
                      selected={selected}
                      onSelectCell={(c, d, slot) => selectCell({ classId: c, day: d, slot })}
                    />
                  ) : (
                    <DayGrid project={project} timetable={timetable} day={day} selected={selected} violations={violations} onSelectCell={(c, d, slot) => selectCell({ classId: c, day: d, slot })} />
                  )}
                </div>
              </section>
              <CellInspector
                project={project}
                timetable={timetable}
                selected={selected}
                onPlace={(cell, subjectId, teacherIds) => { place(cell.classId, cell.day, cell.slot, subjectId, teacherIds); setSelected(null); }}
                onClear={(cell) => { clear(cell.classId, cell.day, cell.slot); setSelected(null); }}
                onSwap={(cell, target) => {
                  const r = tryDrop(cell, { classId: cell.classId, ...target });
                  setSelected(null);
                  setFlash(r === "swapped" ? "Swapped. Both lessons stay valid." : r === "moved" ? "Moved." : "Could not swap.");
                }}
                onClose={() => setSelected(null)}
                onAddConstraint={addOrUpdateConstraint}
                onSetRequirementPeriods={setRequirementPeriods}
                onSetRequirementPreferDouble={setRequirementPreferDouble}
              />
            </div>
          ) : section === "requests" ? (
            <ConstraintsPanel project={project} timetable={timetable} onAdd={addOrUpdateConstraint} onToggle={toggleConstraint} onRemove={removeConstraint} />
          ) : section === "staff" ? (
            <ManageView project={project} timetable={timetable} />
          ) : section === "insights" ? (
            <InsightsView project={project} timetable={timetable} />
          ) : section === "reports" ? (
            <ReportsView project={project} timetable={timetable} timetableId={timetableId} />
          ) : (
            <ToolsView project={project} timetable={timetable} />
          )}
        </main>
      </div>
    </div>
  );
}
