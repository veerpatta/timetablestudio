// The timetable editing workspace (OVERHAUL C) — wraps the proven legal-only editor (grid +
// drag-swap + cell inspector + issues) in the rebuilt shell. The interaction logic is reused
// from the tested domain/ui components; only the presentation is new.

import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { useMemo, useState } from "react";
import { validate } from "../../domain/validate";
import type { Constraint, Day, Id, Project, Timetable } from "../../domain/types";
import { useProjectStore } from "../../store/projectStore";
import { DayGrid } from "../grid/DayGrid";
import { TeacherGrid } from "../grid/TeacherGrid";
import { WeekGrid } from "../grid/WeekGrid";
import { CellInspector, type SelectedCell } from "../panels/CellInspector";
import { ClassHealth, TeacherLoad } from "../panels/Insights";
import { IssuesPanel } from "../panels/Issues";

type Mode = "class" | "teacher" | "day";
const DAYS: Day[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function parseCell(id: string | number) {
  const [day, slot] = String(id).split("#");
  return { day: day as Day, slot: Number(slot) };
}

export function TimetableWorkspace({
  project,
  timetable,
  onAddConstraint,
  onChanged,
}: {
  project: Project;
  timetable: Timetable;
  onAddConstraint: (c: Constraint) => void;
  onChanged: (flash: string) => void;
}): React.ReactElement {
  const store = useProjectStore();
  const [mode, setMode] = useState<Mode>("class");
  const [classSel, setClassId] = useState<Id>(project.classes[0]!.id);
  const [teacherSel, setTeacherId] = useState<Id>(project.teachers.find((t) => t.schedulable)!.id);
  const [day, setDay] = useState<Day>("Mon");
  const [selected, setSelected] = useState<SelectedCell | null>(null);

  const classId = project.classes.some((c) => c.id === classSel) ? classSel : project.classes[0]!.id;
  const teacherId = project.teachers.some((t) => t.id === teacherSel && t.schedulable) ? teacherSel : project.teachers.find((t) => t.schedulable)!.id;
  const violations = useMemo(() => validate(project, timetable), [project, timetable]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = (e: DragEndEvent) => {
    if (!e.over) return;
    const r = store.tryDrop({ classId, ...parseCell(e.active.id) }, { classId, ...parseCell(e.over.id) });
    setSelected(null);
    onChanged(r === "swapped" ? "Swapped two lessons." : r === "moved" ? "Moved the lesson." : "That move would clash.");
  };

  const modeBtn = (m: Mode, label: string) => (
    <button onClick={() => { setMode(m); setSelected(null); }} className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${mode === m ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      <IssuesPanel
        project={project}
        timetable={timetable}
        onJump={(c, d, slot) => { setMode("class"); setClassId(c); setSelected({ classId: c, day: d, slot }); }}
        onFix={(next) => { store.applyFix(next); setSelected(null); onChanged("Fixed."); }}
      />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
        <section className="ts-card min-w-0">
          <div className="no-print flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-3">
            <div className="flex gap-1">{modeBtn("class", "By class")}{modeBtn("teacher", "By teacher")}{modeBtn("day", "By day")}</div>
            {mode === "class" ? (
              <label className="flex items-center gap-2 text-sm">
                <select aria-label="Class" className="ts-input" value={classId} onChange={(e) => { setClassId(e.target.value); setSelected(null); }}>
                  {project.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <ClassHealth project={project} timetable={timetable} classId={classId} />
              </label>
            ) : mode === "teacher" ? (
              <label className="flex items-center gap-2 text-sm">
                <select aria-label="Teacher" className="ts-input" value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
                  {project.teachers.filter((t) => t.schedulable).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <TeacherLoad project={project} timetable={timetable} teacherId={teacherId} />
              </label>
            ) : (
              <label className="flex items-center gap-2 text-sm">
                <select aria-label="Day" className="ts-input" value={day} onChange={(e) => { setDay(e.target.value as Day); setSelected(null); }}>
                  {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </label>
            )}
          </div>
          <div className="overflow-auto p-3">
            {mode === "class" ? (
              <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                <WeekGrid project={project} timetable={timetable} classId={classId} selected={selected?.classId === classId ? selected : null} onSelectCell={(d, slot) => setSelected({ classId, day: d, slot })} violations={violations} />
              </DndContext>
            ) : mode === "teacher" ? (
              <TeacherGrid project={project} timetable={timetable} teacherId={teacherId} selected={selected} onSelectCell={(c, d, slot) => { setMode("class"); setClassId(c); setSelected({ classId: c, day: d, slot }); }} />
            ) : (
              <DayGrid project={project} timetable={timetable} day={day} selected={selected} violations={violations} onSelectCell={(c, d, slot) => { setClassId(c); setSelected({ classId: c, day: d, slot }); }} />
            )}
          </div>
          <p className="no-print border-t border-slate-100 px-4 py-3 text-xs text-slate-500">Click a cell to edit it — you'll only ever be offered clash-free, qualified options. Drag a lesson onto another to swap.</p>
        </section>

        <div className="no-print">
          {selected ? (
            <CellInspector
              project={project}
              timetable={timetable}
              selected={selected}
              onPlace={(cell, subjectId, teacherIds) => { store.place(cell.classId, cell.day, cell.slot, subjectId, teacherIds); setSelected(null); onChanged("Placed."); }}
              onClear={(cell) => { store.clear(cell.classId, cell.day, cell.slot); setSelected(null); onChanged("Cleared."); }}
              onSwap={(cell, target) => { const r = store.tryDrop(cell, { classId: cell.classId, ...target }); setSelected(null); onChanged(r === "illegal" ? "Could not swap." : "Swapped."); }}
              onClose={() => setSelected(null)}
              onAddConstraint={onAddConstraint}
              onSetRequirementPeriods={store.setRequirementPeriods}
              onSetRequirementPreferDouble={store.setRequirementPreferDouble}
            />
          ) : (
            <div className="ts-card p-5 text-sm text-slate-500">
              <h3 className="text-sm font-semibold text-slate-800">No cell selected</h3>
              <p className="mt-1">Pick any cell in the grid to change the subject or teacher, clear it, or turn it into a rule.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
