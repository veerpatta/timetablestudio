import type { Project, Timetable, Violation } from "../../domain/types";
import { buildWeekView, type WeekScope } from "./weekModel";

interface Props {
  project: Project;
  timetable: Timetable;
  scope: WeekScope;
  violations: Violation[];
}

const sevClass: Record<"hard" | "soft", string> = {
  hard: "bg-red-50 ring-1 ring-hard",
  soft: "bg-amber-50 ring-1 ring-soft",
};

/** Read-only week grid for one class or one teacher (rows = periods, cols = days).
 * Used for viewing and printing a single person's / class's week. */
export function WeekGrid({ project, timetable, scope, violations }: Props) {
  const week = buildWeekView(project, timetable, scope, violations);

  return (
    <table className="w-full border-collapse text-left">
      <caption className="px-1 pb-2 text-left text-sm font-semibold">
        {scope.kind === "class" ? "Class" : "Teacher"}: {week.scopeLabel}
      </caption>
      <thead>
        <tr>
          <th className="w-16 border border-slate-200 bg-slate-100 p-2 text-xs font-semibold">Period</th>
          {week.days.map((d) => (
            <th key={d} className="border border-slate-200 bg-slate-100 p-2 text-xs font-semibold">
              {d}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {week.rows.map((row) => (
          <tr key={row.period}>
            <th className="border border-slate-200 bg-slate-50 p-2 text-xs font-medium">P{row.period}</th>
            {row.cells.map((cell) =>
              cell.covered ? null : (
                <td
                  key={cell.day}
                  rowSpan={cell.rowSpan}
                  className={`h-12 border border-slate-200 p-1 align-top text-xs leading-tight ${
                    cell.severity ? sevClass[cell.severity] : cell.label ? "bg-white" : "bg-slate-50"
                  } ${cell.isBlock ? "text-center align-middle" : ""}`}
                  title={cell.label}
                >
                  <span className={cell.isBlock ? "font-semibold text-indigo-700" : ""}>{cell.label}</span>
                </td>
              ),
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
