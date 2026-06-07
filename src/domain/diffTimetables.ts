// Version diff (PURE) — RB8. Compares two project snapshots by RENDERED CELL VALUE, not
// placement identity (versions are deep copies, so reference equality is meaningless). The
// cell signature is "Subject (Teacher / Teacher)" / "Free" — the same view the owner sees.

import { deriveMaps, findProfile, slotKey } from "./derive";
import { teachingSlots } from "./profile";
import type { Day, Id, Project, Timetable } from "./types";

export interface CellDiff {
  classId: Id;
  className: string;
  day: Day;
  slot: number;
  before: string;
  after: string;
}

function cellStrings(project: Project, timetable: Timetable): Map<string, string> {
  const profile = findProfile(project, timetable);
  const out = new Map<string, string>();
  if (!profile) return out;
  const maps = deriveMaps(project, timetable);
  const subj = new Map(project.subjects.map((s) => [s.id, s.name]));
  const tea = new Map(project.teachers.map((t) => [t.id, t.name]));
  for (const c of project.classes) {
    for (const day of profile.days) {
      for (const slot of teachingSlots(profile)) {
        const ev = maps.classCells.get(c.id)?.get(slotKey(day, slot))?.[0]?.event;
        const who = ev ? ev.teacherIds.map((t) => tea.get(t) ?? t).join(" / ") : "";
        const value = !ev ? "Free" : who ? `${subj.get(ev.subjectId) ?? ev.subjectId} (${who})` : subj.get(ev.subjectId) ?? ev.subjectId;
        out.set(`${c.id}#${day}#${slot}`, value);
      }
    }
  }
  return out;
}

function activeTable(project: Project): Timetable | undefined {
  return project.timetables.find((t) => t.id === project.activeTimetableId);
}

/** Cells whose rendered value differs between two project snapshots' active timetables. */
export function diffProjects(before: Project, after: Project): CellDiff[] {
  const ttA = activeTable(before);
  const ttB = activeTable(after);
  if (!ttA || !ttB) return [];
  const a = cellStrings(before, ttA);
  const b = cellStrings(after, ttB);
  const className = new Map(after.classes.map((c) => [c.id, c.name]));
  const keys = new Set([...a.keys(), ...b.keys()]);
  const out: CellDiff[] = [];
  for (const key of keys) {
    const before_ = a.get(key) ?? "—";
    const after_ = b.get(key) ?? "—";
    if (before_ !== after_) {
      const [classId, day, slot] = key.split("#");
      out.push({ classId: classId!, className: className.get(classId!) ?? classId!, day: day as Day, slot: Number(slot), before: before_, after: after_ });
    }
  }
  return out;
}
