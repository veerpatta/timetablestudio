// Teacher load & insights view (RB4). All numbers come from domain/insights (which is a
// projection of deriveMaps), so they always agree with the grid. Plain language only:
// a balance sentence, a teacher×day load heatmap with a weekly total + free count, and a
// "who's free?" finder for covering a slot. No codes, no jargon.

import { useState } from "react";
import { findProfile } from "../../domain/derive";
import { allTeacherLoads, freeTeachers, loadBalance } from "../../domain/insights";
import { slotLabel, teachingSlots } from "../../domain/profile";
import type { Day, Project, Timetable } from "../../domain/types";

const DAYS: Day[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function tint(count: number, max: number): string {
  if (count === 0) return "bg-white text-slate-300";
  const r = max === 0 ? 0 : count / max;
  if (r > 0.85) return "bg-sky-600 text-white";
  if (r > 0.6) return "bg-sky-400 text-white";
  if (r > 0.35) return "bg-sky-200";
  return "bg-sky-50";
}

export function InsightsView({ project, timetable }: { project: Project; timetable: Timetable }): React.ReactElement {
  const profile = findProfile(project, timetable);
  const loads = allTeacherLoads(project, timetable);
  const balance = loadBalance(project, timetable);
  const maxDay = Math.max(1, ...loads.flatMap((l) => DAYS.map((d) => l.perDay[d] ?? 0)));

  const teachingIdx = profile ? teachingSlots(profile) : [];
  const [day, setDay] = useState<Day>("Mon");
  const [slot, setSlot] = useState<number>(teachingIdx[0] ?? 1);
  const free = profile ? freeTeachers(project, timetable, day, slot) : [];
  const nameOf = (id: string) => project.teachers.find((t) => t.id === id)?.name ?? id;

  const balanceWord = balance.spread <= 4 ? "fairly balanced" : balance.spread <= 8 ? "a little uneven" : "uneven";

  return (
    <div className="space-y-4">
      <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
        Weekly load runs <b>{balance.min}</b>–<b>{balance.max}</b> periods per teacher (average{" "}
        <b>{balance.avg.toFixed(1)}</b>) — {balanceWord}.
      </p>

      <div className="overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border bg-slate-100 p-2 text-left">Teacher</th>
              {DAYS.map((d) => (
                <th key={d} className="border bg-slate-100 p-2">{d}</th>
              ))}
              <th className="border bg-slate-100 p-2">Week</th>
              <th className="border bg-slate-100 p-2">Free</th>
            </tr>
          </thead>
          <tbody>
            {loads.map((l) => (
              <tr key={l.teacherId}>
                <th className="border bg-slate-50 p-2 text-left font-medium">{l.name}</th>
                {DAYS.map((d) => {
                  const c = l.perDay[d] ?? 0;
                  return (
                    <td key={d} className={`border p-2 text-center ${tint(c, maxDay)}`}>{c || "·"}</td>
                  );
                })}
                <td className="border p-2 text-center font-semibold">{l.used}</td>
                <td className="border p-2 text-center text-emerald-700">{l.free}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border border-slate-200 p-3">
        <h2 className="mb-2 text-sm font-semibold">Who’s free?</h2>
        <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
          <select className="rounded border border-slate-300 px-2 py-1" value={day} onChange={(e) => setDay(e.target.value as Day)}>
            {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <select className="rounded border border-slate-300 px-2 py-1" value={slot} onChange={(e) => setSlot(Number(e.target.value))}>
            {teachingIdx.map((s) => <option key={s} value={s}>{profile ? slotLabel(profile, s) : s}</option>)}
          </select>
        </div>
        {free.length === 0 ? (
          <p className="text-sm text-slate-500">No teacher is free then.</p>
        ) : (
          <p className="text-sm text-slate-700">
            <b>{free.length}</b> free: {free.map(nameOf).join(", ")}.
          </p>
        )}
      </div>
    </div>
  );
}
