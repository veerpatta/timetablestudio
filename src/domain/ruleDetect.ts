// Auto-detect rules already lived-by in an existing timetable, proposed as
// pre-filled sentences for one-click confirm (M16). PURE. Detects:
//   • R4 P1 class-teacher anchors (a teacher who takes period 1 on a MAJORITY of
//     days — propose-and-confirm, so lean permissive; Class 6's 4-of-6 must pass)
//   • R7 block days/start (read straight from the block's actual placements)
//   • R6 recurring double periods (same subject+teacher in adjacent periods on
//     ≥2 days — matches two imported singles, NOT a duration-2 activity)
// Accepting a proposal patches the backing entity via addRuleWithBacking.

import { buildClassLanes } from "./occupancy";
import { ruleSentence } from "./ruleText";
import {
  addRuleWithBacking,
  nextRuleId,
  type EntityUpdate,
} from "./ruleEdit";
import { RULE_TEMPLATES } from "./ruleText";
import type { Day, Id, Project, Rule, Timetable } from "./types";

const DAY_ORDER: Day[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export interface RuleProposal {
  id: string;
  rule: Rule;
  sentence: string;
  entityUpdates: EntityUpdate[];
}

const weightOf = (template: Rule["template"]) =>
  RULE_TEMPLATES.find((t) => t.id === template)?.defaultWeight ?? 3;

function proposal(project: Project, rule: Rule, entityUpdates: EntityUpdate[]): RuleProposal {
  // Render the sentence against a project with the backing facts applied, so
  // R4/R7 read the detected teacher/days rather than "the class teacher".
  const previewed = entityUpdates.reduce(
    (p, u): Project =>
      u.type === "classTeacher"
        ? { ...p, classes: p.classes.map((c) => (c.id === u.classId ? { ...c, classTeacherId: u.teacherId } : c)) }
        : u.type === "blockSchedule"
          ? { ...p, activities: p.activities.map((a) => (a.kind === "block" && a.id === u.blockId ? { ...a, allowedDays: u.allowedDays, fixedStartPeriod: u.fixedStartPeriod } : a)) }
          : p,
    project,
  );
  return { id: rule.id, rule, sentence: ruleSentence(previewed, rule), entityUpdates };
}

/** Detect rules implied by the current timetable. */
export function detectRules(project: Project, timetable: Timetable): RuleProposal[] {
  const profile = project.profiles.find((p) => p.id === timetable.profileId);
  const days = profile ? profile.days : DAY_ORDER;
  const threshold = Math.floor(days.length / 2) + 1; // majority (4 of 6)
  const lanes = buildClassLanes(project, timetable);
  const out: RuleProposal[] = [];
  let counter = { ...project }; // for stable, unique ids as we accumulate

  const freshId = (template: Rule["template"]): Id => {
    const id = nextRuleId(counter, template);
    counter = { ...counter, rules: [...counter.rules, { id } as Rule] };
    return id;
  };

  // --- R4: period-1 class-teacher anchors ---
  for (const cls of project.classes) {
    const byDay = lanes.get(cls.id);
    if (!byDay) continue;
    const teacherCount = new Map<Id, number>();
    const subjectByTeacher = new Map<Id, Map<Id, number>>();
    for (const day of days) {
      const cell = byDay.get(day)?.get(1);
      if (!cell || cell.isBlock || cell.teacherIds.length !== 1) continue;
      const t = cell.teacherIds[0]!;
      teacherCount.set(t, (teacherCount.get(t) ?? 0) + 1);
      const sm = subjectByTeacher.get(t) ?? new Map<Id, number>();
      sm.set(cell.subjectId, (sm.get(cell.subjectId) ?? 0) + 1);
      subjectByTeacher.set(t, sm);
    }
    let best: Id | undefined;
    let bestN = 0;
    for (const [t, n] of teacherCount) {
      if (n > bestN) {
        best = t;
        bestN = n;
      }
    }
    if (!best || bestN < threshold) continue;
    // Fix the subject only if that teacher's most-common P1 subject also clears the bar.
    const sm = subjectByTeacher.get(best)!;
    let subjectId: Id | undefined;
    let subjN = 0;
    for (const [s, n] of sm) {
      if (n > subjN) {
        subjectId = s;
        subjN = n;
      }
    }
    const fixedSubject = subjN >= threshold ? subjectId : undefined;
    const id = freshId("R4");
    const rule: Rule = { id, template: "R4", enabled: true, severity: "must", weight: weightOf("R4"), classId: cls.id, ...(fixedSubject ? { subjectId: fixedSubject } : {}) };
    out.push(proposal(project, rule, [{ type: "classTeacher", classId: cls.id, teacherId: best }]));
  }

  // --- R7: block days + start, from actual placements ---
  for (const a of project.activities) {
    if (a.kind !== "block") continue;
    const placed = timetable.placements.filter((p) => p.activityId === a.id);
    if (placed.length === 0) continue;
    const blockDays = DAY_ORDER.filter((d) => placed.some((p) => p.day === d));
    const starts = new Set(placed.map((p) => p.period));
    const fixedStartPeriod = starts.size === 1 ? [...starts][0] : undefined;
    const id = freshId("R7");
    const rule: Rule = { id, template: "R7", enabled: true, severity: "must", weight: weightOf("R7"), blockId: a.id };
    out.push(proposal(project, rule, [{ type: "blockSchedule", blockId: a.id, allowedDays: blockDays, fixedStartPeriod }]));
  }

  // --- R6: recurring double periods (same subject+teacher adjacent, ≥2 days) ---
  for (const cls of project.classes) {
    const byDay = lanes.get(cls.id);
    if (!byDay) continue;
    const doubleDays = new Map<Id, number>(); // subjectId -> # of days with a double
    for (const day of days) {
      const cells = byDay.get(day);
      if (!cells) continue;
      const periods = [...cells.keys()].sort((x, y) => x - y);
      const seen = new Set<Id>();
      for (let i = 0; i + 1 < periods.length; i++) {
        const a = cells.get(periods[i]!)!;
        const b = cells.get(periods[i + 1]!)!;
        if (periods[i + 1] !== periods[i]! + 1) continue;
        if (a.isBlock || b.isBlock || a.subjectId !== b.subjectId) continue;
        if (a.teacherIds.join("+") !== b.teacherIds.join("+")) continue;
        if (seen.has(a.subjectId)) continue; // count each subject once per day
        seen.add(a.subjectId);
        doubleDays.set(a.subjectId, (doubleDays.get(a.subjectId) ?? 0) + 1);
      }
    }
    for (const [subjectId, count] of doubleDays) {
      if (count < 2) continue;
      const id = freshId("R6");
      const rule: Rule = { id, template: "R6", enabled: true, severity: "prefer", weight: weightOf("R6"), classId: cls.id, subjectId, count };
      out.push(proposal(project, rule, []));
    }
  }

  return out;
}

/** Accept a proposal: add its rule and patch any backing entity (one path). */
export function acceptProposal(project: Project, p: RuleProposal): Project {
  return addRuleWithBacking(project, p.rule, p.entityUpdates);
}
