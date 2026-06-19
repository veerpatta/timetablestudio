import { deriveMaps, findProfile, slotKey } from "../../domain/derive";
import { legalOptions } from "../../domain/legalMoves";
import { slotLabel } from "../../domain/profile";
import { legalSwaps } from "../../domain/swaps";
import type { Constraint, Day, Id, Project, Timetable, TimetableEvent } from "../../domain/types";

export interface SelectedCell {
  classId: Id;
  day: Day;
  slot: number;
}

interface Props {
  project: Project;
  timetable: Timetable;
  selected: SelectedCell | null;
  onPlace: (cell: SelectedCell, subjectId: Id, teacherIds: Id[]) => void;
  onClear: (cell: SelectedCell) => void;
  onSwap: (cell: SelectedCell, target: { day: Day; slot: number }) => void;
  onClose: () => void;
  onAddConstraint: (constraint: Constraint) => void;
  onSetRequirementPeriods: (classId: Id, subjectId: Id, periodsPerWeek: number) => void;
  onSetRequirementPreferDouble: (classId: Id, subjectId: Id, preferDouble: boolean) => void;
}

const nameBy = <T extends { id: Id; name: string }>(items: T[], id: Id): string => items.find((x) => x.id === id)?.name ?? id;

function eventAt(project: Project, timetable: Timetable, cell: SelectedCell): TimetableEvent | undefined {
  return deriveMaps(project, timetable).classCells.get(cell.classId)?.get(slotKey(cell.day, cell.slot))?.[0]?.event;
}

function explain(project: Project, event: TimetableEvent | undefined): string {
  if (!event) return "Empty slot. Choose a legal replacement or leave it open for Fill gaps.";
  const subject = nameBy(project.subjects, event.subjectId);
  const classes = event.classIds.map((id) => nameBy(project.classes, id)).join(", ");
  const teachers = event.teacherIds.map((id) => nameBy(project.teachers, id)).join(", ");
  if (event.type === "team_block") return `${subject} is a team block for ${classes}. It moves together.`;
  if (event.type === "joint_class") return `${subject} is a joint class for ${classes}, taught once by ${teachers}.`;
  if (event.type === "free" || event.type === "self_study") return `${subject} is a study/free slot.`;
  return `${subject} for ${classes}${teachers ? `, taught by ${teachers}` : ""}.`;
}

function teacherWeekLoad(project: Project, timetable: Timetable, teacherId: Id): number {
  const maps = deriveMaps(project, timetable);
  let count = 0;
  for (const occ of maps.teacherCells.get(teacherId)?.values() ?? []) count += occ.length > 0 ? 1 : 0;
  return count;
}

function requirementFor(project: Project, classId: Id, subjectId: Id) {
  return project.requirements.find((r) => r.classId === classId && r.subjectId === subjectId);
}

function firstHalfConstraint(cell: SelectedCell, subjectId: Id): Constraint {
  return {
    id: `quick:first-half:${cell.classId}:${subjectId}`,
    scope: "subject",
    severity: "prefer",
    weight: 3,
    enabled: true,
    template: "subject_half_of_day",
    params: { subjectIds: [subjectId], classIds: [cell.classId], half: "first" },
  };
}

export function CellInspector({
  project,
  timetable,
  selected,
  onPlace,
  onClear,
  onSwap,
  onClose,
  onAddConstraint,
  onSetRequirementPeriods,
  onSetRequirementPreferDouble,
}: Props): React.ReactElement {
  const profile = findProfile(project, timetable);
  const event = selected ? eventAt(project, timetable, selected) : undefined;
  const options = selected && (!event || event.classIds.length === 1) ? legalOptions(project, timetable.id, selected.classId, selected.day, selected.slot) : [];
  const swaps = selected && event && event.classIds.length === 1 ? legalSwaps(project, timetable.id, selected.classId, selected.day, selected.slot) : [];
  const primaryTeacher = event?.teacherIds[0];
  const req = event && selected ? requirementFor(project, selected.classId, event.subjectId) : undefined;

  return (
    <aside className="flex h-full flex-col rounded border border-slate-200 bg-white" role="region" aria-label="Cell inspector">
      <div className="border-b border-slate-200 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">{selected ? "Selected cell" : "Select a timetable cell"}</h2>
            {selected && (
              <p className="text-xs text-slate-500">
                {nameBy(project.classes, selected.classId)} · {selected.day} {profile ? slotLabel(profile, selected.slot) : selected.slot}
              </p>
            )}
          </div>
          {selected && <button onClick={onClose} className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100">Close</button>}
        </div>
      </div>

      {!selected ? (
        <div className="space-y-3 p-4 text-sm text-slate-600">
          <p>Click any class cell to explain it, replace it, swap it, or add a request from it.</p>
          <p className="rounded bg-sky-50 p-2 text-xs text-sky-700">Requests are preferences by default, so the app keeps trying instead of failing too early.</p>
        </div>
      ) : (
        <div className="space-y-4 overflow-auto p-4">
          <section>
            <h3 className="mb-1 text-xs font-semibold uppercase text-slate-400">What is here</h3>
            <p className="text-sm text-slate-700">{explain(project, event)}</p>
          </section>

          {primaryTeacher && (
            <section className="rounded bg-slate-50 p-3">
              <h3 className="text-xs font-semibold uppercase text-slate-400">Affects this teacher</h3>
              <p className="text-sm text-slate-700">
                {nameBy(project.teachers, primaryTeacher)} has {teacherWeekLoad(project, timetable, primaryTeacher)} periods this week.
              </p>
            </section>
          )}

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase text-slate-400">Legal replacements</h3>
            <div className="space-y-1">
              {options.length === 0 ? (
                <p className="rounded bg-slate-50 p-2 text-sm text-slate-500">No legal replacement is free here.</p>
              ) : (
                options.slice(0, 8).map((o) => (
                  <button
                    key={o.label}
                    onClick={() => onPlace(selected, o.subjectId, o.teacherIds)}
                    className="block w-full rounded border border-transparent px-2 py-1.5 text-left text-sm hover:border-sky-200 hover:bg-sky-50"
                  >
                    {o.label}
                  </button>
                ))
              )}
            </div>
          </section>

          {swaps.length > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase text-slate-400">Legal swaps</h3>
              <div className="space-y-1">
                {swaps.slice(0, 6).map((s) => (
                  <button key={`${s.target.day}#${s.target.slot}`} onClick={() => onSwap(selected, s.target)} className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-emerald-50">
                    Swap with {s.label}
                  </button>
                ))}
              </div>
            </section>
          )}

          {event && (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase text-slate-400">Add a request</h3>
              <div className="space-y-2">
                <button onClick={() => onAddConstraint(firstHalfConstraint(selected, event.subjectId))} className="w-full rounded border border-slate-200 px-2 py-1.5 text-left text-sm hover:bg-sky-50">
                  Prefer this subject in the first half
                </button>
                {req && (
                  <>
                    <button onClick={() => onSetRequirementPeriods(selected.classId, event.subjectId, req.periodsPerWeek + 1)} className="w-full rounded border border-slate-200 px-2 py-1.5 text-left text-sm hover:bg-sky-50">
                      Add one weekly period for this subject
                    </button>
                    <button onClick={() => onSetRequirementPreferDouble(selected.classId, event.subjectId, true)} className="w-full rounded border border-slate-200 px-2 py-1.5 text-left text-sm hover:bg-sky-50">
                      Prefer back-to-back double periods
                    </button>
                  </>
                )}
              </div>
            </section>
          )}

          {event && event.classIds.length === 1 && (
            <button onClick={() => onClear(selected)} className="w-full rounded border border-rose-200 px-3 py-2 text-left text-sm text-rose-700 hover:bg-rose-50">
              Clear this cell
            </button>
          )}
        </div>
      )}
    </aside>
  );
}
