import { describe, expect, it } from "vitest";
import { buildBundledProject } from "../fixtures/bundled";
import { coverageGaps, requirementCoverage, totalShortfall } from "./coverage";
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
