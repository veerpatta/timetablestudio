// "Indian K-12 defaults" preset bundle (M16): a small set of sensible rules the
// owner can apply optionally at setup. PURE. Every rule is GUARDED against
// entities the project doesn't have — the real roster may not match these names,
// so a preset never references a missing subject or teacher.

import { RULE_TEMPLATES } from "./ruleText";
import type { Project, Rule } from "./types";

const HEAVY = ["Maths", "Mathematics", "Science", "Physics", "Chemistry", "Biology"];
const LIGHT = ["CCS", "Games", "Revision", "Core Revision", "Eng. Revision", "English Revision"];

const weightOf = (template: Rule["template"]) =>
  RULE_TEMPLATES.find((t) => t.id === template)?.defaultWeight ?? 3;

/** Build the default rules that make sense for THIS project's entities. */
export function indianK12Defaults(project: Project): Rule[] {
  const subjectIds = new Set(project.subjects.map((s) => s.id));
  const rules: Rule[] = [];

  // Heavy subjects early — only periods 1–3 (prefer).
  const heavy = HEAVY.filter((s) => subjectIds.has(s));
  if (heavy.length) {
    rules.push({
      id: "preset-heavy-early",
      template: "R1",
      enabled: true,
      severity: "prefer",
      weight: weightOf("R1"),
      subjectIds: heavy,
      classIds: [],
      periods: [1, 2, 3],
    });
  }

  // Light/filler subjects never in period 1 (prefer).
  const light = LIGHT.filter((s) => subjectIds.has(s));
  if (light.length) {
    rules.push({
      id: "preset-light-not-p1",
      template: "R2",
      enabled: true,
      severity: "prefer",
      weight: weightOf("R2"),
      subjectIds: light,
      classIds: [],
      periods: [1],
    });
  }

  // Teacher daily/weekly caps from each teacher's own limits (must).
  for (const t of project.teachers) {
    rules.push({
      id: `preset-cap-${t.id}`,
      template: "R12",
      enabled: true,
      severity: "must",
      weight: weightOf("R12"),
      teacherId: t.id,
      maxPerDay: t.maxPeriodsPerDay,
      maxPerWeek: t.maxPeriodsPerWeek,
    });
  }

  // Keep teachers' days compact (prefer; global).
  rules.push({ id: "preset-compact", template: "R13", enabled: true, severity: "prefer", weight: weightOf("R13") });

  return rules;
}
