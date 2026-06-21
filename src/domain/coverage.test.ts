import { describe, expect, it } from "vitest";
import { buildBundledProject } from "../fixtures/bundled";
import { fill } from "../solver/fill";
import { buildCoverageReport, coverageGaps, requirementCoverage, totalShortfall } from "./coverage";
import { applyProjectFix } from "./projectFixes";
import type { Project } from "./types";

function activeTable(p: Project) {
  return p.timetables.find((t) => t.id === p.activeTimetableId)!;
}

describe("requirementCoverage", () => {
  it("reports zero gaps for the bundled grid (requirements derived from it)", () => {
    const project = buildBundledProject();
    const tt = activeTable(project);
    expect(totalShortfall(project, tt)).toBe(0);
    expect(coverageGaps(project, tt)).toEqual([]);
    // every requirement is met (placed >= required)
    expect(requirementCoverage(project, tt).every((c) => c.short === 0)).toBe(true);
  });

  it("flags exactly the shortfall when a required lesson is removed", () => {
    const project = buildBundledProject();
    const tt = activeTable(project);
    const eventIndex = new Map(project.events.map((e) => [e.id, e]));
    // a single-class, duration-1 normal lesson that is part of a requirement
    const placement = tt.placements.find((p) => {
      const e = eventIndex.get(p.eventId);
      return (
        e &&
        e.type === "normal" &&
        e.classIds.length === 1 &&
        e.duration === 1 &&
        (!e.studentGroupIds || e.studentGroupIds.length === 0) &&
        project.requirements.some((r) => r.classId === e.classIds[0] && r.subjectId === e.subjectId)
      );
    })!;
    const ev = eventIndex.get(placement.eventId)!;
    const classId = ev.classIds[0]!;
    const subjectId = ev.subjectId;

    const removed: Project = {
      ...project,
      timetables: project.timetables.map((t) =>
        t.id !== tt.id ? t : { ...t, placements: t.placements.filter((p) => p !== placement) },
      ),
    };
    const ttAfter = activeTable(removed);

    expect(totalShortfall(removed, ttAfter)).toBe(1);
    const gaps = coverageGaps(removed, ttAfter);
    expect(gaps).toHaveLength(1);
    expect(gaps[0]).toMatchObject({ classId, subjectId, short: 1 });
    expect(gaps[0]!.message).toMatch(/needs 1 more/);
  });

  it("buildCoverageReport (M-A) — over-constrained fixture yields gap with reason and suggestion", () => {
    const base = buildBundledProject();
    const timetableId = base.activeTimetableId!;
    // Pick a normal single-class requirement that has a qualified schedulable teacher.
    const req = base.requirements.find((r) => {
      if (r.periodsPerWeek === 0) return false;
      return base.qualifications.some(
        (q) => q.classId === r.classId && q.subjectId === r.subjectId && base.teachers.find((t) => t.id === q.teacherId)?.schedulable,
      );
    });
    expect(req).toBeDefined();
    const { classId, subjectId } = req!;

    // Strip all qualifications for this (class, subject) pair so fill cannot place it.
    // Also remove existing placements for events belonging to this pair so fill tries to fill them.
    const eventIds = new Set(
      base.events
        .filter((e) => e.classIds.includes(classId) && e.subjectId === subjectId && e.classIds.length === 1)
        .map((e) => e.id),
    );
    const project: Project = {
      ...base,
      qualifications: base.qualifications.filter((q) => !(q.classId === classId && q.subjectId === subjectId)),
      timetables: base.timetables.map((t) =>
        t.id !== timetableId ? t : { ...t, placements: t.placements.filter((p) => !eventIds.has(p.eventId)) },
      ),
    };

    const result = fill(project, timetableId);
    const timetable = result.project.timetables.find((t) => t.id === timetableId)!;
    const report = buildCoverageReport(result.project, timetable, result.gapReasons);

    // Acceptance: non-empty gap report with at least one reason and suggestion per gap.
    expect(report.totalShortfall).toBeGreaterThan(0);
    expect(report.gaps.length).toBeGreaterThan(0);
    const gap = report.gaps.find((g) => g.classId === classId && g.subjectId === subjectId);
    expect(gap).toBeDefined();
    expect(gap!.reasons.length).toBeGreaterThan(0);
    expect(gap!.suggestion.length).toBeGreaterThan(0);
    // M-B: fixes should be present and executable
    expect(gap!.fixes.length).toBeGreaterThan(0);
    for (const fix of gap!.fixes) {
      expect(fix.label.length).toBeGreaterThan(0);
      expect(fix.costEstimate).toMatch(/^(low|medium|high)$/);
      // Applying the fix should return a valid project without throwing
      const fixed = applyProjectFix(result.project, fix.spec);
      expect(fixed).toBeDefined();
    }
  });

  it("buildFixesForGap (M-B) — reduce_requirement fix brings shortfall to zero when applied", () => {
    const base = buildBundledProject();
    const timetableId = base.activeTimetableId!;
    // Find any unfilled gap (same setup as M-A test: strip qualifications)
    const req = base.requirements.find((r) => {
      if (r.periodsPerWeek === 0) return false;
      return base.qualifications.some(
        (q) => q.classId === r.classId && q.subjectId === r.subjectId && base.teachers.find((t) => t.id === q.teacherId)?.schedulable,
      );
    })!;
    const { classId, subjectId } = req;
    const eventIds = new Set(
      base.events
        .filter((e) => e.classIds.includes(classId) && e.subjectId === subjectId && e.classIds.length === 1)
        .map((e) => e.id),
    );
    const project: Project = {
      ...base,
      qualifications: base.qualifications.filter((q) => !(q.classId === classId && q.subjectId === subjectId)),
      timetables: base.timetables.map((t) =>
        t.id !== timetableId ? t : { ...t, placements: t.placements.filter((p) => !eventIds.has(p.eventId)) },
      ),
    };
    const result = fill(project, timetableId);
    const timetable = result.project.timetables.find((t) => t.id === timetableId)!;
    const report = buildCoverageReport(result.project, timetable, result.gapReasons);
    const gap = report.gaps.find((g) => g.classId === classId && g.subjectId === subjectId)!;

    // Find the reduce_requirement fix
    const reduceFix = gap.fixes.find((f) => f.spec.kind === "reduce_requirement");
    expect(reduceFix).toBeDefined();
    const fixed = applyProjectFix(result.project, reduceFix!.spec);
    // After applying, the requirement should be reduced — shortfall should disappear
    const fixedTt = fixed.timetables.find((t) => t.id === timetableId)!;
    expect(totalShortfall(fixed, fixedTt)).toBe(0);
  });

  it("counts each Arts elective subject against its class (electives are covered)", () => {
    const project = buildBundledProject();
    const tt = activeTable(project);
    const cov = requirementCoverage(project, tt);
    for (const sub of ["Political Science", "Geography", "Economics", "English Literature"]) {
      const row = cov.find((c) => c.classId === "Class 11 Arts" && c.subjectId === sub);
      expect(row, `coverage row for ${sub}`).toBeDefined();
      expect(row!.short).toBe(0);
      expect(row!.placed).toBeGreaterThan(0);
    }
  });
});
