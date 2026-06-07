// "Suggest constraints" (PURE) — C4. Proposes constraints that are ALREADY TRUE of the
// current timetable, so adding one never creates a fresh violation (property-tested:
// each suggestion enabled alone → evaluateConstraints returns []). Descriptive, not
// prescriptive — it surfaces patterns the owner can lock in with one click. Deduped by
// (template, primary target). Mirrors the proven RB6 rule-suggester pattern.

import { byDay, firstHalf, lessonsByClass, lessonsByTeacher } from "./constraintShared";
import { deriveMaps, findProfile } from "./derive";
import type { Constraint, Id, Project, Timetable } from "./types";

let seq = 0;
const sid = (template: string, key: string) => `sug:${template}:${key}:${seq++}`;

export function suggestConstraints(project: Project, timetable: Timetable): Constraint[] {
  const profile = findProfile(project, timetable);
  if (!profile) return [];
  const maps = deriveMaps(project, timetable);
  const fh = firstHalf(profile);
  const out: Constraint[] = [];
  const seen = new Set<string>();
  const push = (key: string, c: Omit<Constraint, "id">) => {
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ ...c, id: sid(c.template, key) } as Constraint);
  };

  // Teacher caps — from observed weekly / daily maxima.
  for (const t of project.teachers) {
    if (!t.schedulable) continue;
    const ls = lessonsByTeacher(maps, t.id);
    if (ls.length === 0) continue;
    push(`tmw:${t.id}`, { scope: "teacher", severity: "prefer", weight: 3, enabled: true, template: "teacher_max_per_week", params: { teacherId: t.id, max: ls.length } });
    const perDay = Math.max(...[...byDay(ls).values()].map((d) => d.length));
    push(`tmd:${t.id}`, { scope: "teacher", severity: "prefer", weight: 3, enabled: true, template: "teacher_max_per_day", params: { teacherId: t.id, max: perDay } });
  }

  // Subjects already confined to one half of the day, per class.
  for (const klass of project.classes) {
    const bySub = new Map<Id, number[]>();
    for (const l of lessonsByClass(maps, klass.id)) (bySub.get(l.event.subjectId) ?? bySub.set(l.event.subjectId, []).get(l.event.subjectId)!).push(l.slot);
    for (const [subjectId, slots] of bySub) {
      const subj = project.subjects.find((s) => s.id === subjectId);
      if (!subj || subj.kind !== "academic" || slots.length < 2) continue;
      const allFirst = slots.every((s) => fh.has(s));
      const allSecond = slots.every((s) => !fh.has(s));
      if (allFirst || allSecond)
        push(`half:${klass.id}:${subjectId}`, { scope: "subject", severity: "prefer", weight: 3, enabled: true, template: "subject_half_of_day", params: { subjectIds: [subjectId], classIds: [klass.id], half: allFirst ? "first" : "second" } });
    }
  }

  return out;
}
