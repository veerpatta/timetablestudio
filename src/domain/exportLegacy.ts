// Legacy rawData export (PURE) — RB7. Emits the plain-text format the OLD viewer parses
// (docs/DATA_MODEL.md § "Legacy export"), so the rebuilt app stays one-directionally
// compatible: it exports the legacy format, never imports code from it (AGENTS §1).
//
// One block per day: a "DayName" line, a "Class,Period 1..N" header, then one row per
// class in school order. A cell is "Subject (Teacher / Teacher)" — multi-teacher joined
// by " / ", a teacherless study/free event just "Subject", an empty slot "Free". A joint/
// team event expands to the same cell for every member class/period (derive() does this).

import { deriveMaps, findProfile, slotKey } from "./derive";
import { teachingSlots } from "./profile";
import type { Day, Id, Project } from "./types";

const DAY_FULL: Record<Day, string> = {
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
};

export function exportLegacyRawData(project: Project, timetableId: Id): string {
  const tt = project.timetables.find((t) => t.id === timetableId);
  const profile = tt && findProfile(project, tt);
  if (!tt || !profile) return "";
  const maps = deriveMaps(project, tt);
  const teach = teachingSlots(profile);
  const subj = new Map(project.subjects.map((s) => [s.id, s.name]));
  const tea = new Map(project.teachers.map((t) => [t.id, t.name]));

  const cell = (classId: Id, day: Day, slot: number): string => {
    const ev = maps.classCells.get(classId)?.get(slotKey(day, slot))?.[0]?.event;
    if (!ev) return "Free";
    const who = ev.teacherIds.map((t) => tea.get(t) ?? t).join(" / ");
    const name = subj.get(ev.subjectId) ?? ev.subjectId;
    return who ? `${name} (${who})` : name;
  };

  const lines: string[] = [];
  for (const day of profile.days) {
    lines.push(DAY_FULL[day]);
    lines.push(["Class", ...teach.map((_, i) => `Period ${i + 1}`)].join(","));
    for (const c of project.classes) lines.push([c.name, ...teach.map((s) => cell(c.id, day, s))].join(","));
    lines.push("");
  }
  return lines.join("\n").trimEnd() + "\n";
}
