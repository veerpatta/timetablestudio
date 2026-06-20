// Generate & Review. Shows honest solver proof language: complete, best found,
// impossible, or timed out. Nothing changes until the user applies the reviewed plan.

import { coverageGaps } from "../../domain/coverage";
import { findProfile } from "../../domain/derive";
import type { Project, Timetable } from "../../domain/types";
import type { CandidateResult, ProofLevel } from "../../solver/types";
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

function proofCopy(level: ProofLevel): { title: string; body: string; tone: "good" | "warn" | "bad" } {
  switch (level) {
    case "complete":
      return { title: "Complete timetable", body: "The planner found a timetable with all required periods placed and no hard clashes.", tone: "good" };
    case "impossible":
      return { title: "Cannot satisfy these rules", body: "The planner proved that the current setup blocks generation under the active strict rules.", tone: "bad" };
    case "timeout":
      return { title: "Time limit reached", body: "The planner did not prove the best possible timetable. Review the best result found within the time limit.", tone: "warn" };
    case "best_found":
      return { title: "Best found", body: "The planner found the strongest timetable it could within this search, but it did not prove global optimality.", tone: "warn" };
  }
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
  result: CandidateResult | null;
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
  const suggestions = result?.relaxationSuggestions ?? [];
  const proof = result ? proofCopy(result.proofLevel) : null;
  const enabledRules = project.constraints.filter((c) => c.enabled).length;
  const requestsMet = result ? Math.max(0, enabledRules - result.softScore - result.hardCount) : Math.max(0, enabledRules - health.soft);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <section className="ts-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Make the timetable</h2>
            <p className="mt-1 max-w-md text-sm text-slate-500">
              The planner searches for the best timetable it can prove or find within the time limit. Nothing changes until you review and apply.
            </p>
          </div>
          <button onClick={onGenerate} disabled={planning} className="ts-btn-primary">
            {planning ? "Planning..." : result ? "Try again" : "Make timetable"}
          </button>
        </div>
      </section>

      {proof && (
        <section className={`ts-card p-5 ${proof.tone === "bad" ? "border-rose-200 bg-rose-50" : proof.tone === "warn" ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">{proof.title}</h3>
              <p className="mt-1 text-sm text-slate-600">{proof.body}</p>
            </div>
            {result && (
              <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-medium text-slate-700">
                {result.stats.triedCandidates} {result.stats.triedCandidates === 1 ? "candidate" : "candidates"} checked
              </span>
            )}
          </div>
        </section>
      )}

      <section className="ts-card grid gap-5 p-6 sm:grid-cols-3">
        <Metric value={result ? result.hardCount : health.clashes} label="clashes" hint="Double-bookings" tone={(result ? result.hardCount : health.clashes) === 0 ? "good" : "bad"} />
        <Metric value={result ? result.remainingShortfall : health.gaps} label="periods missing" hint="Required but unplaced" tone={(result ? result.remainingShortfall : health.gaps) === 0 ? "good" : "warn"} />
        <Metric value={requestsMet} label="requests met" hint="Your rules satisfied" tone="good" />
      </section>

      {!result && gaps.length > 0 && (
        <section className="ts-card p-5">
          <h3 className="mb-2 text-sm font-semibold text-slate-800">Missing required periods right now</h3>
          <ul className="space-y-1 text-sm text-slate-600">
            {gaps.slice(0, 8).map((g) => <li key={`${g.classId}#${g.subjectId}`}>- {g.message}</li>)}
            {gaps.length > 8 && <li className="text-slate-400">...and {gaps.length - 8} more</li>}
          </ul>
        </section>
      )}

      {blockers.length > 0 && (
        <section className="ts-card border-amber-200 bg-amber-50 p-5">
          <h3 className="mb-2 text-sm font-semibold text-amber-900">{result?.proofLevel === "impossible" ? "Why this cannot be generated" : "Why some requests couldn't be fully met"}</h3>
          <ul className="space-y-1 text-sm text-amber-900">
            {blockers.slice(0, 6).map((b) => <li key={b}>- {b}</li>)}
          </ul>
          {suggestions.length > 0 && (
            <>
              <h4 className="mt-4 text-sm font-semibold text-amber-900">What to change</h4>
              <ul className="mt-1 space-y-1 text-sm text-amber-900">
                {suggestions.slice(0, 4).map((s) => <li key={s}>- {s}</li>)}
              </ul>
            </>
          )}
        </section>
      )}

      {result && (
        <section className="ts-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800">Review {changes.length} {changes.length === 1 ? "change" : "changes"}</h3>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">{proof?.title ?? "Plan ready"}</span>
          </div>
          <div className="max-h-56 space-y-1 overflow-auto">
            {changes.length === 0 && <p className="text-sm text-slate-500">No changes needed - the timetable already meets your requests.</p>}
            {changes.slice(0, 30).map((c) => (
              <div key={`${c.classId}#${c.day}#${c.slot}`} className="rounded-lg border border-slate-100 px-3 py-1.5 text-xs text-slate-600">
                <span className="font-medium text-slate-800">{c.className}</span> - {c.day} {labelFor(c.slot)}: {c.before} to {c.after}
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={onApply} disabled={result.proofLevel === "impossible"} className="ts-btn-primary disabled:opacity-50">Apply this plan</button>
            <button onClick={onReject} className="ts-btn-ghost text-rose-700">Discard</button>
          </div>
        </section>
      )}
    </div>
  );
}
