import type { DerivedMaps } from "../../domain/derive";
import type { Day, Project } from "../../domain/types";

interface Props {
  project: Project;
  maps: DerivedMaps;
  day: Day;
}

export function TeacherLoadPanel({ project, maps, day }: Props) {
  const rows = project.teachers.map((t) => {
    const slots = maps.teacherCells.get(t.id);
    let week = 0;
    let today = 0;
    if (slots) {
      for (const occ of slots.values()) {
        week += 1;
        if (occ[0]!.day === day) today += 1;
      }
    }
    return {
      id: t.id,
      name: t.name,
      today,
      week,
      overDay: today > t.maxPeriodsPerDay,
      overWeek: week > t.maxPeriodsPerWeek,
      capDay: t.maxPeriodsPerDay,
      capWeek: t.maxPeriodsPerWeek,
    };
  });

  return (
    <section className="rounded border border-slate-200 bg-white">
      <header className="border-b border-slate-200 px-3 py-2">
        <h2 className="text-sm font-semibold">Teacher load ({day})</h2>
      </header>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-slate-500">
            <th className="px-3 py-1 text-left font-medium">Teacher</th>
            <th className="px-2 py-1 text-right font-medium">Today</th>
            <th className="px-3 py-1 text-right font-medium">Week</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="px-3 py-1">{r.name}</td>
              <td className={`px-2 py-1 text-right ${r.overDay ? "font-semibold text-hard" : ""}`}>
                {r.today}/{r.capDay}
              </td>
              <td className={`px-3 py-1 text-right ${r.overWeek ? "font-semibold text-hard" : ""}`}>
                {r.week}/{r.capWeek}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
