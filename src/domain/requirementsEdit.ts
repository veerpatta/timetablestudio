// Requirement (weekly subject quota) editing (PURE, immutable) — OVERHAUL B. The "compulsory
// subjects per week" the owner authorises in the Setup → Quotas screen. setRequirement is an
// UPSERT (the cell inspector and the quota grid both create-or-update one (class, subject)
// row); removeRequirement drops it. New rows seed teacherIds from existing qualifications so
// the solver already knows who can teach it. Entity removal pruning lives in entityEdit.ts.

import type { Id, Project, Requirement } from "./types";

/** Create or update the weekly period quota for (class, subject). periodsPerWeek is clamped ≥0. */
export function setRequirement(project: Project, classId: Id, subjectId: Id, periodsPerWeek: number): Project {
  const n = Math.max(0, Math.round(periodsPerWeek));
  const existing = project.requirements.find((r) => r.classId === classId && r.subjectId === subjectId);
  if (existing) {
    return {
      ...project,
      requirements: project.requirements.map((r) => (r === existing ? { ...r, periodsPerWeek: n } : r)),
    };
  }
  const teacherIds = project.qualifications.filter((q) => q.classId === classId && q.subjectId === subjectId).map((q) => q.teacherId);
  const req: Requirement = { id: `req:${classId}:${subjectId}`, classId, subjectId, teacherIds, periodsPerWeek: n };
  return { ...project, requirements: [...project.requirements, req] };
}

/** Remove the (class, subject) quota entirely (subject no longer required for that class). */
export function removeRequirement(project: Project, classId: Id, subjectId: Id): Project {
  return { ...project, requirements: project.requirements.filter((r) => !(r.classId === classId && r.subjectId === subjectId)) };
}
