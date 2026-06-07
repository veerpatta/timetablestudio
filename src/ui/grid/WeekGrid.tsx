// Editable week grid for one class (RB2). Columns = the profile's slots (Assembly,
// P1..P4, Recess, P5..P8); rows = the six days. Reads the shared derive() occupancy,
// so ELGA and senior joint classes appear exactly as the single events they are.
//
// RB2 niceties layered here: empty teaching cells show a faint GHOST suggestion (the
// best legal lesson to drop in); a normal lesson can be DRAGGED onto another cell and
// the parent resolves it as a legal swap/move. Shared joint/team cells are not
// draggable — moving one would silently move every member class. dnd-kit ids are
// "${day}#${slot}" for both the draggable lesson and its droppable cell.

import { useDraggable, useDroppable } from "@dnd-kit/core";
import { deriveMaps, findProfile, slotKey } from "../../domain/derive";
import { ghostSuggestion } from "../../domain/ghost";
import type { Day, Id, Project, SlotDef, Timetable } from "../../domain/types";

const DAYS: Day[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface Props {
  project: Project;
  timetable: Timetable;
  classId: Id;
  onSelectCell?: (day: Day, slot: number) => void;
  selected?: { day: Day; slot: number } | null;
}

function DraggableLesson({ id, children }: { id: string; children: React.ReactNode }): React.ReactElement {
  // Pointer-drag only (no KeyboardSensor), so we omit dnd-kit's `attributes` — they
  // would add role="button" inside the cell's own button and nest interactives.
  const { listeners, setNodeRef, isDragging } = useDraggable({ id });
  return (
    <span ref={setNodeRef} {...listeners} className={`block cursor-grab ${isDragging ? "opacity-40" : ""}`}>
      {children}
    </span>
  );
}

interface CellProps {
  project: Project;
  timetable: Timetable;
  classId: Id;
  day: Day;
  s: SlotDef;
  isSel: boolean;
  onSelectCell?: (day: Day, slot: number) => void;
}

function GridCell({ project, timetable, classId, day, s, isSel, onSelectCell }: CellProps): React.ReactElement {
  const id = `${day}#${s.index}`;
  const { setNodeRef, isOver } = useDroppable({ id });
  const subjects = new Map(project.subjects.map((x) => [x.id, x.name]));
  const teachers = new Map(project.teachers.map((t) => [t.id, t.name]));
  const occ = deriveMaps(project, timetable).classCells.get(classId)?.get(slotKey(day, s.index));
  const event = occ?.[0]?.event;

  const ring = isSel ? "ring-2 ring-inset ring-sky-500" : "";
  const over = isOver ? "ring-2 ring-inset ring-emerald-400" : "";
  const clickable = onSelectCell ? "cursor-pointer hover:bg-sky-50" : "";
  const handle = onSelectCell ? () => onSelectCell(day, s.index) : undefined;
  const a11y = onSelectCell
    ? {
        role: "button" as const,
        tabIndex: 0,
        "aria-label": `${day} ${s.label}`,
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelectCell(day, s.index);
          }
        },
      }
    : {};

  if (!event) {
    const ghost = ghostSuggestion(project, timetable.id, classId, day, s.index);
    return (
      <td ref={setNodeRef} onClick={handle} {...a11y} className={`border p-2 text-center ${clickable} ${ring} ${over}`}>
        {ghost ? (
          <span className="text-[11px] italic text-slate-300" title="Suggested — click to choose">
            {subjects.get(ghost.subjectId) ?? ghost.subjectId}?
          </span>
        ) : (
          <span className="text-slate-300">+</span>
        )}
      </td>
    );
  }

  const who = event.teacherIds.map((t) => teachers.get(t) ?? t).join(", ");
  const tint =
    event.type === "team_block"
      ? "bg-amber-50"
      : event.type === "joint_class"
        ? "bg-violet-50"
        : event.type === "free" || event.type === "self_study"
          ? "bg-slate-50"
          : "";
  const draggable = event.classIds.length === 1; // shared events never drag
  const body = (
    <>
      <div className="font-medium text-slate-800">{subjects.get(event.subjectId) ?? event.subjectId}</div>
      {who && <div className="text-[11px] text-slate-500">{who}</div>}
    </>
  );

  return (
    <td ref={setNodeRef} onClick={handle} {...a11y} className={`border p-2 align-top ${tint} ${clickable} ${ring} ${over}`}>
      {draggable ? <DraggableLesson id={id}>{body}</DraggableLesson> : body}
    </td>
  );
}

export function WeekGrid({ project, timetable, classId, onSelectCell, selected }: Props): React.ReactElement {
  const profile = findProfile(project, timetable);
  if (!profile) return <p>Unknown profile.</p>;

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr>
          <th className="border bg-slate-100 p-2 text-left">Day</th>
          {profile.slots.map((s) => (
            <th key={s.index} className={`border p-2 ${s.teaching ? "bg-slate-100" : "bg-slate-200 text-slate-500"}`}>
              <div className="font-semibold">{s.label}</div>
              <div className="text-[10px] font-normal text-slate-400">
                {s.start}–{s.end}
              </div>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {DAYS.map((day) => (
          <tr key={day}>
            <th className="border bg-slate-100 p-2 text-left">{day}</th>
            {profile.slots.map((s) => {
              if (!s.teaching) {
                return (
                  <td key={s.index} className="border bg-slate-50 p-2 text-center text-slate-400">
                    {s.label}
                  </td>
                );
              }
              return (
                <GridCell
                  key={s.index}
                  project={project}
                  timetable={timetable}
                  classId={classId}
                  day={day}
                  s={s}
                  isSel={selected?.day === day && selected?.slot === s.index}
                  onSelectCell={onSelectCell}
                />
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
