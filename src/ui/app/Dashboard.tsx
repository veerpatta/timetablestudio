// Home dashboard (OVERHAUL C) — the first thing a non-technical user sees: a single clear
// health verdict, the one main action, a guided 4-step checklist, and at-a-glance counts.

import { coverageGaps } from "../../domain/coverage";
import type { Project, Timetable } from "../../domain/types";
import { projectHealth } from "./status";
import type { Section } from "./sections";

const STATE_STYLE: Record<string, { ring: string; dot: string; chip: string }> = {
  ready: { ring: "border-emerald-200 bg-emerald-50", dot: "bg-emerald-500", chip: "text-emerald-700" },
  incomplete: { ring: "border-amber-200 bg-amber-50", dot: "bg-amber-500", chip: "text-amber-700" },
  clashes: { ring: "border-rose-200 bg-rose-50", dot: "bg-rose-500", chip: "text-rose-700" },
};

export function Dashboard({
  project,
  timetable,
  planning,
  onGenerate,
  onGoto,
}: {
  project: Project;
  timetable: Timetable;
  planning: boolean;
  onGenerate: () => void;
  onGoto: (s: Section) => void;
}): React.ReactElement {
  const health = projectHealth(project, timetable);
  const gaps = coverageGaps(project, timetable);
  const style = STATE_STYLE[health.state]!;
  const schedulable = project.teachers.filter((t) => t.schedulable).length;

  const steps: { n: number; title: string; hint: string; section: Section }[] = [
    { n: 1, title: "Set up your school", hint: "Classes, teachers, subjects & the school day", section: "setup" },
    { n: 2, title: "Set weekly subjects & rules", hint: "How many periods each subject needs, plus any rules", section: "setup" },
    { n: 3, title: "Make the timetable", hint: "Let the planner fill it in, then review", section: "generate" },
    { n: 4, title: "Review & publish", hint: "Fine-tune cells, then print or export", section: "timetable" },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <section className={`ts-card border ${style.ring} p-6`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className={`mt-1 h-3 w-3 shrink-0 rounded-full ${style.dot}`} />
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Timetable status</div>
              <div className={`text-2xl font-semibold ${style.chip}`}>{health.label}</div>
              <p className="mt-1 text-sm text-slate-600">
                {health.state === "ready" && "Every class has all its required periods with no clashes."}
                {health.state === "incomplete" && "Some required periods aren't placed yet. Make the timetable to fill them."}
                {health.state === "clashes" && "There are double-bookings to resolve. Open the timetable to fix them."}
              </p>
            </div>
          </div>
          <button onClick={onGenerate} disabled={planning} className="ts-btn-primary">
            {planning ? "Planning…" : "Make timetable"}
          </button>
        </div>
        {health.state === "incomplete" && gaps.length > 0 && (
          <ul className="mt-4 grid gap-1 text-sm text-slate-600 sm:grid-cols-2">
            {gaps.slice(0, 6).map((g) => <li key={`${g.classId}#${g.subjectId}`}>• {g.message}</li>)}
          </ul>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-5">
        {[
          { label: "Classes", value: project.classes.length, section: "setup" as Section },
          { label: "Teachers", value: schedulable, section: "setup" as Section },
          { label: "Subjects", value: project.subjects.length, section: "setup" as Section },
          { label: "Rules", value: project.constraints.filter((c) => c.enabled && c.severity === "must").length, section: "setup" as Section },
          { label: "Preferences", value: project.constraints.filter((c) => c.enabled && c.severity === "prefer").length, section: "setup" as Section },
        ].map((s) => (
          <button key={s.label} onClick={() => onGoto(s.section)} className="ts-card p-4 text-left transition hover:border-indigo-300">
            <div className="text-2xl font-semibold text-slate-900 tabular-nums">{s.value}</div>
            <div className="text-sm text-slate-500">{s.label}</div>
          </button>
        ))}
      </section>

      <section className="ts-card p-6">
        <h2 className="text-base font-semibold text-slate-900">How it works</h2>
        <p className="text-sm text-slate-500">Four steps from an empty plan to a published timetable.</p>
        <ol className="mt-4 space-y-2">
          {steps.map((s) => (
            <li key={s.n}>
              <button onClick={() => onGoto(s.section)} className="flex w-full items-center gap-4 rounded-xl border border-slate-100 p-3 text-left transition hover:border-indigo-300 hover:bg-indigo-50/40">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white">{s.n}</span>
                <span>
                  <span className="block text-sm font-semibold text-slate-800">{s.title}</span>
                  <span className="block text-xs text-slate-500">{s.hint}</span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
