// Period-grid editing (C1, scoped): rename / re-time each slot, append a teaching
// period, remove one. Mid-grid insertion is intentionally out of scope. Assembly and
// Recess can be re-timed/renamed but not removed through here (they anchor the day).

import { useState } from "react";
import type { Profile } from "../../domain/types";

export interface PeriodManagerProps {
  profile: Profile;
  onEdit: (slotIndex: number, patch: { label?: string; start?: string; end?: string }) => void;
  onAdd: (label?: string) => void;
  onRemove: (slotIndex: number) => void;
}

export function PeriodManager({ profile, onEdit, onAdd, onRemove }: PeriodManagerProps): React.ReactElement {
  const [confirm, setConfirm] = useState<number | null>(null);
  const teachingCount = profile.slots.filter((s) => s.teaching).length;

  return (
    <div>
      <p className="mb-3 text-sm text-slate-600">
        The school day for <span className="font-medium">{profile.name}</span>. Edit a period’s name or times; add a
        period at the end of the day; or remove one (any lessons in it become gaps you can refill).
      </p>
      <ul className="divide-y divide-slate-100 rounded border border-slate-200">
        {profile.slots.map((s) => (
          <li key={s.index} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
            <input
              className="w-28 rounded border border-slate-300 px-2 py-1"
              value={s.label}
              onChange={(e) => onEdit(s.index, { label: e.target.value })}
              aria-label={`Name of period ${s.label}`}
            />
            <input
              type="time"
              className="rounded border border-slate-300 px-2 py-1"
              value={s.start}
              onChange={(e) => onEdit(s.index, { start: e.target.value })}
              aria-label={`Start of ${s.label}`}
            />
            <span className="text-slate-400">–</span>
            <input
              type="time"
              className="rounded border border-slate-300 px-2 py-1"
              value={s.end}
              onChange={(e) => onEdit(s.index, { end: e.target.value })}
              aria-label={`End of ${s.label}`}
            />
            <span className={`rounded px-2 py-0.5 text-xs ${s.teaching ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
              {s.teaching ? "Teaching" : "Break"}
            </span>
            {s.teaching && (
              <button
                onClick={() => setConfirm(s.index)}
                disabled={teachingCount <= 1}
                className="ml-auto rounded border border-rose-200 px-2 py-0.5 text-xs text-rose-600 hover:bg-rose-50 disabled:opacity-40"
              >
                Remove
              </button>
            )}
            {confirm === s.index && (
              <div className="mt-1 w-full rounded border border-rose-200 bg-rose-50 p-2 text-rose-700">
                Remove {s.label}? Lessons scheduled in it become gaps. You can Undo this.
                <div className="mt-2 flex gap-2">
                  <button onClick={() => { onRemove(s.index); setConfirm(null); }} className="rounded bg-rose-600 px-3 py-1 text-xs text-white">Remove</button>
                  <button onClick={() => setConfirm(null)} className="rounded border border-slate-300 px-3 py-1 text-xs">Cancel</button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
      <button onClick={() => onAdd()} className="mt-3 rounded bg-slate-800 px-3 py-1 text-sm text-white">
        Add a period (P{teachingCount + 1})
      </button>
    </div>
  );
}
