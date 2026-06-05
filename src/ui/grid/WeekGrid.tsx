import { Fragment } from "react";
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
 * Used for viewing and printing a single person's / class's week. Period rows
 * carry the real clock times and the positioned break, mirroring Class_Wise.pdf. */
export function WeekGrid({ project, timetable, scope, violations }: Props) {
  const week = buildWeekView(project, timetable, scope, violations);
  const profile = project.profiles.find((p) => p.id === timetable.profileId);
  const timeOf = (period: number): string => {
    const pd = profile?.periods[period - 1];
    return pd?.start && pd?.end ? `${pd.start}–${pd.end}` : "";
  };
  const brk = profile?.break;

  return (
    <table className="w-full border-collapse text-left">
      <caption className="px-1 pb-2 text-left text-sm font-semibold">
        {scope.kind === "class" ? "Class" : "Teacher"}: {week.scopeLabel}
      </caption>
      <thead>
        <tr>
          <th className="w-20 border border-slate-200 bg-slate-100 p-2 text-xs font-semibold">Period</th>
          {week.days.map((d) => (
            <th key={d} className="border border-slate-200 bg-slate-100 p-2 text-xs font-semibold">
              {d}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {week.rows.map((row) => (
          <Fragment key={row.period}>
            <tr>
              <th className="border border-slate-200 bg-slate-50 p-2 text-xs font-medium">
                P{row.period}
                {timeOf(row.period) && (
                  <div className="text-[10px] font-normal text-slate-400">{timeOf(row.period)}</div>
                )}
              </th>
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
            {brk && brk.afterPeriod === row.period && (
              <tr>
                <td
                  colSpan={week.days.length + 1}
                  className="border border-slate-200 bg-amber-50 px-2 py-0.5 text-center text-[10px] font-medium text-amber-800"
                >
                  Break · {brk.start}–{brk.end}
                </td>
              </tr>
            )}
          </Fragment>
        ))}
      </tbody>
    </table>
  );
}
