// Auto-fill review (RB5). The solver never edits silently — its result is shown here as a
// reviewable diff the owner accepts or rejects. Accept applies it through the undoable edit
// path; reject discards it. Any holes the greedy pass couldn't fill are stated honestly.

import type { FillResult } from "../../solver/fill";
import type { Project } from "../../domain/types";

interface Props {
  project: Project;
  result: FillResult;
  onAccept: () => void;
  onReject: () => void;
}

export function FillReview({ project, result, onAccept, onReject }: Props): React.ReactElement {
  const className = (id: string) => project.classes.find((c) => c.id === id)?.name ?? id;
  const profile = project.profiles.find((p) => p.id === project.timetables.find((t) => t.id === project.activeTimetableId)?.profileId);
  const slotLabel = (slot: number) => profile?.slots.find((s) => s.index === slot)?.label ?? `slot ${slot}`;

  return (
    <section className="mb-3 rounded-lg border border-sky-200 bg-sky-50 p-3" role="region" aria-label="Auto-fill review">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-sky-900">
          Fill the gaps · {result.added.length} {result.added.length === 1 ? "lesson" : "lessons"} proposed
        </h2>
        <div className="flex gap-2">
          <button onClick={onAccept} disabled={result.added.length === 0} className="rounded bg-sky-600 px-3 py-1 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-40">
            Accept
          </button>
          <button onClick={onReject} className="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-white">
            Reject
          </button>
        </div>
      </div>

      {result.added.length === 0 ? (
        <p className="text-sm text-slate-600">No gaps could be filled right now.</p>
      ) : (
        <ul className="max-h-60 space-y-1 overflow-auto text-sm">
          {result.added.map((a) => (
            <li key={`${a.classId}#${a.day}#${a.slot}`} className="rounded bg-white px-2 py-1">
              <span className="font-medium">{className(a.classId)}</span>{" "}
              <span className="text-slate-500">{a.day} {slotLabel(a.slot)}</span> → {a.label}
            </li>
          ))}
        </ul>
      )}

      {result.remainingShortfall > 0 && (
        <p className="mt-2 text-xs text-amber-700">
          {result.remainingShortfall} {result.remainingShortfall === 1 ? "period" : "periods"} couldn’t be placed (every
          qualified teacher was busy) — those slots stay empty for you to sort out by hand.
        </p>
      )}
    </section>
  );
}
