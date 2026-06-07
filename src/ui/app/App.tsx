// RB2 single-screen editor. The app opens to the real timetable; click any class
// cell to get the legal-only picker (it can only place clash-free, qualified
// lessons). Class and Teacher views are projections of one store, so an edit in one
// shows in the other. Global undo. RB2 niceties (ghost autocomplete, drag-swap,
// richer health) layer on next.

import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { useMemo, useState } from "react";
import { validate } from "../../domain/validate";
import type { Day } from "../../domain/types";
import { useProjectStore } from "../../store/projectStore";
import { CellPicker } from "../editor/CellPicker";
import { TeacherGrid } from "../grid/TeacherGrid";
import { WeekGrid } from "../grid/WeekGrid";
import { ClassHealth, TeacherLoad } from "../panels/Insights";

type View = "class" | "teacher";

export function App(): React.ReactElement {
  const { project, timetableId, place, clear, tryDrop, undo, past } = useProjectStore();
  const timetable = project.timetables.find((t) => t.id === timetableId)!;

  const [view, setView] = useState<View>("class");
  const [classId, setClassId] = useState(project.classes[0]!.id);
  const [teacherId, setTeacherId] = useState(project.teachers.find((t) => t.schedulable)!.id);
  const [cell, setCell] = useState<{ day: Day; slot: number } | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const openCell = (day: Day, slot: number) => { setFlash(null); setCell({ day, slot }); };

  const parseCell = (id: string | number) => {
    const [day, slot] = String(id).split("#");
    return { day: day as Day, slot: Number(slot) };
  };
  const handleDragEnd = (e: DragEndEvent) => {
    if (!e.over) return;
    const r = tryDrop({ classId, ...parseCell(e.active.id) }, { classId, ...parseCell(e.over.id) });
    setCell(null);
    setFlash(
      r === "swapped" ? "Swapped — both lessons stay valid." : r === "moved" ? "Moved." : "Can’t drop there — it would clash.",
    );
  };

  const clashCount = useMemo(
    () => validate(project, timetable).filter((v) => v.severity === "hard").length,
    [project, timetable],
  );

  const tabBtn = (v: View) =>
    `rounded px-3 py-1 text-sm ${view === v ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-700"}`;

  return (
    <div className="min-h-screen bg-white font-sans text-slate-800">
      <div className="mx-auto max-w-[1280px] p-4">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold">{project.school.name}</h1>
            <p className="text-sm text-slate-500">Real 2026-27 timetable · 8 periods · Mon–Sat</p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-3 py-1 text-sm font-medium ${
                clashCount === 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
              }`}
            >
              {clashCount === 0 ? "No clashes" : `${clashCount} clashes`}
            </span>
            <button
              onClick={undo}
              disabled={past.length === 0}
              className="rounded border border-slate-300 px-3 py-1 text-sm disabled:opacity-40"
            >
              Undo
            </button>
          </div>
        </header>

        <div className="mb-3 flex flex-wrap items-center gap-3">
          <div className="flex gap-1">
            <button className={tabBtn("class")} onClick={() => { setView("class"); setCell(null); }}>By class</button>
            <button className={tabBtn("teacher")} onClick={() => { setView("teacher"); setCell(null); }}>By teacher</button>
          </div>
          {view === "class" ? (
            <label className="flex items-center gap-2 text-sm">
              <span className="text-slate-500">Class</span>
              <select className="rounded border border-slate-300 px-2 py-1" value={classId} onChange={(e) => { setClassId(e.target.value); setCell(null); }}>
                {project.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <ClassHealth project={project} timetable={timetable} classId={classId} />
            </label>
          ) : (
            <label className="flex items-center gap-2 text-sm">
              <span className="text-slate-500">Teacher</span>
              <select className="rounded border border-slate-300 px-2 py-1" value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
                {project.teachers.filter((t) => t.schedulable).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <TeacherLoad project={project} timetable={timetable} teacherId={teacherId} />
            </label>
          )}
        </div>

        {flash && (
          <p className="mb-2 rounded bg-slate-100 px-3 py-1.5 text-sm text-slate-600" role="status">{flash}</p>
        )}

        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="min-w-0 flex-1 overflow-auto">
            {view === "class" ? (
              <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                <WeekGrid
                  project={project}
                  timetable={timetable}
                  classId={classId}
                  selected={cell}
                  onSelectCell={openCell}
                />
              </DndContext>
            ) : (
              <TeacherGrid project={project} timetable={timetable} teacherId={teacherId} />
            )}
          </div>
          {view === "class" && cell && (
            <div className="lg:w-80">
              <CellPicker
                project={project}
                timetableId={timetableId}
                classId={classId}
                day={cell.day}
                slot={cell.slot}
                onPlace={(subjectId, teacherIds) => { place(classId, cell.day, cell.slot, subjectId, teacherIds); setCell(null); }}
                onClear={() => { clear(classId, cell.day, cell.slot); setCell(null); }}
                onSwap={(target) => {
                  const r = tryDrop({ classId, day: cell.day, slot: cell.slot }, { classId, ...target });
                  setCell(null);
                  setFlash(r === "swapped" ? "Swapped — both lessons stay valid." : r === "moved" ? "Moved." : "Couldn’t swap.");
                }}
                onClose={() => setCell(null)}
              />
            </div>
          )}
        </div>

        <p className="mt-3 text-xs text-slate-400">
          Amber = ELGA team block · violet = combined senior class. Click a class cell to edit (only legal options shown), or drag a lesson onto another slot to swap.
        </p>
      </div>
    </div>
  );
}
