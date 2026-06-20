// Generate & Review (OVERHAUL C). One clear screen: a big "Make timetable" action, an honest
// before/after summary (clashes, completeness, preferences), the plain-language reasons any
// request couldn't be met, and the reviewable change list — apply only after you've seen it.

import { coverageGaps } from "../../domain/coverage";
import { findProfile } from "../../domain/derive";
import type { Project, Timetable } from "../../domain/types";
import type { PlanResult } from "../../solver/plan";
import { projectHealth } from "./status";

function Metric({ value, label, hint, tone }: { value: number | string; label: string; hint: string; tone: "good" | "warn" | "bad" }): React.ReactElement {
  const color = tone === "good" ? "text-emerald-600" : tone === "warn" ? "text-amber-600" : "text-rose-600";
  return (
    <div className="flex items-center gap-3">
      <div className={`text-3xl font-semibold tabular-nums ${color}`}>{value}</div>
      <div>
        <div className="text-sm font-semibold text-slate-800">{label}</div>
        <div className="text-xs text-slate-500">{hint}</div>
      </div>
    </div>
  );
}

export function GenerateView({
  project,
  timetable,
  result,
  planning,
  onGenerate,
  onApply,
  onReject,
}: {
  project: Project;
  timetable: Timetable;
  result: PlanResult | null;
  planning: boolean;
  onGenerate: () => void;
  onApply: () => void;
  onReject: () => void;
}): React.ReactElement {
  const health = projectHealth(project, timetable);
  const gaps = coverageGaps(project, timetable);
  const profile = findProfile(project, timetable);
  const labelFor = (slot: number) => profile?.slots.find((s) => s.index === slot)?.label ?? `P${slot}`;
  const changes = result?.changes ?? [];
  const blockers = result?.blockers ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <section className="ts-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Make the timetable</h2>
            <p className="mt-1 max-w-md text-sm text-slate-500">
              The planner fills every required period it can, keeps your locked lessons, and respects your rules. Nothing changes until you review and apply.
            </p>
          </div>
          <button onClick={onGenerate} disabled={planning} className="ts-btn-primary">
            {planning ? "Planning…" : result ? "Try again" : "Make timetable"}
          </button>
        </div>
      </section>

      <section className="ts-card grid gap-5 p-6 sm:grid-cols-3">
        <Metric value={result ? result.hardCount : health.clashes} label="clashes" hint="Double-bookings" tone={(result ? result.hardCount : health.clashes) === 0 ? "good" : "bad"} />
        <Metric value={result ? result.remainingShortfall : health.gaps} label="periods missing" hint="Required but unplaced" tone={(result ? result.remainingShortfall : health.gaps) === 0 ? "good" : "warn"} />
        <Metric value={result ? result.improvedRequests : Math.max(0, project.constraints.filter((c) => c.enabled).length - health.soft)} label="requests met" hint="Your rules satisfied" tone="good" />
      </section>

      {!result && gaps.length > 0 && (
        <section className="ts-card p-5">
          <h3 className="mb-2 text-sm font-semibold text-slate-800">Missing required periods right now</h3>
          <ul className="space-y-1 text-sm text-slate-600">
            {gaps.slice(0, 8).map((g) => <li key={`${g.classId}#${g.subjectId}`}>• {g.message}</li>)}
            {gaps.length > 8 && <li className="text-slate-400">…and {gaps.length - 8} more</li>}
          </ul>
        </section>
      )}

      {blockers.length > 0 && (
        <section className="ts-card border-amber-200 bg-amber-50 p-5">
          <h3 className="mb-2 text-sm font-semibold text-amber-900">Why some requests couldn't be fully met</h3>
          <ul className="space-y-1 text-sm text-amber-900">
            {blockers.slice(0, 6).map((b) => <li key={b}>• {b}</li>)}
          </ul>
        </section>
      )}

      {result && (
        <section className="ts-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800">Review {changes.length} {changes.length === 1 ? "change" : "changes"}</h3>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">Plan ready</span>
          </div>
          <div className="max-h-56 space-y-1 overflow-auto">
            {changes.length === 0 && <p className="text-sm text-slate-500">No changes needed — the timetable already meets your requests.</p>}
            {changes.slice(0, 30).map((c) => (
              <div key={`${c.classId}#${c.day}#${c.slot}`} className="rounded-lg border border-slate-100 px-3 py-1.5 text-xs text-slate-600">
                <span className="font-medium text-slate-800">{c.className}</span> · {c.day} {labelFor(c.slot)}: {c.before} → {c.after}
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={onApply} className="ts-btn-primary">Apply this plan</button>
            <button onClick={onReject} className="ts-btn-ghost text-rose-700">Discard</button>
          </div>
        </section>
      )}
    </div>
  );
}
