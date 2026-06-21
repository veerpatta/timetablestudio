// Project-level fixes (PURE, M-B) — serializable, function-free specs for project edits
// that resolve feasibility blockers or coverage gaps. Serializable design means these can
// round-trip through the Web Worker without losing fidelity.
//
// The apply function is separated from the spec so specs can be stored in CoverageGapEntry,
// FeasibilityReport, etc. and reconstructed client-side without worker serialization problems.

import type { Id, Project } from "./types";
import type { Constraint } from "./types";

export type FixKind = "raise_teacher_cap" | "raise_constraint_cap" | "reduce_requirement" | "qualify_teacher";

export type FixSpec =
  | { kind: "raise_teacher_cap"; teacherId: Id; newMax: number }
  | { kind: "raise_constraint_cap"; constraintId: Id; newMax: number }
  | { kind: "reduce_requirement"; classId: Id; subjectId: Id; newPeriods: number }
  | { kind: "qualify_teacher"; teacherId: Id; subjectId: Id; classId: Id };

export interface ProjectFix {
  label: string;
  costEstimate: "low" | "medium" | "high";
  spec: FixSpec;
}

export function applyProjectFix(project: Project, spec: FixSpec): Project {
  switch (spec.kind) {
    case "raise_teacher_cap":
      return { ...project, teachers: project.teachers.map((t) => t.id === spec.teacherId ? { ...t, maxPerWeek: spec.newMax } : t) };
    case "raise_constraint_cap":
      return {
        ...project,
        constraints: project.constraints.map((c): Constraint => {
          if (c.id !== spec.constraintId || c.template !== "teacher_max_per_week") return c;
          return { ...c, params: { ...c.params, max: spec.newMax } };
        }),
      };
    case "reduce_requirement":
      return {
        ...project,
        requirements: project.requirements.map((r) =>
          r.classId === spec.classId && r.subjectId === spec.subjectId
            ? { ...r, periodsPerWeek: spec.newPeriods }
            : r,
        ),
      };
    case "qualify_teacher":
      if (project.qualifications.some((q) => q.teacherId === spec.teacherId && q.subjectId === spec.subjectId && q.classId === spec.classId)) {
        return project;
      }
      return { ...project, qualifications: [...project.qualifications, { teacherId: spec.teacherId, subjectId: spec.subjectId, classId: spec.classId }] };
  }
}

/** Suggest fixes for a coverage gap: reduce the requirement to what's actually placed, or
 *  qualify an additional teacher (when no qualified teacher exists at all). */
export function buildFixesForGap(
  project: Project,
  gap: { classId: Id; subjectId: Id; short: number; placed: number; reasons: string[] },
): ProjectFix[] {
  const fixes: ProjectFix[] = [];
  const className = project.classes.find((c) => c.id === gap.classId)?.name ?? gap.classId;
  const subjectName = project.subjects.find((s) => s.id === gap.subjectId)?.name ?? gap.subjectId;

  // Fix: reduce requirement to what's placed (always safe — just accepts the reality)
  if (gap.placed >= 0) {
    fixes.push({
      label: `Reduce ${className} ${subjectName} requirement to ${gap.placed} ${gap.placed === 1 ? "period" : "periods"} (what's currently placed)`,
      costEstimate: "medium",
      spec: { kind: "reduce_requirement", classId: gap.classId, subjectId: gap.subjectId, newPeriods: gap.placed },
    });
  }

  // Fix: qualify an additional teacher — suggest the most available schedulable teacher
  const alreadyQualified = new Set(
    project.qualifications.filter((q) => q.classId === gap.classId && q.subjectId === gap.subjectId).map((q) => q.teacherId),
  );
  const candidate = project.teachers
    .filter((t) => t.schedulable && !alreadyQualified.has(t.id))
    .sort((a, b) => b.maxPerWeek - a.maxPerWeek)[0];
  if (candidate && reasons_suggest_no_teacher(gap.reasons)) {
    fixes.push({
      label: `Qualify ${candidate.name} to teach ${subjectName} to ${className}`,
      costEstimate: "low",
      spec: { kind: "qualify_teacher", teacherId: candidate.id, subjectId: gap.subjectId, classId: gap.classId },
    });
  }

  return fixes;
}

function reasons_suggest_no_teacher(reasons: string[]): boolean {
  return reasons.some((r) => r.includes("No available teacher") || r.includes("qualified"));
}
