// RB1 read-only shell: the app opens straight to the real 8-period 2026-27
// timetable, pre-loaded and clash-free. A class picker switches the week view.
// RB2 turns this into the single-screen legal-only editor (class/teacher/day
// toggle, click-to-place, inline health) — for now it proves the data reaches
// the screen with joint/team events rendered as single events.

import { useMemo, useState } from "react";
import { validate } from "../../domain/validate";
import { buildBundledProject } from "../../fixtures/bundled";
import { WeekGrid } from "../grid/WeekGrid";

export function App(): React.ReactElement {
  const project = useMemo(() => buildBundledProject(), []);
  const timetable = project.timetables.find((t) => t.id === project.activeTimetableId)!;
  const [classId, setClassId] = useState(project.classes[0]!.id);
  const clashCount = useMemo(
    () => validate(project, timetable).filter((v) => v.severity === "hard").length,
    [project, timetable],
  );

  return (
    <div className="min-h-screen bg-white font-sans text-slate-800">
     <div className="mx-auto max-w-[1200px] p-4">
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">{project.school.name}</h1>
          <p className="text-sm text-slate-500">Real 2026-27 timetable · 8 periods · Mon–Sat</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-sm font-medium ${
            clashCount === 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
          }`}
        >
          {clashCount === 0 ? "No clashes" : `${clashCount} clashes`}
        </span>
      </header>

      <label className="mb-3 flex items-center gap-2 text-sm">
        <span className="text-slate-500">Class</span>
        <select
          className="rounded border border-slate-300 px-2 py-1"
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
        >
          {project.classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <WeekGrid project={project} timetable={timetable} classId={classId} />

      <p className="mt-3 text-xs text-slate-400">
        Amber = ELGA team block · violet = combined senior class. Editing arrives next.
      </p>
     </div>
    </div>
  );
}
