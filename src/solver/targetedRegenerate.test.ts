// M28 AC tests — targeted regenerate + verdict polish.
//
// AC 1: an impossible single-class scope returns Proven impossible naming the bottleneck.
// AC 2: targeted regenerate changes only the unfrozen scope (property test).
//
// Implementation notes:
//  - inScope (class-scope): only events whose classIds is EXCLUSIVELY [targetClassId].
//    Multi-class (shared/team) events stay pinned so other classes are not disturbed.
//  - domains.ts pre-computes pinned slots and skips them, so placeNormalLesson cannot
//    displace a pinned event via clearCell.
//  - result.changes = diffProjects(scopedProject, solvedProject): only in-scope cells
//    changed, so all change.classId === targetClass.id.

import { describe, expect, it } from "vitest";
import { buildBundledProject } from "../fixtures/bundled";
import type { Project } from "../domain/types";
import { targetedRegenerate } from "./targetedRegenerate";

const ttId = (p: Project) => p.activeTimetableId!;

describe("M28 targetedRegenerate", () => {
  it("AC1: impossible single-class scope returns Proven impossible with a named bottleneck", () => {
    // Remove all qualifications → no teacher can teach any subject → subject_capacity blockers.
    const base = buildBundledProject();
    const impossibleProject: Project = { ...base, qualifications: [] };
    const targetClass = base.classes[0]!;

    const result = targetedRegenerate(impossibleProject, ttId(impossibleProject), {
      type: "class",
      id: targetClass.id,
    });

    expect(result.proofLevel).toBe("impossible");
    expect(result.blockers.length).toBeGreaterThan(0);
    expect(result.blockers.some((b) => /qualified/i.test(b))).toBe(true);
  });

  it("AC2: all changes from targeted-regenerate belong to the targeted class (property test)", () => {
    // Pass the FULL base project — targetedRegenerate pins all out-of-scope placements and
    // clears only solo-target-class events. result.changes reflects scopedProject → solved.
    // Because pinned slots are skipped by the search (domains.ts), out-of-scope cells never
    // appear in the diff.
    const base = buildBundledProject();
    const targetClass = base.classes[0]!;
    const timetableId = ttId(base);

    const result = targetedRegenerate(base, timetableId, { type: "class", id: targetClass.id });

    // Every changed cell must belong to the target class.
    for (const change of result.changes) {
      expect(change.classId).toBe(targetClass.id);
    }
  });

  it("out-of-scope placements are preserved verbatim in the result project", () => {
    const base = buildBundledProject();
    const targetClass = base.classes[0]!;
    const timetableId = ttId(base);
    const baseTable = base.timetables.find((t) => t.id === timetableId)!;

    const result = targetedRegenerate(base, timetableId, { type: "class", id: targetClass.id });
    const resultTable = result.project.timetables.find((t) => t.id === timetableId)!;
    const resultKeys = new Set(
      resultTable.placements.map((p) => `${p.eventId}|${p.day}|${p.slot}`),
    );

    // Identify which events are in-scope (solo target-class only).
    const inScopeIds = new Set(
      base.events
        .filter((e) => e.classIds.length === 1 && e.classIds[0] === targetClass.id)
        .map((e) => e.id),
    );

    // Every out-of-scope placement from base must survive in the result.
    for (const p of baseTable.placements) {
      if (!inScopeIds.has(p.eventId)) {
        expect(resultKeys.has(`${p.eventId}|${p.day}|${p.slot}`)).toBe(true);
      }
    }
  });
});
