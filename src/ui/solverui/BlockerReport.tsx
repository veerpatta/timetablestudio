import { Modal } from "../common/Modal";
import type { Blocker } from "../../solver/diagnose";

interface Props {
  blockers: Blocker[];
  /** Shown when the solver couldn't fit everything but no structural blocker was found. */
  generic?: string;
  onClose: () => void;
}

/** Explains why a clash-free timetable can't be built, in plain language —
 * shown instead of silently applying an unworkable result (M9 AC). */
export function BlockerReport({ blockers, generic, onClose }: Props) {
  return (
    <Modal onClose={onClose} maxWidth="max-w-xl" label="Why this won't fit yet">
      <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h2 className="font-semibold">This timetable can't be built yet</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-600">
          ✕
        </button>
      </header>
      <div className="space-y-3 p-4 text-sm">
        {blockers.length === 0 ? (
          <p className="text-slate-700">{generic ?? "Couldn't find a clash-free timetable in the time available. Try again, or simplify the requirements."}</p>
        ) : (
          <>
            <p className="text-slate-600">Fix these first, then try again:</p>
            <ul className="space-y-2">
              {blockers.map((b, i) => (
                <li key={i} className="rounded border border-hard/40 bg-red-50 px-3 py-2">
                  <p className="font-medium text-slate-800">{b.message}</p>
                  <p className="mt-1 text-xs text-slate-600">💡 {b.suggestion}</p>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      <footer className="flex justify-end border-t border-slate-200 px-4 py-3">
        <button type="button" onClick={onClose} className="rounded bg-slate-800 px-3 py-1 text-sm text-white">
          Got it
        </button>
      </footer>
    </Modal>
  );
}
