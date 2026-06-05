// Plain-language rendering of a Rule as one readable sentence. PURE.
// This is the SINGLE source of a rule's phrasing — used both in the Violation
// message (domain/rules.ts) and the M16 rule-builder UI label. Never two phrasings.

import { buildNames, listDays, listNames, listPeriods, type Names } from "./names";
import type { BlockActivity, Project, Rule, RuleTemplate } from "./types";

const half = (h: "first" | "second") => `the ${h} half of the day`;

/** Render a rule as a sentence, e.g. "CCS is never in period 1 (Class 8)". */
export function ruleSentence(project: Project, rule: Rule, names: Names = buildNames(project)): string {
  const { teacher, className, subject } = names;
  const scope = (classIds: string[]) =>
    classIds.length ? ` (${listNames(classIds, className)})` : "";
  switch (rule.template) {
    case "R1":
      return `${listNames(rule.subjectIds, subject)} is only allowed in periods ${listPeriods(rule.periods)}${scope(rule.classIds)}`;
    case "R2":
      return `${listNames(rule.subjectIds, subject)} is never in period ${listPeriods(rule.periods)}${scope(rule.classIds)}`;
    case "R3":
      return `${listNames(rule.subjectIds, subject)} is in ${half(rule.half)}${scope(rule.classIds)}`;
    case "R4": {
      const t = names.classOf(rule.classId)?.classTeacherId;
      const who = t ? teacher(t) : "the class teacher";
      const subj = rule.subjectId ? ` (${subject(rule.subjectId)})` : "";
      return `${who} is class teacher of ${className(rule.classId)} and takes period 1 daily${subj}`;
    }
    case "R5": {
      const at = rule.period ? ` at period ${rule.period}` : "";
      return `${subject(rule.subjectId)} is at the same period every day in ${className(rule.classId)}${at}`;
    }
    case "R6":
      return `${subject(rule.subjectId)} is a double period ${rule.count}×/week in ${className(rule.classId)}`;
    case "R7": {
      const block = project.activities.find(
        (a): a is BlockActivity => a.kind === "block" && a.id === rule.blockId,
      );
      const name = block?.name ?? rule.blockId;
      const days = block?.allowedDays?.length ? listDays(block.allowedDays) : "the allowed days";
      const start = block?.fixedStartPeriod ? `, starting period ${block.fixedStartPeriod}` : "";
      return `${name} runs only on ${days}${start}`;
    }
    case "R8":
      return `${teacher(rule.teacherId)} is not available ${rule.slots.map((s) => `${s.day} P${s.period}`).join(", ")}`;
    case "R9":
      return `${className(rule.classId)} is a board class — protect its core subjects (${listNames(rule.coreSubjectIds, subject)})`;
    case "R10":
      return `${subject(rule.subjectId)} is spread across at least ${rule.minDays} different days${scope(rule.classIds)}`;
    case "R11":
      return `At most ${rule.maxPerDay} periods/day of ${subject(rule.subjectId)} for ${className(rule.classId)}`;
    case "R12":
      return `${teacher(rule.teacherId)} teaches at most ${rule.maxPerDay} periods/day and ${rule.maxPerWeek} per week`;
    case "R13":
      return `Teachers' days are kept compact (few free gaps)`;
    case "R14":
      return `${subject(rule.beforeSubjectId)} comes before ${subject(rule.afterSubjectId)} on the same day in ${className(rule.classId)}`;
    case "R15":
      return `${teacher(rule.teacherId)} teaches at most ${rule.maxConsecutive} periods in a row`;
  }
}

/** Template catalog (for the M16 rule builder): title + sensible defaults. */
export interface RuleTemplateMeta {
  id: RuleTemplate;
  title: string;
  defaultSeverity: "must" | "prefer";
  defaultWeight: number;
}

export const RULE_TEMPLATES: RuleTemplateMeta[] = [
  { id: "R1", title: "Subject only in certain periods", defaultSeverity: "prefer", defaultWeight: 3 },
  { id: "R2", title: "Subject never in a period", defaultSeverity: "must", defaultWeight: 3 },
  { id: "R3", title: "Subject in the first/second half", defaultSeverity: "prefer", defaultWeight: 3 },
  { id: "R4", title: "Class teacher takes period 1", defaultSeverity: "must", defaultWeight: 5 },
  { id: "R5", title: "Subject same period every day", defaultSeverity: "prefer", defaultWeight: 3 },
  { id: "R6", title: "Subject as a double period", defaultSeverity: "prefer", defaultWeight: 3 },
  { id: "R7", title: "Block runs only on certain days", defaultSeverity: "must", defaultWeight: 5 },
  { id: "R8", title: "Teacher not available", defaultSeverity: "must", defaultWeight: 5 },
  { id: "R9", title: "Board class — protect core subjects", defaultSeverity: "prefer", defaultWeight: 4 },
  { id: "R10", title: "Subject spread across days", defaultSeverity: "prefer", defaultWeight: 4 },
  { id: "R11", title: "Max periods/day of a subject", defaultSeverity: "must", defaultWeight: 3 },
  { id: "R12", title: "Teacher daily/weekly caps", defaultSeverity: "must", defaultWeight: 5 },
  { id: "R13", title: "Teachers' days compact", defaultSeverity: "prefer", defaultWeight: 5 },
  { id: "R14", title: "Subject before another subject", defaultSeverity: "prefer", defaultWeight: 2 },
  { id: "R15", title: "Teacher max consecutive periods", defaultSeverity: "prefer", defaultWeight: 2 },
];
