// Per-template rule predicates (R1–R15). PURE. Each compiles a Rule to plain
// RuleHits (message + slots); domain/rules.ts wraps these into Violations with
// the right constraintId + severity. Kept separate from the engine so neither
// file exceeds the ~300-line budget (AGENTS §3).
//
// Operational definitions for spec-fuzzy templates are recorded in DECISIONS.md
// (R9 board-protect = "no non-core subject in periods 1–3").

import {
  buildClassLanes,
  buildTeacherDays,
  longestConsecutiveRun,
  type ClassLanes,
  type TeacherDays,
} from "./occupancy";
import { buildNames, type Names } from "./names";
import type { BlockActivity, Day, Id, Project, Rule, Timetable, Violation } from "./types";

export interface RuleHit {
  message: string;
  slots: Violation["slots"];
}

export interface Ctx {
  project: Project;
  timetable: Timetable;
  names: Names;
  lanes: ClassLanes;
  teacherDays: TeacherDays;
  ppd: number;
  days: Day[];
}

export function buildCtx(project: Project, timetable: Timetable): Ctx {
  const profile = project.profiles.find((p) => p.id === timetable.profileId);
  return {
    project,
    timetable,
    names: buildNames(project),
    lanes: buildClassLanes(project, timetable),
    teacherDays: buildTeacherDays(project, timetable),
    ppd: profile ? profile.periods.length : 6,
    days: profile ? profile.days : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  };
}

const scopeClasses = (ctx: Ctx, classIds: Id[]): Id[] =>
  classIds.length ? classIds : ctx.project.classes.map((c) => c.id);

/** Iterate every (classId, day, period, cell) for a set of classes. */
function* classCells(ctx: Ctx, classIds: Id[]) {
  for (const classId of classIds) {
    const byDay = ctx.lanes.get(classId);
    if (!byDay) continue;
    for (const day of ctx.days) {
      const cells = byDay.get(day);
      if (!cells) continue;
      for (const [period, cell] of cells) yield { classId, day, period, cell };
    }
  }
}

// Each case returns plain RuleHits; the engine attaches constraintId + severity.
// Messages name entities and slots (M16 AC groundwork).
export function hitsFor(rule: Rule, ctx: Ctx): RuleHit[] {
  const { names } = ctx;
  const out: RuleHit[] = [];
  const at = (day: Day, period: number) => `${day} P${period}`;

  switch (rule.template) {
    case "R1": {
      const allow = new Set(rule.periods);
      const subj = new Set(rule.subjectIds);
      for (const { classId, day, period, cell } of classCells(ctx, scopeClasses(ctx, rule.classIds))) {
        if (cell.isBlock || !subj.has(cell.subjectId) || allow.has(period)) continue;
        out.push({
          message: `${names.subject(cell.subjectId)} is at ${at(day, period)} for ${names.className(classId)} — only allowed in periods ${rule.periods.join(", ")}.`,
          slots: [{ classId, day, period }],
        });
      }
      return out;
    }
    case "R2": {
      const ban = new Set(rule.periods);
      const subj = new Set(rule.subjectIds);
      for (const { classId, day, period, cell } of classCells(ctx, scopeClasses(ctx, rule.classIds))) {
        if (cell.isBlock || !subj.has(cell.subjectId) || !ban.has(period)) continue;
        out.push({
          message: `${names.subject(cell.subjectId)} is at ${at(day, period)} for ${names.className(classId)} — never allowed in period ${rule.periods.join(", ")}.`,
          slots: [{ classId, day, period }],
        });
      }
      return out;
    }
    case "R3": {
      const mid = Math.ceil(ctx.ppd / 2);
      const subj = new Set(rule.subjectIds);
      for (const { classId, day, period, cell } of classCells(ctx, scopeClasses(ctx, rule.classIds))) {
        if (cell.isBlock || !subj.has(cell.subjectId)) continue;
        const inFirst = period <= mid;
        if (rule.half === "first" ? inFirst : !inFirst) continue;
        out.push({
          message: `${names.subject(cell.subjectId)} is at ${at(day, period)} for ${names.className(classId)} — should be in the ${rule.half} half of the day.`,
          slots: [{ classId, day, period }],
        });
      }
      return out;
    }
    case "R4": {
      const teacherId = names.classOf(rule.classId)?.classTeacherId;
      if (!teacherId) return out; // no homeroom set → rule inert until configured
      const byDay = ctx.lanes.get(rule.classId);
      for (const day of ctx.days) {
        const cell = byDay?.get(day)?.get(1);
        const ok =
          cell &&
          !cell.isBlock &&
          cell.teacherIds.includes(teacherId) &&
          (rule.subjectId === undefined || cell.subjectId === rule.subjectId);
        if (ok) continue;
        out.push({
          message: `${names.className(rule.classId)} does not have ${names.teacher(teacherId)} in period 1 on ${day} (class teacher should take P1 daily).`,
          slots: [{ classId: rule.classId, teacherId, day, period: 1 }],
        });
      }
      return out;
    }
    case "R5": {
      const byDay = ctx.lanes.get(rule.classId);
      const seen: { day: Day; period: number }[] = [];
      for (const day of ctx.days) {
        for (const [period, cell] of byDay?.get(day) ?? []) {
          if (!cell.isBlock && cell.subjectId === rule.subjectId) seen.push({ day, period });
        }
      }
      const target = rule.period ?? seen[0]?.period;
      if (target === undefined) return out;
      for (const { day, period } of seen) {
        if (period === target) continue;
        out.push({
          message: `${names.subject(rule.subjectId)} is at ${at(day, period)} for ${names.className(rule.classId)} but should be at period ${target} every day.`,
          slots: [{ classId: rule.classId, day, period }],
        });
      }
      return out;
    }
    case "R6": {
      const byDay = ctx.lanes.get(rule.classId);
      let doubles = 0;
      for (const day of ctx.days) {
        const periods = [...(byDay?.get(day) ?? [])]
          .filter(([, c]) => !c.isBlock && c.subjectId === rule.subjectId)
          .map(([p]) => p)
          .sort((a, b) => a - b);
        // count maximal runs of length ≥ 2 (one double period each)
        for (let i = 0; i < periods.length; ) {
          let j = i;
          while (j + 1 < periods.length && periods[j + 1]! === periods[j]! + 1) j++;
          if (j > i) doubles++;
          i = j + 1;
        }
      }
      if (doubles < rule.count) {
        out.push({
          message: `${names.subject(rule.subjectId)} has ${doubles} double period(s) in ${names.className(rule.classId)} this week (rule wants ${rule.count}).`,
          slots: [{ classId: rule.classId, day: ctx.days[0] ?? "Mon", period: 0 }],
        });
      }
      return out;
    }
    case "R7": {
      const block = ctx.project.activities.find(
        (a): a is BlockActivity => a.kind === "block" && a.id === rule.blockId,
      );
      if (!block) return out;
      const allowed = block.allowedDays ? new Set(block.allowedDays) : null;
      for (const placement of ctx.timetable.placements) {
        if (placement.activityId !== block.id) continue;
        if (allowed && !allowed.has(placement.day)) {
          out.push({
            message: `${block.name} is placed on ${placement.day} but may only run on ${(block.allowedDays ?? []).join(", ")}.`,
            slots: [{ day: placement.day, period: placement.period }],
          });
        }
        if (block.fixedStartPeriod !== undefined && placement.period !== block.fixedStartPeriod) {
          out.push({
            message: `${block.name} starts at P${placement.period} on ${placement.day} but must start at period ${block.fixedStartPeriod}.`,
            slots: [{ day: placement.day, period: placement.period }],
          });
        }
      }
      return out;
    }
    case "R8": {
      const byDay = ctx.teacherDays.get(rule.teacherId);
      for (const slot of rule.slots) {
        if (!byDay?.get(slot.day)?.includes(slot.period)) continue;
        out.push({
          message: `${names.teacher(rule.teacherId)} is scheduled at ${at(slot.day, slot.period)} but a rule marks them unavailable then.`,
          slots: [{ teacherId: rule.teacherId, day: slot.day, period: slot.period }],
        });
      }
      return out;
    }
    case "R9": {
      if (!names.classOf(rule.classId)?.isBoardClass) return out;
      const core = new Set(rule.coreSubjectIds);
      for (const { day, period, cell } of classCells(ctx, [rule.classId])) {
        if (cell.isBlock || period > 3 || core.has(cell.subjectId)) continue;
        out.push({
          message: `${names.className(rule.classId)} has ${names.subject(cell.subjectId)} at ${at(day, period)} — a board class should keep periods 1–3 for core subjects.`,
          slots: [{ classId: rule.classId, day, period }],
        });
      }
      return out;
    }
    case "R10": {
      for (const classId of scopeClasses(ctx, rule.classIds)) {
        const byDay = ctx.lanes.get(classId);
        const daysWith = ctx.days.filter((day) =>
          [...(byDay?.get(day) ?? [])].some(([, c]) => !c.isBlock && c.subjectId === rule.subjectId),
        ).length;
        if (daysWith > 0 && daysWith < rule.minDays) {
          out.push({
            message: `${names.subject(rule.subjectId)} is on only ${daysWith} day(s) for ${names.className(classId)} (rule wants ≥ ${rule.minDays}).`,
            slots: [{ classId, day: ctx.days[0] ?? "Mon", period: 0 }],
          });
        }
      }
      return out;
    }
    case "R11": {
      const byDay = ctx.lanes.get(rule.classId);
      for (const day of ctx.days) {
        const n = [...(byDay?.get(day) ?? [])].filter(
          ([, c]) => !c.isBlock && c.subjectId === rule.subjectId,
        ).length;
        if (n > rule.maxPerDay) {
          out.push({
            message: `${names.className(rule.classId)} has ${n} periods of ${names.subject(rule.subjectId)} on ${day} (max ${rule.maxPerDay}/day).`,
            slots: [{ classId: rule.classId, day, period: 0 }],
          });
        }
      }
      return out;
    }
    case "R12": {
      const byDay = ctx.teacherDays.get(rule.teacherId);
      let week = 0;
      for (const day of ctx.days) {
        const n = byDay?.get(day)?.length ?? 0;
        week += n;
        if (n > rule.maxPerDay) {
          out.push({
            message: `${names.teacher(rule.teacherId)} teaches ${n} periods on ${day} (max ${rule.maxPerDay}/day).`,
            slots: [{ teacherId: rule.teacherId, day, period: 0 }],
          });
        }
      }
      if (week > rule.maxPerWeek) {
        out.push({
          message: `${names.teacher(rule.teacherId)} teaches ${week} periods this week (max ${rule.maxPerWeek}/week).`,
          slots: [{ teacherId: rule.teacherId, day: ctx.days[0] ?? "Mon", period: 0 }],
        });
      }
      return out;
    }
    case "R13": {
      for (const [teacherId, byDay] of ctx.teacherDays) {
        for (const [day, periods] of byDay) {
          if (periods.length < 2) continue;
          const gaps = periods[periods.length - 1]! - periods[0]! + 1 - periods.length;
          for (let i = 0; i < gaps; i++) {
            out.push({
              message: `${names.teacher(teacherId)} has an idle gap on ${day}.`,
              slots: [{ teacherId, day, period: 0 }],
            });
          }
        }
      }
      return out;
    }
    case "R14": {
      const byDay = ctx.lanes.get(rule.classId);
      for (const day of ctx.days) {
        const cells = [...(byDay?.get(day) ?? [])];
        const before = cells.filter(([, c]) => !c.isBlock && c.subjectId === rule.beforeSubjectId).map(([p]) => p);
        const after = cells.filter(([, c]) => !c.isBlock && c.subjectId === rule.afterSubjectId).map(([p]) => p);
        if (!before.length || !after.length) continue;
        if (Math.max(...before) < Math.min(...after)) continue;
        out.push({
          message: `${names.subject(rule.beforeSubjectId)} should come before ${names.subject(rule.afterSubjectId)} on ${day} for ${names.className(rule.classId)}.`,
          slots: [{ classId: rule.classId, day, period: Math.min(...after) }],
        });
      }
      return out;
    }
    case "R15": {
      const byDay = ctx.teacherDays.get(rule.teacherId);
      for (const day of ctx.days) {
        const run = longestConsecutiveRun(byDay?.get(day) ?? []);
        if (run > rule.maxConsecutive) {
          out.push({
            message: `${names.teacher(rule.teacherId)} teaches ${run} periods in a row on ${day} (max ${rule.maxConsecutive}).`,
            slots: [{ teacherId: rule.teacherId, day, period: 0 }],
          });
        }
      }
      return out;
    }
  }
}
