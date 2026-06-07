// Plain-language rule sentences (RB6). ONE phrasing, used as both the toggle label in the
// rules UI and the basis of violation messages — never a constraint code on the main
// surface (AGENTS / north-star principle 5). Each template maps to a readable sentence.

import { slotLabel } from "./profile";
import type { Profile, Project, Rule } from "./types";

function defaultProfile(project: Project): Profile | undefined {
  const active = project.timetables.find((t) => t.id === project.activeTimetableId);
  return project.profiles.find((p) => p.id === active?.profileId) ?? project.profiles[0];
}

export function ruleSentence(rule: Rule, project: Project): string {
  const profile = defaultProfile(project);
  const sName = (id: string) => project.subjects.find((s) => s.id === id)?.name ?? id;
  const cName = (id: string) => project.classes.find((c) => c.id === id)?.name ?? id;
  const tName = (id: string) => project.teachers.find((t) => t.id === id)?.name ?? id;
  const eName = (id: string) => {
    const e = project.events.find((x) => x.id === id);
    return e ? sName(e.subjectId) : id;
  };
  const sl = (n: number) => (profile ? slotLabel(profile, n) : `slot ${n}`);
  const list = (ids: string[], f: (x: string) => string) => ids.map(f).join(", ");

  switch (rule.template) {
    case "R1":
      return `${list(rule.subjectIds, sName)} only in ${rule.slots.map(sl).join(", ")} (${list(rule.classIds, cName)})`;
    case "R2":
      return `${list(rule.subjectIds, sName)} never in ${rule.slots.map(sl).join(", ")} (${list(rule.classIds, cName)})`;
    case "R3":
      return `${list(rule.subjectIds, sName)} in the ${rule.half} half of the day (${list(rule.classIds, cName)})`;
    case "R4":
      return `The class teacher takes the first period every day in ${cName(rule.classId)}${rule.subjectId ? ` (${sName(rule.subjectId)})` : ""}`;
    case "R5":
      return `${sName(rule.subjectId)} at the same period every day in ${cName(rule.classId)}${rule.slot != null ? ` (${sl(rule.slot)})` : ""}`;
    case "R6":
      return `${sName(rule.subjectId)} as a double period ${rule.count}×/week in ${cName(rule.classId)}`;
    case "R7":
      return `${eName(rule.eventId)} block runs at a consistent time`;
    case "R8":
      return `${tName(rule.teacherId)} is not available at ${rule.slots.map((s) => `${s.day} ${sl(s.slot)}`).join(", ")}`;
    case "R9":
      return `${cName(rule.classId)} is a board class — keep core subjects (${list(rule.coreSubjectIds, sName)}) in the first three periods`;
    case "R10":
      return `${sName(rule.subjectId)} spread across at least ${rule.minDays} days (${list(rule.classIds, cName)})`;
    case "R11":
      return `At most ${rule.maxPerDay} periods a day of ${sName(rule.subjectId)} for ${cName(rule.classId)}`;
    case "R12":
      return `${tName(rule.teacherId)} teaches at most ${rule.maxPerDay} periods a day and ${rule.maxPerWeek} a week`;
    case "R13":
      return `Teachers' days stay compact (few free gaps)`;
    case "R14":
      return `${sName(rule.beforeSubjectId)} comes before ${sName(rule.afterSubjectId)} on the same day in ${cName(rule.classId)}`;
    case "R15":
      return `${tName(rule.teacherId)} teaches at most ${rule.maxConsecutive} periods in a row`;
  }
}
