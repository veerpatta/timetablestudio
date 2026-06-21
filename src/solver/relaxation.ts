// Relaxation engine (M-E). Four-step algorithm:
//   1. Solve with all constraints as-is → if complete, done (no relaxation needed)
//   2. Auto-relax tier-1 ("Firm") rules to prefer, re-solve → report what was bent
//   3. Still incomplete? Report tier-1 candidates for owner approval
//   4. Always return — never throws, never leaves the UI stuck
//
// Tiers: 0=Iron (never bend), 1=Firm (bend only reported), 2=Soft (auto-relax), 3=Wish
// Tiers 0+1 have severity=must; 2+3 have severity=prefer.
//
// Guardrail: the returned project ALWAYS has the original constraints grafted back.
// A tier-1 demotion inside the solve never leaks into the caller's data.

import { constraintSentence, constraintTier } from "../domain/constraints";
import { validate } from "../domain/validate";
import type { Constraint, Id, Project } from "../domain/types";
import type { FilledPlacement } from "./fill";
import { generate } from "./generate";

export interface RelaxationItem {
  constraintId: string;   // constraint instance id (not template)
  sentence: string;        // human-readable description
  tier: 0 | 1 | 2 | 3;
  violationCount: number;  // violations of this rule in the result
}

export interface RelaxationResult {
  project: Project;                     // original constraints always grafted back
  remainingShortfall: number;
  step: 1 | 2 | "partial";             // 1: no relaxation; 2: tier-1 bent + complete; "partial": still incomplete
  relaxed: RelaxationItem[];            // tier-1 rules bent to complete (step-2)
  tier1Suggestions: RelaxationItem[];   // tier-1 candidates to offer for approval (step-3/"partial")
  added: FilledPlacement[];
}

export function solveWithRelaxation(
  project: Project,
  timetableId: Id,
  opts?: { seeds?: number; budgetMs?: number },
): RelaxationResult {
  // Step 1: generate with original project (tier-0+1 both hard via severity=must)
  const step1 = generate(project, timetableId, opts);
  if (step1.remainingShortfall === 0) {
    return {
      project: step1.project,
      remainingShortfall: 0,
      step: 1,
      relaxed: [],
      tier1Suggestions: [],
      added: step1.added,
    };
  }

  // Identify tier-1 constraints eligible for relaxation
  const tier1Cs = project.constraints.filter((c) => c.enabled && constraintTier(c) === 1);
  if (tier1Cs.length === 0) {
    // No tier-1 constraints to demote — return best partial from step 1
    return {
      project: step1.project,
      remainingShortfall: step1.remainingShortfall,
      step: "partial",
      relaxed: [],
      tier1Suggestions: [],
      added: step1.added,
    };
  }

  // Step 2: demote tier-1 constraints must → prefer, re-solve
  const tier1IdSet = new Set(tier1Cs.map((c) => c.id));
  const relaxedProject: Project = {
    ...project,
    constraints: project.constraints.map((c) =>
      tier1IdSet.has(c.id) ? { ...c, severity: "prefer" as const } : c,
    ),
  };

  const step2 = generate(relaxedProject, timetableId, opts);

  // Graft original constraints back — NEVER leak demoted severities (advisor guardrail #1)
  const graftedProject: Project = { ...step2.project, constraints: project.constraints };

  // Detect bent tier-1 constraints by running validate() on the grafted project.
  // Tier-1 constraints are back to must → their violations now appear as hard.
  const tt2 = graftedProject.timetables.find((t) => t.id === timetableId);
  const violations = tt2 ? validate(graftedProject, tt2) : [];
  const hardViolations = violations.filter((v) => v.severity === "hard");

  // Map template-level violations to tier-1 constraint instances.
  // Stable sort by id for determinism (advisor guardrail #3).
  const bentTemplates = new Set(hardViolations.map((v) => v.constraintId));

  const toItem = (c: Constraint): RelaxationItem => ({
    constraintId: c.id,
    sentence: constraintSentence(project, c),
    tier: constraintTier(c),
    violationCount: hardViolations.filter((v) => v.constraintId === c.template).length,
  });

  const bentT1Cs = [...tier1Cs]
    .filter((c) => bentTemplates.has(c.template))
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  const relaxed: RelaxationItem[] = bentT1Cs.map(toItem);

  if (step2.remainingShortfall === 0) {
    // Complete — finished by bending tier-1 rules
    return {
      project: graftedProject,
      remainingShortfall: 0,
      step: 2,
      relaxed,
      tier1Suggestions: [],
      added: step2.added,
    };
  }

  // Step 3 / 4: still incomplete — list tier-1 rules as candidates for owner approval
  const tier1Suggestions: RelaxationItem[] = [...tier1Cs]
    .sort((a, b) => (a.id < b.id ? -1 : 1))
    .map(toItem);

  return {
    project: graftedProject,
    remainingShortfall: step2.remainingShortfall,
    step: "partial",
    relaxed,
    tier1Suggestions,
    added: step2.added,
  };
}
