import { describe, it, expect } from "vitest";
import type { Project } from "./types";

describe("M0 smoke", () => {
  it("constructs a minimal empty Project matching the schema", () => {
    const project: Project = {
      schemaVersion: 2,
      school: { name: "VPPS" },
      teachers: [],
      classes: [],
      subjects: [],
      profiles: [],
      activities: [],
      requirements: { curriculum: [], blocks: [] },
      rules: [],
      timetables: [],
      activeTimetableId: null,
    };
    expect(project.schemaVersion).toBe(2);
    expect(project.activeTimetableId).toBeNull();
  });
});
