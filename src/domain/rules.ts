// Rule engine. PURE — turns each Rule (R1–R15) into Violations by running its
// predicate (domain/ruleChecks.hitsFor) and attaching the constraintId +
// severity. `must` rules join the hard count (called from validate()); `prefer`
// rules weight the soft score (called from solver/score.ts).

import { buildCtx, hitsFor, type RuleHit } from "./ruleChecks";
import { ruleSentence } from "./ruleText";
import type { Project, Rule, Timetable, Violation } from "./types";

function wrap(rule: Rule, hits: RuleHit[]): Violation[] {
  const severity = rule.severity === "must" ? "hard" : "soft";
  return hits.map((h) => ({
    constraintId: rule.template,
    severity,
    message: h.message,
    slots: h.slots,
  }));
}

/** Evaluate ONE rule regardless of enabled/severity (used by tests + dispatch). */
export function evaluateRule(project: Project, timetable: Timetable, rule: Rule): Violation[] {
  return wrap(rule, hitsFor(rule, buildCtx(project, timetable)));
}

/** Hard violations from enabled `must` rules (appended in validate()). */
export function mustRuleViolations(project: Project, timetable: Timetable): Violation[] {
  const active = project.rules.filter((r) => r.enabled && r.severity === "must");
  if (active.length === 0) return [];
  const ctx = buildCtx(project, timetable);
  return active.flatMap((rule) => wrap(rule, hitsFor(rule, ctx)));
}

/** Soft violations + weighted score from enabled `prefer` rules (added in scoreTimetable()). */
export function preferRuleScore(
  project: Project,
  timetable: Timetable,
): { violations: Violation[]; score: number } {
  const active = project.rules.filter((r) => r.enabled && r.severity === "prefer");
  if (active.length === 0) return { violations: [], score: 0 };
  const ctx = buildCtx(project, timetable);
  const violations: Violation[] = [];
  let score = 0;
  for (const rule of active) {
    const hits = hitsFor(rule, ctx);
    violations.push(...wrap(rule, hits));
    score += hits.length * rule.weight;
  }
  return { violations, score };
}

export { ruleSentence };
