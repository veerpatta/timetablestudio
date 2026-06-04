import {
  DndContext,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useEditorStore } from "../../store/editorStore";
import type { PlacementRef } from "../../domain/edit";
import type { Day, Project, Timetable, Violation } from "../../domain/types";
import { buildClassRows, buildTeacherRows, type GridCell } from "./gridModel";

interface Props {
  project: Project;
  timetable: Timetable;
  day: Day;
  viewMode: "class" | "teacher";
  violations: Violation[];
}

const sevClass: Record<"hard" | "soft", string> = {
  hard: "ring-2 ring-hard bg-red-50",
  soft: "ring-2 ring-soft bg-amber-50",
};

function CellView({ rowId, cell }: { rowId: string; cell: GridCell }) {
  const pin = useEditorStore((s) => s.pin);
  const droppable = useDroppable({ id: `${rowId}#${cell.period}` });
  const draggable = useDraggable({
    id: `${rowId}#${cell.period}#drag`,
    data: { ref: cell.ref },
    disabled: !cell.ref,
  });

  const base =
    "relative h-14 border border-slate-200 p-1 text-xs leading-tight align-top select-none";
  const sev = cell.severity ? sevClass[cell.severity] : "";
  const dragRef = (node: HTMLElement | null) => {
    droppable.setNodeRef(node);
    draggable.setNodeRef(node);
  };

  return (
    <td
      ref={dragRef}
      className={`${base} ${sev} ${cell.ref ? "cursor-grab bg-white" : "bg-slate-50"} ${
        droppable.isOver ? "outline outline-2 outline-sky-400" : ""
      }`}
      {...draggable.listeners}
      {...draggable.attributes}
      title={cell.label}
    >
      {cell.label && (
        <div className="flex items-start justify-between gap-1">
          <span className={cell.isBlock ? "font-semibold text-indigo-700" : ""}>
            {cell.label}
          </span>
          {cell.ref && (
            <button
              type="button"
              aria-label={cell.pinned ? "Unpin" : "Pin"}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => pin(cell.ref!)}
              className={`shrink-0 rounded px-1 ${cell.pinned ? "text-amber-600" : "text-slate-300 hover:text-slate-500"}`}
            >
              {cell.pinned ? "📌" : "📍"}
            </button>
          )}
        </div>
      )}
    </td>
  );
}

export function TimetableGrid({ project, timetable, day, viewMode, violations }: Props) {
  const move = useEditorStore((s) => s.move);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const rows =
    viewMode === "class"
      ? buildClassRows(project, timetable, day, violations)
      : buildTeacherRows(project, timetable, day, violations);
  const periodCount = rows[0]?.cells.length ?? 6;

  const onDragEnd = (e: DragEndEvent) => {
    const ref = e.active.data.current?.ref as PlacementRef | undefined;
    if (!ref || !e.over) return;
    const targetPeriod = Number(String(e.over.id).split("#")[1]);
    if (!Number.isFinite(targetPeriod)) return;
    if (ref.day === day && ref.period === targetPeriod) return;
    move(ref, day, targetPeriod);
  };

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <table className="w-full border-collapse text-left">
        <thead>
          <tr>
            <th className="w-32 border border-slate-200 bg-slate-100 p-2 text-xs font-semibold">
              {viewMode === "class" ? "Class" : "Teacher"}
            </th>
            {Array.from({ length: periodCount }, (_, i) => (
              <th
                key={i}
                className="border border-slate-200 bg-slate-100 p-2 text-xs font-semibold"
              >
                Period {i + 1}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <th className="border border-slate-200 bg-slate-50 p-2 text-xs font-medium">
                {row.label}
              </th>
              {row.cells.map((cell) => (
                <CellView key={cell.period} rowId={row.id} cell={cell} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </DndContext>
  );
}
