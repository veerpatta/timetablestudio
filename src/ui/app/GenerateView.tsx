// Generate & Compare (M27/M28). Shows multi-candidate results with pros/cons, a compare
// table, the impossible path with one-click relaxation, and targeted re-plan for a
// specific class/teacher/day. Nothing changes until the owner applies.

import { useState } from "react";
import { coverageGaps } from "../../domain/coverage";
import { findProfile } from "../../domain/derive";
import type { Project, Timetable } from "../../domain/types";
import type { Candidate, CandidateResult, FeasibilityReport, Verdict } from "../../solver/types";
import type { ScopeType, TargetedScope } from "../../solver/targetedRegenerate";
import { projectHealth } from "./status";

// ── Helpers ──────────────────────────────────────────────────────────────────

function verdictTitle(v: Verdict | "Proven impossible"): string {
  switch (v) {
    case "Complete": return "Complete timetable";
    case "Best found": return "Best found";
    case "Likely impossible": return "Likely impossible";
    case "Proven impossible": return "Cannot satisfy these rules";
    case "Timed out": return "Time limit reached";
  }
}

function verdictBody(v: Verdict | "Proven impossible"): string {
  switch (v) {
    case "Complete": return "The planner found a timetable with all required periods placed and no hard clashes.";
    case "Best found": return "The planner found the strongest timetable it could within this search, but it did not prove global optimality.";
    case "Likely impossible": return "The planner couldn't reach a valid timetable. The setup may be over-constrained — review the suggestions below.";
    case "Proven impossible": return "The planner proved that the current setup blocks generation under the active strict rules.";
    case "Timed out": return "The planner did not prove the best possible timetable. Review the best result found within the time limit.";
  }
}

function verdictTone(v: Verdict | "Proven impossible"): "good" | "warn" | "bad" {
  if (v === "Complete") return "good";
  if (v === "Proven impossible" || v === "Likely impossible") return "bad";
  return "warn";
}

function bandColor(band: string): string {
  if (band === "Great") return "text-emerald-700 bg-emerald-50";
  if (band === "Good") return "text-indigo-700 bg-indigo-50";
  if (band === "Fair") return "text-amber-700 bg-amber-50";
  return "text-rose-700 bg-rose-50";
}

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

function CompareRow({ label, values, highlight }: { label: string; values: string[]; highlight?: "lower" | "higher" }): React.ReactElement {
  const nums = values.map(Number);
  const isNumeric = values.every((v) => !isNaN(Number(v)));
  const best = isNumeric && highlight === "lower" ? Math.min(...nums) : isNumeric && highlight === "higher" ? Math.max(...nums) : null;
  return (
    <tr>
      <td className="py-1.5 pr-4 text-xs text-slate-500">{label}</td>
      {values.map((v, i) => {
        const isBest = best !== null && isNumeric && Number(v) === best;
        return (
          <td key={i} className={`py-1.5 pr-4 text-xs ${isBest ? "font-semibold text-emerald-700" : "text-slate-700"}`}>
            {v}
          </td>
        );
      })}
    </tr>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function GenerateView({
  project,
  timetable,
  candidates,
  feasibility,
  planning,
  onGenerate,
  onApply,
  onReject,
  onApplyTweak,
  onJumpToTimetable,
  onTargetedRegenerate,
}: {
  project: Project;
  timetable: Timetable;
  candidates: Candidate[];
  feasibility: FeasibilityReport | null;
  planning: boolean;
  onGenerate: () => void;
  onApply: (c: Candidate) => void;
  onReject: () => void;
  onApplyTweak: (p: Project) => void;
  onJumpToTimetable: () => void;
  onTargetedRegenerate: (scope: TargetedScope) => Promise<CandidateResult>;
}): React.ReactElement {
  const [activeIdx, setActiveIdx] = useState(0);
  const [compareOpen, setCompareOpen] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  // Targeted regenerate state (M28)
  const [targetedOpen, setTargetedOpen] = useState(false);
  const [targetedScopeType, setTargetedScopeType] = useState<ScopeType>("class");
  const [targetedEntityId, setTargetedEntityId] = useState<string>("");
  const [targetedResult, setTargetedResult] = useState<CandidateResult | null>(null);
  const [targetedRunning, setTargetedRunning] = useState(false);

  const health = projectHealth(project, timetable);
  const gaps = coverageGaps(project, timetable);
  const labelFor = (slot: number) => profile?.slots.find((s) => s.index === slot)?.label ?? `P${slot}`;
  const enabledRules = project.constraints.filter((c) => c.enabled).length;

  // Active candidate (clamped so stale idx is never out of bounds)
  const safeIdx = candidates.length > 0 ? Math.min(activeIdx, candidates.length - 1) : 0;
  const active = candidates[safeIdx];

  // Metrics: use active candidate when available, fall back to current health
  const clashes = active ? active.hardCount : health.clashes;
  const missing = active ? active.remainingShortfall : health.gaps;
  const requestsMet = active
    ? Math.max(0, enabledRules - active.softScore - active.hardCount)
    : Math.max(0, enabledRules - health.soft);

  // Overall verdict for the banner (M28: "Likely impossible" when all have shortfall)
  const allIncomplete = candidates.length > 0 && candidates.every((c) => c.remainingShortfall > 0 || c.hardCount > 0);
  type OverallVerdict = Verdict | "Proven impossible";
  const overallVerdict: OverallVerdict | null = feasibility?.status === "blocked"
    ? "Proven impossible"
    : candidates.some((c) => c.verdict === "Complete")
    ? "Complete"
    : allIncomplete
    ? "Likely impossible"
    : candidates.length > 0
    ? "Best found"
    : null;

  // Targeted regenerate entities for the current scope type
  const profile = findProfile(project, timetable);
  const targetedEntities: { id: string; name: string }[] =
    targetedScopeType === "class" ? project.classes.map((c) => ({ id: c.id, name: c.name })) :
    targetedScopeType === "teacher" ? project.teachers.map((t) => ({ id: t.id, name: t.name })) :
    (profile?.days ?? []).map((d) => ({ id: d, name: d }));
  const firstEntityId = targetedEntities[0]?.id ?? "";
  const effectiveEntityId = targetedEntityId || firstEntityId;

  const runTargeted = async () => {
    if (!effectiveEntityId) return;
    setTargetedRunning(true);
    setTargetedResult(null);
    try {
      const result = await onTargetedRegenerate({ type: targetedScopeType, id: effectiveEntityId });
      setTargetedResult(result);
    } finally {
      setTargetedRunning(false);
    }
  };

  const hasResult = !planning && (candidates.length > 0 || (feasibility !== null));

  return (
    <div className="mx-auto max-w-3xl space-y-5">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <section className="ts-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Make the timetable</h2>
            <p className="mt-1 max-w-md text-sm text-slate-500">
              The planner searches for the best timetable it can find within the time limit. Nothing changes until you review and apply.
            </p>
          </div>
          <button onClick={onGenerate} disabled={planning} className="ts-btn-primary">
            {planning ? "Planning…" : candidates.length > 0 ? "Try again" : "Make timetable"}
          </button>
        </div>
      </section>

      {/* ── Verdict banner ─────────────────────────────────────────────────── */}
      {overallVerdict && hasResult && (
        <section className={`ts-card p-5 ${
          verdictTone(overallVerdict) === "good" ? "border-emerald-200 bg-emerald-50"
          : verdictTone(overallVerdict) === "bad" ? "border-rose-200 bg-rose-50"
          : "border-amber-200 bg-amber-50"
        }`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">{verdictTitle(overallVerdict)}</h3>
              <p className="mt-1 text-sm text-slate-600">{verdictBody(overallVerdict)}</p>
            </div>
            {candidates.length > 0 && (
              <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-medium text-slate-700">
                {candidates.length} {candidates.length === 1 ? "option" : "options"} found
              </span>
            )}
          </div>
        </section>
      )}

      {/* ── Metrics ────────────────────────────────────────────────────────── */}
      <section className="ts-card grid gap-5 p-6 sm:grid-cols-3">
        <Metric value={clashes} label="clashes" hint="Double-bookings" tone={clashes === 0 ? "good" : "bad"} />
        <Metric value={missing} label="periods missing" hint="Required but unplaced" tone={missing === 0 ? "good" : "warn"} />
        <Metric value={requestsMet} label="requests met" hint="Your rules satisfied" tone="good" />
      </section>

      {/* ── Pre-result gaps ─────────────────────────────────────────────────── */}
      {!active && gaps.length > 0 && (
        <section className="ts-card p-5">
          <h3 className="mb-2 text-sm font-semibold text-slate-800">Missing required periods right now</h3>
          <ul className="space-y-1 text-sm text-slate-600">
            {gaps.slice(0, 8).map((g) => <li key={`${g.classId}#${g.subjectId}`}>- {g.message}</li>)}
            {gaps.length > 8 && <li className="text-slate-400">...and {gaps.length - 8} more</li>}
          </ul>
        </section>
      )}

      {/* ── Active candidate card ───────────────────────────────────────────── */}
      {active && hasResult && (
        <section className="ts-card p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-800">{active.presetLabel} option</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${bandColor(active.assessment.band)}`}>
                {active.assessment.band}
              </span>
            </div>
            <span className="text-xs text-slate-500">{active.assessment.score}/100</span>
          </div>

          <p className="mb-3 text-sm text-slate-600">{active.assessment.summary}</p>

          {/* Top 2 advantages */}
          {active.assessment.advantages.slice(0, 2).map((adv, i) => (
            <div key={i} className="mb-1.5 flex items-start gap-2 text-sm">
              <span className="mt-0.5 shrink-0 text-emerald-500">+</span>
              <span className="flex-1 text-emerald-700">{adv.message}</span>
              {adv.entityRefs.length > 0 && (
                <button
                  onClick={onJumpToTimetable}
                  className="shrink-0 rounded border border-slate-200 px-1.5 py-0.5 text-xs text-slate-500 hover:bg-slate-50"
                >
                  Show
                </button>
              )}
            </div>
          ))}

          {/* Top 1 disadvantage */}
          {active.assessment.disadvantages.slice(0, 1).map((dis, i) => (
            <div key={i} className="mb-3 flex items-start gap-2 text-sm">
              <span className="mt-0.5 shrink-0 text-rose-400">−</span>
              <span className="flex-1 text-rose-600">{dis.message}</span>
              {dis.entityRefs.length > 0 && (
                <button
                  onClick={onJumpToTimetable}
                  className="shrink-0 rounded border border-slate-200 px-1.5 py-0.5 text-xs text-slate-500 hover:bg-slate-50"
                >
                  Show
                </button>
              )}
            </div>
          ))}

          {/* Changes summary */}
          <div className="mb-4 max-h-40 overflow-auto">
            {active.changes.length === 0 ? (
              <p className="text-xs text-slate-500">No changes needed — the timetable already meets your requests.</p>
            ) : (
              <>
                <p className="mb-1 text-xs font-medium text-slate-600">{active.changes.length} {active.changes.length === 1 ? "cell" : "cells"} changed from current</p>
                {active.changes.slice(0, 20).map((c) => (
                  <div key={`${c.classId}#${c.day}#${c.slot}`} className="rounded border border-slate-100 px-2 py-1 text-xs text-slate-600">
                    <span className="font-medium text-slate-800">{c.className}</span> · {c.day} {labelFor(c.slot)}: {c.before} → {c.after}
                  </div>
                ))}
                {active.changes.length > 20 && <p className="mt-1 text-xs text-slate-400">...and {active.changes.length - 20} more</p>}
              </>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <button onClick={() => onApply(active)} className="ts-btn-primary">Apply this plan</button>
            <button onClick={onReject} className="ts-btn-ghost text-rose-700">Discard</button>
          </div>
        </section>
      )}

      {/* ── What's left & why (M-A) ────────────────────────────────────────── */}
      {active && hasResult && active.remainingShortfall > 0 && active.coverageReport.gaps.length > 0 && (
        <section className="ts-card border-amber-200 bg-amber-50 p-5">
          <h3 className="mb-3 text-sm font-semibold text-amber-900">
            What's left & why — {active.remainingShortfall} {active.remainingShortfall === 1 ? "period" : "periods"} unplaced
          </h3>
          <ul className="space-y-3">
            {active.coverageReport.gaps.slice(0, 8).map((g, i) => {
              const subjectName = active.project.subjects.find((s) => s.id === g.subjectId)?.name ?? g.subjectId;
              const className = active.project.classes.find((c) => c.id === g.classId)?.name ?? g.classId;
              return (
                <li key={i} className="rounded-lg border border-amber-100 bg-white p-3">
                  <p className="mb-1 text-sm font-medium text-slate-800">
                    {className} · {subjectName} · {g.short} {g.short === 1 ? "period" : "periods"} missing
                  </p>
                  {g.reasons.length > 0 && (
                    <p className="mb-1 text-xs text-slate-600">{g.reasons[0]}</p>
                  )}
                  <p className="text-xs text-amber-700">{g.suggestion}</p>
                </li>
              );
            })}
            {active.coverageReport.gaps.length > 8 && (
              <li className="text-xs text-slate-400">
                …and {active.coverageReport.gaps.length - 8} more gaps
              </li>
            )}
          </ul>
        </section>
      )}

      {/* ── Alternative candidates ──────────────────────────────────────────── */}
      {candidates.length > 1 && hasResult && (
        <section className="ts-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">Other options</h3>
            <button
              onClick={() => setCompareOpen(!compareOpen)}
              className="text-xs text-indigo-600 hover:underline"
            >
              {compareOpen ? "Hide comparison" : "Compare all"}
            </button>
          </div>

          {/* Candidate selector pills */}
          <div className="flex flex-wrap gap-2">
            {candidates.map((c, i) => (
              <button
                key={i}
                onClick={() => setActiveIdx(i)}
                className={`rounded-lg border px-3 py-2 text-sm transition ${
                  i === safeIdx
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700 font-medium"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {c.presetLabel}
                <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-xs font-medium ${bandColor(c.assessment.band)}`}>
                  {c.assessment.band}
                </span>
              </button>
            ))}
          </div>

          {/* Compare table */}
          {compareOpen && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="pb-2 pr-4 text-left text-xs font-medium text-slate-500">Metric</th>
                    {candidates.map((c, i) => (
                      <th key={i} className="pb-2 pr-4 text-left text-xs font-semibold text-slate-700">{c.presetLabel}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  <CompareRow label="Score" values={candidates.map((c) => `${c.assessment.score}/100`)} />
                  <CompareRow label="Band" values={candidates.map((c) => c.assessment.band)} />
                  <CompareRow label="Clashes" values={candidates.map((c) => String(c.hardCount))} highlight="lower" />
                  <CompareRow label="Periods missing" values={candidates.map((c) => String(c.remainingShortfall))} highlight="lower" />
                  <CompareRow label="Soft violations" values={candidates.map((c) => String(c.softScore))} highlight="lower" />
                  <CompareRow label="Changes" values={candidates.map((c) => String(c.changes.length))} highlight="lower" />
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ── Blockers (impossible path) ──────────────────────────────────────── */}
      {feasibility && (feasibility.structuredBlockers?.length ?? 0) > 0 && hasResult && (
        <section className="ts-card border-rose-200 bg-rose-50 p-5">
          <h3 className="mb-3 text-sm font-semibold text-rose-900">
            {overallVerdict === "Proven impossible" ? "Why this cannot be generated" : "Why some requests couldn't be fully met"}
          </h3>
          <ul className="space-y-3">
            {(feasibility.structuredBlockers ?? []).slice(0, 6).map((b, i) => (
              <li key={i} className="rounded-lg border border-rose-100 bg-white p-3">
                <p className="mb-2 text-sm text-slate-700">{b.message}</p>
                <div className="flex flex-wrap items-start gap-2">
                  {b.entityRefs.length > 0 && (
                    <button
                      onClick={onJumpToTimetable}
                      className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                    >
                      Show in timetable
                    </button>
                  )}
                  <p className="flex-1 text-xs text-slate-500">{b.relaxation.message}</p>
                  {b.relaxation.apply && (
                    <button
                      onClick={() => onApplyTweak(b.relaxation.apply!(project))}
                      className="rounded bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-700"
                    >
                      Apply this tweak
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Advanced disclosure ─────────────────────────────────────────────── */}
      {candidates.length > 0 && hasResult && (
        <section className="ts-card p-4">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-xs text-slate-400 hover:text-slate-600"
            aria-expanded={showAdvanced}
          >
            {showAdvanced ? "Hide" : "Show"} advanced details
          </button>
          {showAdvanced && (
            <div className="mt-3 space-y-1">
              {candidates.map((c, i) => (
                <div key={i} className="text-xs text-slate-500">
                  <span className="font-medium text-slate-700">{c.presetLabel}:</span>{" "}
                  seed {c.seed} · {c.softScore} soft violations · weighted score {c.weightedSoftScore}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Targeted regenerate (M28) ───────────────────────────────────────── */}
      <section className="ts-card p-4">
        <button
          onClick={() => setTargetedOpen(!targetedOpen)}
          className="flex w-full items-center justify-between text-left"
          aria-expanded={targetedOpen}
        >
          <span className="text-sm font-medium text-slate-700">Re-plan a specific area</span>
          <span className="text-xs text-slate-400">{targetedOpen ? "▲" : "▼"}</span>
        </button>

        {targetedOpen && (
          <div className="mt-4 space-y-3">
            <p className="text-xs text-slate-500">
              Freeze the rest of the timetable and re-plan just one class, teacher, or day.
              Uses an exact search — returns Proven impossible if no solution exists for that scope.
            </p>

            {/* Scope type selector */}
            <div className="flex gap-1" role="group" aria-label="Scope type">
              {(["class", "teacher", "day"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => { setTargetedScopeType(type); setTargetedEntityId(""); setTargetedResult(null); }}
                  className={`rounded px-3 py-1.5 text-xs font-medium capitalize transition ${
                    targetedScopeType === type
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                  aria-pressed={targetedScopeType === type}
                >
                  {type}
                </button>
              ))}
            </div>

            {/* Entity selector + run button */}
            <div className="flex flex-wrap gap-2">
              <select
                value={effectiveEntityId}
                onChange={(e) => { setTargetedEntityId(e.target.value); setTargetedResult(null); }}
                className="min-w-0 flex-1 rounded border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                aria-label={`Select ${targetedScopeType}`}
              >
                {targetedEntities.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
              <button
                onClick={() => void runTargeted()}
                disabled={targetedRunning || !effectiveEntityId}
                className="ts-btn-primary text-sm"
              >
                {targetedRunning ? "Planning…" : `Re-plan this ${targetedScopeType}`}
              </button>
            </div>

            {/* Targeted result */}
            {targetedResult && (
              <div className={`rounded-lg border p-3 ${
                targetedResult.proofLevel === "complete" ? "border-emerald-200 bg-emerald-50"
                : targetedResult.proofLevel === "impossible" ? "border-rose-200 bg-rose-50"
                : "border-amber-200 bg-amber-50"
              }`}>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-800">
                    {targetedResult.proofLevel === "complete" ? "Complete for this scope"
                     : targetedResult.proofLevel === "impossible" ? "Cannot satisfy these rules for this scope"
                     : "Best found for this scope"}
                  </span>
                  <button
                    onClick={() => setTargetedResult(null)}
                    className="text-xs text-slate-400 hover:text-slate-600"
                    aria-label="Dismiss result"
                  >✕</button>
                </div>
                {targetedResult.blockers.length > 0 && (
                  <ul className="mb-2 space-y-1">
                    {targetedResult.blockers.slice(0, 3).map((b, i) => (
                      <li key={i} className="text-xs text-rose-700">· {b}</li>
                    ))}
                  </ul>
                )}
                {targetedResult.changes.length > 0 && (
                  <p className="mb-2 text-xs text-slate-600">
                    {targetedResult.changes.length} {targetedResult.changes.length === 1 ? "cell" : "cells"} changed
                  </p>
                )}
                {targetedResult.proofLevel !== "impossible" && targetedResult.changes.length > 0 && (
                  <button
                    onClick={() => onApplyTweak(targetedResult!.project)}
                    className="ts-btn-primary text-xs"
                  >
                    Apply targeted result
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
