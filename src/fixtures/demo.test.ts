import { describe, it, expect } from "vitest";
import demo from "./vpps.demo.ttproj.json";
import { deserializeProject } from "../persistence/projectFile";
import { validate } from "../domain/validate";
import { buildDemoSchool } from "./demoSchool";

describe("demo dataset (M7)", () => {
  // Regenerate with: npx vite-node scripts/buildDemoFixture.ts
  it("is a full 6-day, 14-class timetable with ZERO hard conflicts", () => {
    const project = deserializeProject(JSON.stringify(demo));
    const tt = project.timetables.find((t) => t.id === project.activeTimetableId)!;
    const profile = project.profiles.find((p) => p.id === tt.profileId)!;

    expect(profile.days).toHaveLength(6);
    // SCHOOL_CONTEXT.md enumerates 16 class entities (Class 1–10 + 11/12 ×
    // Arts/Commerce/Science); its "(14)" header is a miscount. We honor the
    // enumeration (never invent or drop real classes). Tracked in HANDOFF.
    expect(project.classes).toHaveLength(16);
    expect(validate(project, tt).filter((v) => v.severity === "hard")).toEqual([]);
  });

  it("models ELGA as a single block (5 classes, 5 teachers, length 3)", () => {
    const project = deserializeProject(JSON.stringify(demo));
    const blocks = project.activities.filter((a) => a.kind === "block");
    expect(blocks).toHaveLength(1);
    const elga = blocks[0]!;
    if (elga.kind !== "block") throw new Error("expected block");
    expect(elga.classIds).toHaveLength(5);
    expect(elga.teacherIds).toHaveLength(5);
    expect(elga.length).toBe(3);
  });

  it("has curriculum requirements every class can satisfy (no over-subscribed teacher)", () => {
    const base = buildDemoSchool();
    const weekly = new Map<string, number>();
    for (const r of base.requirements.curriculum) {
      for (const t of r.teacherIds) weekly.set(t, (weekly.get(t) ?? 0) + r.periodsPerWeek);
    }
    for (const teacher of base.teachers) {
      const load = weekly.get(teacher.id) ?? 0;
      expect(load).toBeLessThanOrEqual(teacher.maxPeriodsPerWeek);
    }
  });
});
