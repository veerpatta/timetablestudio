// School-wide report sections (C7): the elective/option-line report (who's in what), per-class
// subject counts, and room utilisation. Room use is honest about the current data — no lesson
// is assigned to a room yet (the `roomId` event field is unused, same gap as the deferred
// `subject_needs_room` constraint in C4), so it says so rather than showing a misleading table.

import { roomUseReport, subjectCountReport } from "../../domain/reports";
import { electiveReport } from "../../domain/studentView";
import type { Project, Timetable } from "../../domain/types";

export function SchoolReports({ project, timetable }: { project: Project; timetable: Timetable }): React.ReactElement {
  const electives = electiveReport(project);
  const subjectCounts = subjectCountReport(project, timetable);
  const rooms = roomUseReport(project, timetable);
  const roomsAssigned = rooms.some((r) => r.periods > 0);

  return (
    <>
      {electives.length > 0 && (
        <section style={{ breakInside: "avoid" }}>
          <h2 className="mb-2 text-sm font-semibold">Electives / option lines</h2>
          <div className="space-y-3">
            {electives.map((line) => (
              <div key={line.classId} className="rounded border border-slate-200 p-2 text-sm">
                <p className="font-medium">{line.className}</p>
                <p className="text-xs text-slate-600">
                  Choose {line.chooseCount} of {line.offered.length}: {line.offered.map((o) => o.subject).join(", ")}
                </p>
                <ul className="mt-1 space-y-0.5 text-xs">
                  {line.groups.map((g) => (
                    <li key={g.id}>
                      <span className="text-slate-500">In {g.chosen.join(" / ")}</span> — Self Study for the rest
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      <section style={{ breakInside: "avoid" }}>
        <h2 className="mb-2 text-sm font-semibold">Per-class subject counts (periods / week)</h2>
        <div className="overflow-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="border bg-slate-100 p-1 text-left">Class</th>
                <th className="border bg-slate-100 p-1 text-left">Subjects</th>
              </tr>
            </thead>
            <tbody>
              {subjectCounts.map((row) => (
                <tr key={row.classId}>
                  <th className="border bg-slate-50 p-1 text-left font-medium">{row.name}</th>
                  <td className="border p-1">{row.counts.map((c) => `${c.subject} ${c.periods}`).join(" · ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section style={{ breakInside: "avoid" }}>
        <h2 className="mb-2 text-sm font-semibold">Room use</h2>
        {roomsAssigned ? (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border bg-slate-100 p-2 text-left">Room</th>
                <th className="border bg-slate-100 p-2">Periods / week</th>
              </tr>
            </thead>
            <tbody>
              {rooms.map((r) => (
                <tr key={r.roomId}>
                  <th className="border bg-slate-50 p-2 text-left font-medium">{r.name}</th>
                  <td className="border p-2 text-center">{r.periods}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-slate-600">
            Lessons aren’t assigned to rooms in this timetable, so room utilisation can’t be reported yet.
            {project.rooms.length > 0 && ` Defined rooms: ${project.rooms.map((r) => r.name).join(", ")}.`}
          </p>
        )}
      </section>
    </>
  );
}
