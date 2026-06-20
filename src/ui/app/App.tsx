// App shell (OVERHAUL C — green-field). A calm, guided workbench: a left sidebar for the few
// places that matter, a top bar with the one health verdict and the one primary action, and a
// content area that swaps between Home, Setup, Make-timetable, the Timetable editor, Insights,
// Reports and Tools. The proven domain/solver and the tested editor components are reused; the
// presentation and information architecture are new.

import { useMemo, useState } from "react";
import type { Constraint } from "../../domain/types";
import { runPlanTimetable } from "../../solver/fillClient";
import type { PlanResult } from "../../solver/plan";
import { useProjectStore } from "../../store/projectStore";
import { InsightsView } from "../insights/InsightsView";
import { ReportsView } from "../reports/ReportsView";
import { SetupHub } from "../setup/SetupHub";
import { ToolsView } from "../tools/ToolsView";
import { Dashboard } from "./Dashboard";
import { GenerateView } from "./GenerateView";
import { SECTIONS, type Section } from "./sections";
import { projectHealth } from "./status";
import { TimetableWorkspace } from "./TimetableWorkspace";

const TONE_DOT: Record<string, string> = { good: "bg-emerald-500", warn: "bg-amber-500", bad: "bg-rose-500" };

export function App(): React.ReactElement {
  const store = useProjectStore();
  const { project, timetableId, undo, past, addConstraint, updateConstraint } = store;
  const timetable = project.timetables.find((t) => t.id === timetableId)!;

  const [section, setSection] = useState<Section>("home");
  const [planResult, setPlanResult] = useState<PlanResult | null>(null);
  const [planning, setPlanning] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const health = useMemo(() => projectHealth(project, timetable), [project, timetable]);

  const go = (s: Section) => { setSection(s); setFlash(null); };

  const addOrUpdateConstraint = (c: Constraint) => {
    if (project.constraints.some((x) => x.id === c.id)) updateConstraint(c);
    else addConstraint(c);
    setPlanResult(null);
    setFlash("Rule saved. Run Make timetable to apply it.");
  };

  const makeBestTimetable = async () => {
    setPlanning(true);
    setPlanResult(null);
    setFlash(null);
    setSection("generate");
    try {
      await new Promise((r) => setTimeout(r, 0));
      setPlanResult(await runPlanTimetable(project, timetableId, 8));
    } catch {
      setFlash("The planner could not finish. Check your setup and try again.");
    } finally {
      setPlanning(false);
    }
  };

  const applyPlan = () => {
    if (!planResult) return;
    const n = planResult.changes.length;
    store.applyFix(planResult.project);
    setPlanResult(null);
    setFlash(`Plan applied — ${n} ${n === 1 ? "cell" : "cells"} updated.`);
    setSection("timetable");
  };

  const navBtn = (s: Section, label: string) => (
    <button
      key={s}
      onClick={() => go(s)}
      className={`w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition ${section === s ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}
    >
      {label}
    </button>
  );

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)]">
      <nav aria-label="Sections" className="no-print flex flex-col gap-1 border-b border-slate-200 bg-white p-4 lg:border-b-0 lg:border-r">
        <div className="mb-4">
          <div className="text-base font-semibold text-slate-900">Timetable Studio</div>
          <div className="text-xs text-slate-500">{project.school.name}</div>
        </div>
        {SECTIONS.filter((s) => s.group === "main").map((s) => navBtn(s.id, s.label))}
        <div className="my-3 border-t border-slate-200" />
        {SECTIONS.filter((s) => s.group === "more").map((s) => navBtn(s.id, s.label))}
        <div className="mt-auto pt-4">
          <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <span className={`h-2.5 w-2.5 rounded-full ${TONE_DOT[health.tone]}`} />
            <span className="text-slate-600">{health.label}</span>
          </div>
        </div>
      </nav>

      <main className="min-w-0">
        <header className="no-print flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-4">
          <div className="flex items-center gap-3">
            <span className={`h-3 w-3 rounded-full ${TONE_DOT[health.tone]}`} aria-hidden />
            <div>
              <h1 className="text-lg font-semibold text-slate-900">{SECTIONS.find((s) => s.id === section)?.label}</h1>
              <p className="text-xs text-slate-500">{health.label}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={undo} disabled={past.length === 0} className="ts-btn-ghost">Undo</button>
            <button onClick={makeBestTimetable} disabled={planning} className="ts-btn-primary">{planning ? "Planning…" : "Make timetable"}</button>
          </div>
        </header>

        {flash && <p className="no-print mx-6 mt-4 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-2.5 text-sm text-indigo-800" role="status">{flash}</p>}

        <div className="p-6">
          {section === "home" && <Dashboard project={project} timetable={timetable} planning={planning} onGenerate={makeBestTimetable} onGoto={go} />}
          {section === "setup" && <SetupHub project={project} timetable={timetable} onAddConstraint={addOrUpdateConstraint} />}
          {section === "generate" && (
            <GenerateView project={project} timetable={timetable} result={planResult} planning={planning} onGenerate={makeBestTimetable} onApply={applyPlan} onReject={() => { setPlanResult(null); setFlash("Discarded the proposed plan."); }} />
          )}
          {section === "timetable" && <TimetableWorkspace project={project} timetable={timetable} onAddConstraint={addOrUpdateConstraint} onChanged={(f) => { setPlanResult(null); setFlash(f); }} />}
          {section === "insights" && <InsightsView project={project} timetable={timetable} />}
          {section === "reports" && <ReportsView project={project} timetable={timetable} timetableId={timetableId} />}
          {section === "tools" && <ToolsView project={project} timetable={timetable} />}
        </div>
      </main>
    </div>
  );
}
