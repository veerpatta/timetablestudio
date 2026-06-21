// App shell (OVERHAUL C — green-field). A calm, guided workbench: a left sidebar for the few
// places that matter, a top bar with the one health verdict and the one primary action, and a
// content area that swaps between Home, Setup, Make-timetable, the Timetable editor, Insights,
// Reports and Tools. The proven domain/solver and the tested editor components are reused; the
// presentation and information architecture are new.

import { useMemo, useState } from "react";
import type { Constraint, Project } from "../../domain/types";
import { autoFixToFeasible } from "../../solver/autoFix";
import { analyzeFeasibility } from "../../solver/feasibility";
import { runGenerateCandidates, runSolveWithRelaxation, runTargetedRegenerate } from "../../solver/fillClient";
import type { RelaxationResult } from "../../solver/relaxation";
import type { Candidate, FeasibilityReport } from "../../solver/types";
import type { TargetedScope } from "../../solver/targetedRegenerate";
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
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [feasibility, setFeasibility] = useState<FeasibilityReport | null>(null);
  const [planning, setPlanning] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [relaxationResult, setRelaxationResult] = useState<RelaxationResult | null>(null);
  const [relaxationRunning, setRelaxationRunning] = useState(false);

  const health = useMemo(() => projectHealth(project, timetable), [project, timetable]);

  const go = (s: Section) => { setSection(s); setFlash(null); };

  const addOrUpdateConstraint = (c: Constraint) => {
    if (project.constraints.some((x) => x.id === c.id)) updateConstraint(c);
    else addConstraint(c);
    setCandidates([]);
    setFeasibility(null);
    setFlash("Request saved. Run Make timetable to apply it.");
  };

  const makeBestTimetable = async (withProject?: Project) => {
    const proj = withProject ?? project;
    setPlanning(true);
    setCandidates([]);
    setFeasibility(null);
    setRelaxationResult(null);
    setFlash(null);
    setSection("generate");
    try {
      await new Promise((r) => setTimeout(r, 0));
      const feas = analyzeFeasibility(proj, timetableId);
      setFeasibility(feas);
      if (feas.status !== "blocked") {
        const cands = await runGenerateCandidates(proj, timetableId, { seeds: 4, budgetMs: 6000 });
        setCandidates(cands);
        // M-E: if all candidates are incomplete, run the relaxation engine to try bending tier-1 rules
        const allIncomplete = cands.length > 0 && cands.every((c) => c.remainingShortfall > 0 || c.hardCount > 0);
        if (allIncomplete) {
          setRelaxationRunning(true);
          try {
            const relax = await runSolveWithRelaxation(proj, timetableId, { seeds: 4, budgetMs: 4000 });
            if (relax.step !== 1) setRelaxationResult(relax);
          } catch {
            // Relaxation failure is non-fatal — main candidates are still shown
          } finally {
            setRelaxationRunning(false);
          }
        }
      }
    } catch {
      setFlash("The planner could not finish. Check your setup and try again.");
    } finally {
      setPlanning(false);
    }
  };

  const applyCandidate = (candidate: Candidate) => {
    const n = candidate.changes.length;
    // Auto restore point BEFORE applying — survives reload, so a bad plan is always recoverable.
    store.createBackup(`Before applying plan · ${new Date().toLocaleString()}`);
    store.applyFix(candidate.project);
    setCandidates([]);
    setFeasibility(null);
    setRelaxationResult(null);
    setFlash(`Plan applied — ${n} ${n === 1 ? "cell" : "cells"} updated. A restore point was saved (Tools).`);
    setSection("timetable");
  };

  const applyRelaxed = (p: Project) => {
    store.createBackup(`Before applying relaxed plan · ${new Date().toLocaleString()}`);
    store.applyFix(p);
    setCandidates([]);
    setFeasibility(null);
    setRelaxationResult(null);
    setFlash("Relaxed plan applied — check Issues for the bent rule. A restore point was saved (Tools).");
    setSection("timetable");
  };

  const applyTweak = (tweakedProject: Project) => {
    store.createBackup(`Before applying tweak · ${new Date().toLocaleString()}`);
    store.applyFix(tweakedProject);
    void makeBestTimetable(tweakedProject);
  };

  const applyAutoFix = () => {
    const { project: fixed, appliedLabels } = autoFixToFeasible(project, timetableId);
    if (appliedLabels.length === 0) {
      setFlash("No automatic fixes could be applied. Try the individual suggestions above.");
      return;
    }
    const summary = appliedLabels.slice(0, 2).join("; ") + (appliedLabels.length > 2 ? ` (and ${appliedLabels.length - 2} more)` : "");
    store.createBackup(`Before auto-fix · ${new Date().toLocaleString()}`);
    store.applyFix(fixed);
    void makeBestTimetable(fixed);
    setFlash(`Auto-fixed ${appliedLabels.length} ${appliedLabels.length === 1 ? "issue" : "issues"}: ${summary}`);
  };

  const doTargetedRegenerate = (scope: TargetedScope) =>
    runTargetedRegenerate(project, timetableId, scope);

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
            <button onClick={() => void makeBestTimetable()} disabled={planning} className="ts-btn-primary">{planning ? "Planning…" : "Make timetable"}</button>
          </div>
        </header>

        {flash && <p className="no-print mx-6 mt-4 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-2.5 text-sm text-indigo-800" role="status">{flash}</p>}

        <div className="p-6">
          {section === "home" && <Dashboard project={project} timetable={timetable} planning={planning} onGenerate={() => void makeBestTimetable()} onGoto={go} />}
          {section === "setup" && <SetupHub project={project} timetable={timetable} onAddConstraint={addOrUpdateConstraint} />}
          {section === "generate" && (
            <GenerateView
              project={project}
              timetable={timetable}
              candidates={candidates}
              feasibility={feasibility}
              planning={planning}
              relaxationResult={relaxationResult}
              relaxationRunning={relaxationRunning}
              onGenerate={() => void makeBestTimetable()}
              onApply={applyCandidate}
              onReject={() => { setCandidates([]); setFeasibility(null); setRelaxationResult(null); setFlash("Discarded the proposed plan."); }}
              onApplyTweak={applyTweak}
              onApplyRelaxed={applyRelaxed}
              onAutoFix={applyAutoFix}
              onJumpToTimetable={() => go("timetable")}
              onTargetedRegenerate={doTargetedRegenerate}
            />
          )}
          {section === "timetable" && <TimetableWorkspace project={project} timetable={timetable} onAddConstraint={addOrUpdateConstraint} onChanged={(f) => { setCandidates([]); setFeasibility(null); setFlash(f); }} />}
          {section === "insights" && <InsightsView project={project} timetable={timetable} />}
          {section === "reports" && <ReportsView project={project} timetable={timetable} timetableId={timetableId} />}
          {section === "tools" && <ToolsView project={project} timetable={timetable} />}
        </div>
      </main>
    </div>
  );
}
