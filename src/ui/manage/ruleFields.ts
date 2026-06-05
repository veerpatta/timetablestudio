// Field schema driving the generic rule builder (M16). PURE (no JSX): maps each
// template to ~8 reusable field kinds, and assembles a draft into a Rule (+ the
// entity updates R4/R7/R9 need). One place defines "what a template asks for",
// so the builder UI stays a thin renderer and "every family is expressible".

import type { EntityUpdate } from "../../domain/ruleEdit";
import type { Day, Rule, RuleSeverity, RuleTemplate } from "../../domain/types";

export type FieldKind =
  | "subjectMulti"
  | "subjectSingle"
  | "classSingle"
  | "classScope" // multi; empty = all classes
  | "teacher"
  | "periodSet"
  | "daySet"
  | "half"
  | "number"
  | "blockRef"
  | "coreSubjectMulti";

export interface FieldDesc {
  key: string;
  kind: FieldKind;
  label: string;
  optional?: boolean;
  min?: number;
  max?: number;
}

export const FIELDS: Record<RuleTemplate, FieldDesc[]> = {
  R1: [
    { key: "subjects", kind: "subjectMulti", label: "subjects" },
    { key: "classScope", kind: "classScope", label: "for classes" },
    { key: "periods", kind: "periodSet", label: "allowed periods" },
  ],
  R2: [
    { key: "subjects", kind: "subjectMulti", label: "subjects" },
    { key: "classScope", kind: "classScope", label: "for classes" },
    { key: "periods", kind: "periodSet", label: "banned periods" },
  ],
  R3: [
    { key: "subjects", kind: "subjectMulti", label: "subjects" },
    { key: "classScope", kind: "classScope", label: "for classes" },
    { key: "half", kind: "half", label: "half of day" },
  ],
  R4: [
    { key: "classId", kind: "classSingle", label: "class" },
    { key: "teacherId", kind: "teacher", label: "class teacher" },
    { key: "subjectId", kind: "subjectSingle", label: "subject (optional)", optional: true },
  ],
  R5: [
    { key: "classId", kind: "classSingle", label: "class" },
    { key: "subjectId", kind: "subjectSingle", label: "subject" },
    { key: "period", kind: "number", label: "period (optional)", optional: true, min: 1, max: 12 },
  ],
  R6: [
    { key: "classId", kind: "classSingle", label: "class" },
    { key: "subjectId", kind: "subjectSingle", label: "subject" },
    { key: "count", kind: "number", label: "times/week", min: 1, max: 12 },
  ],
  R7: [
    { key: "blockId", kind: "blockRef", label: "block" },
    { key: "days", kind: "daySet", label: "allowed days" },
    { key: "startPeriod", kind: "number", label: "start period", min: 1, max: 12 },
  ],
  R8: [
    { key: "teacherId", kind: "teacher", label: "teacher" },
    { key: "days", kind: "daySet", label: "unavailable days" },
    { key: "periods", kind: "periodSet", label: "unavailable periods" },
  ],
  R9: [
    { key: "classId", kind: "classSingle", label: "board class" },
    { key: "coreSubjects", kind: "coreSubjectMulti", label: "core subjects" },
  ],
  R10: [
    { key: "subjectId", kind: "subjectSingle", label: "subject" },
    { key: "classScope", kind: "classScope", label: "for classes" },
    { key: "minDays", kind: "number", label: "min days", min: 1, max: 6 },
  ],
  R11: [
    { key: "subjectId", kind: "subjectSingle", label: "subject" },
    { key: "classId", kind: "classSingle", label: "class" },
    { key: "maxPerDay", kind: "number", label: "max/day", min: 1, max: 12 },
  ],
  R12: [
    { key: "teacherId", kind: "teacher", label: "teacher" },
    { key: "maxPerDay", kind: "number", label: "max/day", min: 1, max: 12 },
    { key: "maxPerWeek", kind: "number", label: "max/week", min: 1, max: 72 },
  ],
  R13: [],
  R14: [
    { key: "classId", kind: "classSingle", label: "class" },
    { key: "beforeSubjectId", kind: "subjectSingle", label: "first subject" },
    { key: "afterSubjectId", kind: "subjectSingle", label: "then subject" },
  ],
  R15: [
    { key: "teacherId", kind: "teacher", label: "teacher" },
    { key: "maxConsecutive", kind: "number", label: "max in a row", min: 1, max: 12 },
  ],
};

export type RuleDraft = Record<string, string | string[] | number | undefined>;

const str = (v: RuleDraft[string]): string => (typeof v === "string" ? v : "");
const arr = (v: RuleDraft[string]): string[] => (Array.isArray(v) ? v : []);
const num = (v: RuleDraft[string]): number | undefined => (typeof v === "number" ? v : undefined);
const nums = (v: RuleDraft[string]): number[] => arr(v).map(Number).filter((n) => !Number.isNaN(n));
const days = (v: RuleDraft[string]): Day[] => arr(v) as Day[];

export interface BuildResult {
  rule: Rule;
  entityUpdates: EntityUpdate[];
}

/** Assemble a draft into a Rule (+ backing entity updates), or an error string. */
export function buildRule(
  template: RuleTemplate,
  draft: RuleDraft,
  meta: { id: string; severity: RuleSeverity; weight: number },
): BuildResult | { error: string } {
  const base = { id: meta.id, enabled: true, severity: meta.severity, weight: meta.weight };
  const need = (ok: boolean, msg: string) => (ok ? null : msg);

  switch (template) {
    case "R1":
    case "R2": {
      const subjectIds = arr(draft.subjects);
      const periods = nums(draft.periods);
      const err = need(subjectIds.length > 0, "Pick at least one subject") ?? need(periods.length > 0, "Pick at least one period");
      if (err) return { error: err };
      return { rule: { ...base, template, subjectIds, classIds: arr(draft.classScope), periods }, entityUpdates: [] };
    }
    case "R3": {
      const subjectIds = arr(draft.subjects);
      if (!subjectIds.length) return { error: "Pick at least one subject" };
      const half = str(draft.half) === "second" ? "second" : "first";
      return { rule: { ...base, template, subjectIds, classIds: arr(draft.classScope), half }, entityUpdates: [] };
    }
    case "R4": {
      const classId = str(draft.classId);
      const teacherId = str(draft.teacherId);
      const err = need(!!classId, "Pick a class") ?? need(!!teacherId, "Pick the class teacher");
      if (err) return { error: err };
      const subjectId = str(draft.subjectId) || undefined;
      return {
        rule: { ...base, template, classId, ...(subjectId ? { subjectId } : {}) },
        entityUpdates: [{ type: "classTeacher", classId, teacherId }],
      };
    }
    case "R5": {
      const classId = str(draft.classId);
      const subjectId = str(draft.subjectId);
      const err = need(!!classId, "Pick a class") ?? need(!!subjectId, "Pick a subject");
      if (err) return { error: err };
      const period = num(draft.period);
      return { rule: { ...base, template, classId, subjectId, ...(period ? { period } : {}) }, entityUpdates: [] };
    }
    case "R6": {
      const classId = str(draft.classId);
      const subjectId = str(draft.subjectId);
      const count = num(draft.count);
      const err = need(!!classId, "Pick a class") ?? need(!!subjectId, "Pick a subject") ?? need(!!count, "Set times/week");
      if (err) return { error: err };
      return { rule: { ...base, template, classId, subjectId, count: count! }, entityUpdates: [] };
    }
    case "R7": {
      const blockId = str(draft.blockId);
      const allowedDays = days(draft.days);
      const startPeriod = num(draft.startPeriod);
      const err = need(!!blockId, "Pick a block") ?? need(allowedDays.length > 0, "Pick the days") ?? need(!!startPeriod, "Set the start period");
      if (err) return { error: err };
      return { rule: { ...base, template, blockId }, entityUpdates: [{ type: "blockSchedule", blockId, allowedDays, fixedStartPeriod: startPeriod }] };
    }
    case "R8": {
      const teacherId = str(draft.teacherId);
      const ds = days(draft.days);
      const ps = nums(draft.periods);
      const err = need(!!teacherId, "Pick a teacher") ?? need(ds.length > 0 && ps.length > 0, "Pick days and periods");
      if (err) return { error: err };
      const slots = ds.flatMap((day) => ps.map((period) => ({ day, period })));
      return { rule: { ...base, template, teacherId, slots }, entityUpdates: [] };
    }
    case "R9": {
      const classId = str(draft.classId);
      const coreSubjectIds = arr(draft.coreSubjects);
      const err = need(!!classId, "Pick a class") ?? need(coreSubjectIds.length > 0, "Pick core subjects");
      if (err) return { error: err };
      return { rule: { ...base, template, classId, coreSubjectIds }, entityUpdates: [{ type: "boardClass", classId, value: true }] };
    }
    case "R10": {
      const subjectId = str(draft.subjectId);
      const minDays = num(draft.minDays);
      const err = need(!!subjectId, "Pick a subject") ?? need(!!minDays, "Set the minimum days");
      if (err) return { error: err };
      return { rule: { ...base, template, subjectId, classIds: arr(draft.classScope), minDays: minDays! }, entityUpdates: [] };
    }
    case "R11": {
      const subjectId = str(draft.subjectId);
      const classId = str(draft.classId);
      const maxPerDay = num(draft.maxPerDay);
      const err = need(!!subjectId, "Pick a subject") ?? need(!!classId, "Pick a class") ?? need(!!maxPerDay, "Set max/day");
      if (err) return { error: err };
      return { rule: { ...base, template, subjectId, classId, maxPerDay: maxPerDay! }, entityUpdates: [] };
    }
    case "R12": {
      const teacherId = str(draft.teacherId);
      const maxPerDay = num(draft.maxPerDay);
      const maxPerWeek = num(draft.maxPerWeek);
      const err = need(!!teacherId, "Pick a teacher") ?? need(!!maxPerDay && !!maxPerWeek, "Set both caps");
      if (err) return { error: err };
      return { rule: { ...base, template, teacherId, maxPerDay: maxPerDay!, maxPerWeek: maxPerWeek! }, entityUpdates: [] };
    }
    case "R13":
      return { rule: { ...base, template }, entityUpdates: [] };
    case "R14": {
      const classId = str(draft.classId);
      const beforeSubjectId = str(draft.beforeSubjectId);
      const afterSubjectId = str(draft.afterSubjectId);
      const err = need(!!classId, "Pick a class") ?? need(!!beforeSubjectId && !!afterSubjectId, "Pick both subjects");
      if (err) return { error: err };
      return { rule: { ...base, template, classId, beforeSubjectId, afterSubjectId }, entityUpdates: [] };
    }
    case "R15": {
      const teacherId = str(draft.teacherId);
      const maxConsecutive = num(draft.maxConsecutive);
      const err = need(!!teacherId, "Pick a teacher") ?? need(!!maxConsecutive, "Set the limit");
      if (err) return { error: err };
      return { rule: { ...base, template, teacherId, maxConsecutive: maxConsecutive! }, entityUpdates: [] };
    }
  }
}
