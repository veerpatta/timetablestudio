// Setup hub (OVERHAUL C) — one home for everything configurable, in plain language: people &
// subjects (the existing ManageView), the weekly subject quotas (new), and the rules. Each is
// a reused, tested surface; this just groups them under clear tabs for a non-technical user.

import { useState } from "react";
import type { Constraint, Project, Timetable } from "../../domain/types";
import { useProjectStore } from "../../store/projectStore";
import { ConstraintsPanel } from "../panels/ConstraintsPanel";
import { ManageView } from "../manage/ManageView";
import { QuotasView } from "./QuotasView";

type Tab = "school" | "quotas" | "rules";

export function SetupHub({
  project,
  timetable,
  onAddConstraint,
}: {
  project: Project;
  timetable: Timetable;
  onAddConstraint: (c: Constraint) => void;
}): React.ReactElement {
  const store = useProjectStore();
  const [tab, setTab] = useState<Tab>("school");

  const tabBtn = (t: Tab, label: string, hint: string) => (
    <button
      onClick={() => setTab(t)}
      className={`flex-1 rounded-xl border p-3 text-left transition ${tab === t ? "border-indigo-300 bg-indigo-50" : "border-slate-200 bg-white hover:border-slate-300"}`}
    >
      <span className="block text-sm font-semibold text-slate-800">{label}</span>
      <span className="block text-xs text-slate-500">{hint}</span>
    </button>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row">
        {tabBtn("school", "People & subjects", "Classes, teachers, subjects, school day")}
        {tabBtn("quotas", "Weekly subjects", "How many periods each subject needs")}
        {tabBtn("rules", "Rules", "Preferences & must-follow constraints")}
      </div>
      <div className="ts-card p-5">
        {tab === "school" && <ManageView project={project} timetable={timetable} />}
        {tab === "quotas" && <QuotasView project={project} timetable={timetable} />}
        {tab === "rules" && (
          <ConstraintsPanel
            project={project}
            timetable={timetable}
            onAdd={onAddConstraint}
            onToggle={store.toggleConstraint}
            onRemove={store.removeConstraint}
          />
        )}
      </div>
    </div>
  );
}
