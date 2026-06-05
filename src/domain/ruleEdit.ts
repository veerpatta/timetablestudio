// Pure CRUD for the v2 Rule system + the entity-aware "add with backing" used by
// BOTH the manual rule builder (M16 UI) and detect-accept (domain/ruleDetect).
// Some rules (R4/R7/R9) read a structural fact off an entity rather than storing
// it (SchoolClass.classTeacherId / isBoardClass, BlockActivity.allowedDays /
// fixedStartPeriod); accepting such a rule must patch that entity. Keeping ONE
// path avoids the two-sources drift flagged in DECISIONS (M14).

import type { BlockActivity, Day, Id, Project, Rule } from "./types";

export function addRule(project: Project, rule: Rule): Project {
  const exists = project.rules.some((r) => r.id === rule.id);
  return {
    ...project,
    rules: exists ? project.rules.map((r) => (r.id === rule.id ? rule : r)) : [...project.rules, rule],
  };
}

export function updateRule(project: Project, rule: Rule): Project {
  return { ...project, rules: project.rules.map((r) => (r.id === rule.id ? rule : r)) };
}

export function removeRule(project: Project, ruleId: Id): Project {
  return { ...project, rules: project.rules.filter((r) => r.id !== ruleId) };
}

export function toggleRule(project: Project, ruleId: Id): Project {
  return {
    ...project,
    rules: project.rules.map((r) => (r.id === ruleId ? { ...r, enabled: !r.enabled } : r)),
  };
}

/** A structural-fact patch that backs an entity-reading rule (R4/R7/R9). */
export type EntityUpdate =
  | { type: "classTeacher"; classId: Id; teacherId?: Id }
  | { type: "boardClass"; classId: Id; value: boolean }
  | { type: "blockSchedule"; blockId: Id; allowedDays: Day[]; fixedStartPeriod?: number };

export function applyEntityUpdate(project: Project, u: EntityUpdate): Project {
  switch (u.type) {
    case "classTeacher":
      return {
        ...project,
        classes: project.classes.map((c) =>
          c.id === u.classId ? { ...c, classTeacherId: u.teacherId } : c,
        ),
      };
    case "boardClass":
      return {
        ...project,
        classes: project.classes.map((c) =>
          c.id === u.classId ? { ...c, isBoardClass: u.value } : c,
        ),
      };
    case "blockSchedule":
      return {
        ...project,
        activities: project.activities.map((a) =>
          a.kind === "block" && a.id === u.blockId
            ? ({ ...a, allowedDays: u.allowedDays, fixedStartPeriod: u.fixedStartPeriod } as BlockActivity)
            : a,
        ),
      };
  }
}

export function applyEntityUpdates(project: Project, updates: EntityUpdate[]): Project {
  return updates.reduce(applyEntityUpdate, project);
}

/** Add a rule AND patch any entity it reads. The single add path for the UI
 * builder and detect-accept alike. */
export function addRuleWithBacking(
  project: Project,
  rule: Rule,
  updates: EntityUpdate[] = [],
): Project {
  return applyEntityUpdates(addRule(project, rule), updates);
}

/** A fresh unique rule id for a template (deterministic — no randomness in domain). */
export function nextRuleId(project: Project, template: string): Id {
  let n = project.rules.length + 1;
  let id = `${template}-${n}`;
  while (project.rules.some((r) => r.id === id)) id = `${template}-${++n}`;
  return id;
}
