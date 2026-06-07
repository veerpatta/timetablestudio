// The legal-only cell picker (RB2). For the selected (class, day, slot) it shows a
// plain "what is this?" sentence and, when safe, ONLY the legal placements from
// legalOptions(). A cell that belongs to a shared joint/team event is never silently
// half-replaced: it offers an explicit "remove for all N classes" instead.

import { deriveMaps, slotKey } from "../../domain/derive";
import { ghostSuggestion } from "../../domain/ghost";
import { legalOptions } from "../../domain/legalMoves";
import { slotLabel } from "../../domain/profile";
import { legalSwaps } from "../../domain/swaps";
import { findProfile } from "../../domain/derive";
import type { Day, Id, Project, TimetableEvent } from "../../domain/types";

interface Props {
  project: Project;
  timetableId: Id;
  classId: Id;
  day: Day;
  slot: number;
  onPlace: (subjectId: Id, teacherIds: Id[]) => void;
  onClear: () => void;
  onSwap: (target: { day: Day; slot: number }) => void;
  onClose: () => void;
}

function explain(project: Project, event: TimetableEvent | undefined): string {
  const sName = (id: Id) => project.subjects.find((s) => s.id === id)?.name ?? id;
  const cName = (id: Id) => project.classes.find((c) => c.id === id)?.name ?? id;
  const tName = (id: Id) => project.teachers.find((t) => t.id === id)?.name ?? id;
  if (!event) return "Empty slot — pick a lesson to place here.";
  const who = event.teacherIds.map(tName).join(", ");
  switch (event.type) {
    case "team_block":
      return `Part of the ${sName(event.subjectId)} team block — ${event.classIds.map(cName).join(", ")} together, taught by ${who}.`;
    case "joint_class":
      return `Joint ${sName(event.subjectId)} for ${event.classIds.map(cName).join(", ")} — one class, taught by ${who}.`;
    case "free":
      return "Free period.";
    default:
      return `${sName(event.subjectId)} for ${cName(event.classIds[0]!)}${who ? `, taught by ${who}` : ""}.`;
  }
}

export function CellPicker({ project, timetableId, classId, day, slot, onPlace, onClear, onSwap, onClose }: Props): React.ReactElement {
  const tt = project.timetables.find((t) => t.id === timetableId);
  const profile = tt && findProfile(project, tt);
  const maps = tt && deriveMaps(project, tt);
  const event = maps?.classCells.get(classId)?.get(slotKey(day, slot))?.[0]?.event;
  const shared = !!event && event.classIds.length > 1;
  const options = shared ? [] : legalOptions(project, timetableId, classId, day, slot);
  const ghost = !event && !shared ? ghostSuggestion(project, timetableId, classId, day, slot) : null;
  const swaps = event && !shared ? legalSwaps(project, timetableId, classId, day, slot) : [];

  return (
    <aside className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold">
          {(project.classes.find((c) => c.id === classId)?.name ?? classId)} · {day} {profile ? slotLabel(profile, slot) : slot}
        </h2>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Close">✕</button>
      </div>
      <p className="mb-3 text-sm text-slate-600">{explain(project, event)}</p>

      {shared ? (
        <button
          onClick={onClear}
          className="w-full rounded bg-rose-50 px-3 py-2 text-left text-sm text-rose-700 hover:bg-rose-100"
        >
          Remove this {event!.type === "team_block" ? "block" : "joint class"} for all {event!.classIds.length} classes
        </button>
      ) : (
        <>
          {ghost && (
            <button
              onClick={() => onPlace(ghost.subjectId, ghost.teacherIds)}
              className="mb-3 w-full rounded border border-sky-200 bg-sky-50 px-3 py-2 text-left text-sm hover:bg-sky-100"
            >
              <span className="text-xs font-medium uppercase tracking-wide text-sky-600">Suggested</span>
              <span className="block font-medium text-slate-800">{ghost.label}</span>
            </button>
          )}
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">
            {event ? "Replace with" : "Place a lesson"} · only legal options shown
          </p>
          <ul className="max-h-72 space-y-1 overflow-auto">
            {options.length === 0 && <li className="py-2 text-sm text-slate-400">No legal option here (every qualified teacher is busy).</li>}
            {options.map((o) => (
              <li key={o.label}>
                <button
                  onClick={() => onPlace(o.subjectId, o.teacherIds)}
                  className="w-full rounded px-3 py-1.5 text-left text-sm hover:bg-sky-50"
                >
                  {o.label}
                </button>
              </li>
            ))}
          </ul>
          {event && swaps.length > 0 && (
            <div className="mt-3">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">
                Swap with · both stay valid
              </p>
              <ul className="max-h-48 space-y-1 overflow-auto">
                {swaps.map((s) => (
                  <li key={`${s.target.day}#${s.target.slot}`}>
                    <button
                      onClick={() => onSwap(s.target)}
                      className="w-full rounded px-3 py-1.5 text-left text-sm hover:bg-emerald-50"
                    >
                      ⇄ {s.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {event && (
            <button onClick={onClear} className="mt-2 w-full rounded px-3 py-1.5 text-left text-sm text-rose-600 hover:bg-rose-50">
              Clear this cell
            </button>
          )}
        </>
      )}
    </aside>
  );
}
