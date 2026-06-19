import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { useMemo, useState } from "react";
import { constraintSentence } from "../../domain/constraints";
import { findProfile } from "../../domain/derive";
import { validate } from "../../domain/validate";
import type { Constraint, Day, Project } from "../../domain/types";
import { runPlanTimetable } from "../../solver/fillClient";
import type { PlanResult } from "../../solver/plan";
import { useProjectStore } from "../../store/projectStore";
import { DayGrid } from "../grid/DayGrid";
import { TeacherGrid } from "../grid/TeacherGrid";
import { WeekGrid } from "../grid/WeekGrid";
import { InsightsView } from "../insights/InsightsView";
import { ManageView } from "../manage/ManageView";
import { CellInspector, type SelectedCell } from "../panels/CellInspector";
import { ClassHealth, TeacherLoad } from "../panels/Insights";
import { IssuesPanel } from "../panels/Issues";
import { ConstraintsPanel } from "../panels/ConstraintsPanel";
import { ReportsView } from "../reports/ReportsView";
import { ToolsView } from "../tools/ToolsView";

type Section = "planner" | "requests" | "staff" | "insights" | "reports" | "tools";
type Mode = "class" | "teacher" | "day";

const DAYS: Day[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function parseCell(id: string | number) {
  const [day, slot] = String(id).split("#");
  return { day: day as Day, slot: Number(slot) };
}

function strengthLabel(c: Constraint): string {
  return c.severity === "must" ? "Must" : "Should";
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

  const [section, setSection] = useState<Section>("planner");
  const [mode, setMode] = useState<Mode>("class");
  const [classSel, setClassId] = useState(project.classes[0]!.id);
  const [teacherSel, setTeacherId] = useState(project.teachers.find((t) => t.schedulable)!.id);
  const [day, setDay] = useState<Day>("Mon");
  const [selected, setSelected] = useState<SelectedCell | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [planResult, setPlanResult] = useState<PlanResult | null>(null);
  const [planning, setPlanning] = useState(false);

  const classId = project.classes.some((c) => c.id === classSel) ? classSel : project.classes[0]!.id;
  const teacherId = project.teachers.some((t) => t.id === teacherSel && t.schedulable)
    ? teacherSel
    : project.teachers.find((t) => t.schedulable)!.id;
  const violations = useMemo(() => validate(project, timetable), [project, timetable]);
  const clashCount = violations.filter((v) => v.severity === "hard").length;
  const softCount = violations.filter((v) => v.severity === "soft").length;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const selectCell = (cell: SelectedCell) => {
    setSection("planner");
    setSelected(cell);
    setFlash(null);
  };

  const addOrUpdateConstraint = (constraint: Constraint) => {
    if (project.constraints.some((c) => c.id === constraint.id)) updateConstraint(constraint);
    else addConstraint(constraint);
    setPlanResult(null);
    setFlash("Request added. Click Make best timetable so the planner can apply it.");
  };

  const makeBestTimetable = async () => {
    setPlanning(true);
    setSelected(null);
    setFlash(null);
    const result = await runPlanTimetable(project, timetableId, 48);
    setPlanResult(result);
    setPlanning(false);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    if (!e.over) return;
    const source = { classId, ...parseCell(e.active.id) };
    const target = { classId, ...parseCell(e.over.id) };
    const r = tryDrop(source, target);
    setPlanResult(null);
    setSelected(null);
    setFlash(r === "swapped" ? "Swapped. Run Make best timetable to re-check requests." : r === "moved" ? "Moved. Run Make best timetable to re-check requests." : "That drop would clash.");
  };

  const activeStep = planning ? 2 : planResult ? 3 : 1;
  const workflowButton = (n: number, label: string, hint: string) => {
    const active = activeStep === n;
    return (
    <button
      onClick={() => { setSection("planner"); setSelected(null); }}
      className={`flex w-full items-start gap-3 rounded px-3 py-3 text-left ${section === "planner" && active ? "bg-blue-50 text-blue-800" : "text-slate-600 hover:bg-slate-50"}`}
    >
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${section === "planner" && active ? "bg-blue-700 text-white" : "bg-slate-200 text-slate-700"}`}>{n}</span>
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        <span className="block text-xs text-slate-500">{hint}</span>
      </span>
    </button>
    );
  };
  const nav = (s: Section, label: string) => (
    <button onClick={() => { setSection(s); setSelected(null); }} className="w-full rounded px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-100">
      {label}
    </button>
  );
  const modeBtn = (m: Mode, label: string) => (
    <button onClick={() => { setMode(m); setSelected(null); }} className={`rounded px-3 py-1.5 text-sm ${mode === m ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-700"}`}>
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[210px_minmax(0,1fr)]">
        <nav aria-label="Workbench sections" className="no-print border-b border-slate-200 bg-white p-4 lg:border-b-0 lg:border-r">
          <div className="mb-6">
            <div className="text-base font-semibold text-slate-950">Timetable Studio</div>
            <div className="text-sm text-slate-500">VPPS workbench</div>
          </div>
          <div className="space-y-2">
            {workflowButton(1, "Requests", "Define what matters")}
            {workflowButton(2, "Auto-plan", "AI creates options")}
            {workflowButton(3, "Review", "Check and refine")}
            {workflowButton(4, "Publish", "Share timetable")}
          </div>
          <div className="mt-6 border-t border-slate-200 pt-3">
            {nav("staff", "Staff")}
            {nav("requests", "Advanced requests")}
            {nav("insights", "Insights")}
            {nav("reports", "Reports")}
            {nav("tools", "Tools")}
          </div>
        </nav>

        <main className="min-w-0">
          <header className="no-print flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-normal">{project.school.name}</h1>
              <p className="text-sm text-slate-500">Real 2026-27 timetable · 8 periods · Mon-Sat</p>
            </div>
            <div className="flex flex-wrap items-start gap-3">
              <div>
                <button onClick={makeBestTimetable} disabled={planning} className="rounded bg-blue-700 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 disabled:opacity-50">
                  {planning ? "Planning..." : "Make best timetable"}
                </button>
                <p className="mt-1 text-xs text-slate-500">AI will improve the plan using your requests</p>
              </div>
              <button onClick={undo} disabled={past.length === 0} className="rounded border border-slate-300 bg-white px-4 py-3 text-sm disabled:opacity-40">Undo</button>
            </div>
          </header>

          {flash && <p className="no-print mx-5 mt-4 rounded border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-800" role="status">{flash}</p>}

          <IssuesPanel
            project={project}
            timetable={timetable}
            onJump={(c, d, slot) => { setSection("planner"); setMode("class"); setClassId(c); selectCell({ classId: c, day: d, slot }); }}
            onFix={(next) => { applyFix(next); setPlanResult(null); setSelected(null); setFlash("Fixed. Run Make best timetable to re-check requests."); }}
          />

          {section === "planner" ? (
            <div className="grid gap-4 p-5 xl:grid-cols-[220px_minmax(0,1fr)_310px]">
              <RequestsRail project={project} onAddRequest={() => { setSection("requests"); setSelected(null); }} />
              <section className="min-w-0 rounded-lg border border-slate-200 bg-white">
                <div className="no-print flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1">{modeBtn("class", "Grid")}{modeBtn("teacher", "Teacher")}{modeBtn("day", "Day")}</div>
                    {planResult && <span className="rounded bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">AI plan ready</span>}
                  </div>
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
                    <TeacherGrid project={project} timetable={timetable} teacherId={teacherId} selected={selected} onSelectCell={(c, d, slot) => selectCell({ classId: c, day: d, slot })} />
                  ) : (
                    <DayGrid project={project} timetable={timetable} day={day} selected={selected} violations={violations} onSelectCell={(c, d, slot) => selectCell({ classId: c, day: d, slot })} />
                  )}
                </div>
                <div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
                  Green markers show requests met. Yellow changes appear in the review before you apply a plan.
                </div>
              </section>
              {selected ? (
                <CellInspector
                  project={project}
                  timetable={timetable}
                  selected={selected}
                  onPlace={(cell, subjectId, teacherIds) => { place(cell.classId, cell.day, cell.slot, subjectId, teacherIds); setPlanResult(null); setSelected(null); }}
                  onClear={(cell) => { clear(cell.classId, cell.day, cell.slot); setPlanResult(null); setSelected(null); }}
                  onSwap={(cell, target) => {
                    const r = tryDrop(cell, { classId: cell.classId, ...target });
                    setPlanResult(null);
                    setSelected(null);
                    setFlash(r === "swapped" ? "Swapped. Run Make best timetable to re-check requests." : r === "moved" ? "Moved. Run Make best timetable to re-check requests." : "Could not swap.");
                  }}
                  onClose={() => setSelected(null)}
                  onAddConstraint={addOrUpdateConstraint}
                  onSetRequirementPeriods={setRequirementPeriods}
                  onSetRequirementPreferDouble={setRequirementPreferDouble}
                />
              ) : (
                <PlannerResultPanel
                  project={project}
                  result={planResult}
                  currentClashes={clashCount}
                  currentSoft={softCount}
                  onApply={() => {
                    if (!planResult) return;
                    const count = planResult.changes.length;
                    applyFix(planResult.project);
                    setFlash(`Plan applied. ${count} ${count === 1 ? "cell was" : "cells were"} updated.`);
                    setPlanResult(null);
                  }}
                  onTryAgain={makeBestTimetable}
                  onReject={() => {
                    setPlanResult(null);
                    setFlash("Discarded proposed plan.");
                  }}
                />
              )}
            </div>
          ) : section === "requests" ? (
            <div className="p-5"><ConstraintsPanel project={project} timetable={timetable} onAdd={addOrUpdateConstraint} onToggle={toggleConstraint} onRemove={removeConstraint} /></div>
          ) : section === "staff" ? (
            <div className="p-5"><ManageView project={project} timetable={timetable} /></div>
          ) : section === "insights" ? (
            <div className="p-5"><InsightsView project={project} timetable={timetable} /></div>
          ) : section === "reports" ? (
            <div className="p-5"><ReportsView project={project} timetable={timetable} timetableId={timetableId} /></div>
          ) : (
            <div className="p-5"><ToolsView project={project} timetable={timetable} /></div>
          )}
        </main>
      </div>
    </div>
  );
}

function RequestsRail({ project, onAddRequest }: { project: Project; onAddRequest: () => void }): React.ReactElement {
  return (
    <aside className="space-y-3">
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-base font-semibold">Requests</h2>
        <p className="text-sm text-slate-500">These guide the planner.</p>
        <button onClick={onAddRequest} className="mt-3 w-full rounded border border-blue-500 px-3 py-2 text-sm font-medium text-blue-700">+ Add request</button>
      </section>
      {project.constraints.length === 0 ? (
        <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
          Add requests from any timetable cell, or use Advanced requests for more choices.
        </section>
      ) : (
        project.constraints.slice(0, 6).map((c) => (
          <section key={c.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-3 text-sm font-semibold leading-6">
              {constraintSentence(project, c)} <span className="ml-1 rounded bg-violet-100 px-2 py-0.5 text-xs text-violet-700">{strengthLabel(c)}</span>
            </div>
            <div className="text-xs font-medium text-emerald-700">{c.enabled ? "Ready for planning" : "Paused"}</div>
          </section>
        ))
      )}
      <p className="rounded bg-blue-50 p-3 text-xs text-blue-700">Requests are applied in order of importance: Must first, then Should.</p>
    </aside>
  );
}

function PlannerResultPanel({
  project,
  result,
  currentClashes,
  currentSoft,
  onApply,
  onTryAgain,
  onReject,
}: {
  project: Project;
  result: PlanResult | null;
  currentClashes: number;
  currentSoft: number;
  onApply: () => void;
  onTryAgain: () => void;
  onReject: () => void;
}): React.ReactElement {
  const changes = result ? result.changes : [];
  const blockers = result?.blockers ?? [];
  const timetable = result?.project.timetables.find((t) => t.id === result.project.activeTimetableId);
  const profile = result && timetable ? findProfile(result.project, timetable) : null;
  const labelFor = (slot: number) => profile?.slots.find((s) => s.index === slot)?.label ?? `P${slot}`;
  return (
    <aside className="rounded-lg border border-slate-200 bg-white" role="region" aria-label="Planner result">
      <div className="border-b border-slate-200 p-4">
        <h2 className="text-base font-semibold">Planner result</h2>
      </div>
      <div className="space-y-4 p-4">
        <Metric value={result ? result.hardCount : currentClashes} label="clashes" hint="No teacher or room clashes" tone={(result ? result.hardCount : currentClashes) === 0 ? "good" : "bad"} />
        <Metric value={result ? result.improvedRequests : Math.max(0, project.constraints.length - currentSoft)} label="requests improved" hint="Compared to the current plan" tone="good" />
        <Metric value={result ? result.blockedRequests : currentSoft} label="requests not fully possible" hint="Need your review" tone={(result ? result.blockedRequests : currentSoft) === 0 ? "good" : "warn"} />

        {blockers.length > 0 && (
          <section className="rounded bg-amber-50 p-3">
            <h3 className="mb-2 text-sm font-semibold">Why some requests could not be fully met</h3>
            <ul className="space-y-1 text-sm text-slate-700">
              {blockers.slice(0, 4).map((b) => <li key={b}>{b}</li>)}
            </ul>
          </section>
        )}

        <section>
          <h3 className="mb-2 text-sm font-semibold">Review changes</h3>
          {result ? (
            <div className="space-y-2 text-sm">
              <div className="rounded bg-slate-50 p-2">{changes.length} changed {changes.length === 1 ? "cell" : "cells"}</div>
              <div className="max-h-36 space-y-1 overflow-auto">
                {changes.slice(0, 8).map((c) => (
                  <div key={`${c.classId}#${c.day}#${c.slot}`} className="rounded border border-slate-100 px-2 py-1 text-xs">
                    <span className="font-medium">{c.className}</span> {c.day} {labelFor(c.slot)}: {c.before} to {c.after}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Run Make best timetable to see proposed changes before applying them.</p>
          )}
        </section>

        <button onClick={onApply} disabled={!result} className="w-full rounded bg-blue-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40">
          Apply this plan
        </button>
        <button onClick={onReject} disabled={!result} className="w-full rounded border border-rose-200 px-4 py-3 text-sm font-medium text-rose-700 disabled:opacity-40">
          Reject
        </button>
        <button onClick={onTryAgain} className="w-full rounded border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700">
          Try again
        </button>
      </div>
    </aside>
  );
}

function Metric({ value, label, hint, tone }: { value: number; label: string; hint: string; tone: "good" | "warn" | "bad" }): React.ReactElement {
  const color = tone === "good" ? "text-emerald-700" : tone === "warn" ? "text-amber-700" : "text-rose-700";
  return (
    <div className="flex items-center gap-3">
      <div className={`text-3xl font-semibold ${color}`}>{value}</div>
      <div>
        <div className="text-sm font-semibold">{label}</div>
        <div className="text-xs text-slate-500">{hint}</div>
      </div>
    </div>
  );
}
