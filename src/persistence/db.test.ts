import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { addTeacher } from "../domain/entityEdit";
import { buildBundledProject } from "../fixtures/bundled";
import type { Project } from "../domain/types";
import { clearProject, loadProject, normalizeProject, saveProject } from "./db";

describe("persistence — edits survive a reload (C1 AC)", () => {
  beforeEach(async () => clearProject());

  it("returns null when nothing has been saved yet", async () => {
    expect(await loadProject()).toBeNull();
  });

  it("round-trips an edited project through IndexedDB", async () => {
    const { project } = addTeacher(buildBundledProject(), "Persisted Pat");
    await saveProject(project);
    const loaded = await loadProject();
    expect(loaded?.teachers.some((t) => t.name === "Persisted Pat")).toBe(true);
    expect(loaded?.classes.length).toBe(project.classes.length);
    expect(loaded?.timetables[0]?.placements.length).toBe(project.timetables[0]?.placements.length);
  });

  it("clearProject removes the saved project", async () => {
    await saveProject(buildBundledProject());
    expect(await loadProject()).not.toBeNull();
    await clearProject();
    expect(await loadProject()).toBeNull();
  });
});

describe("normalizeProject — survives schema growth", () => {
  it("fills missing array fields (forward-compat for later milestones)", () => {
    const partial = { ...buildBundledProject() } as Partial<Project> & Record<string, unknown>;
    delete partial.constraints;
    delete partial.rooms;
    const n = normalizeProject(partial as Project) as Project & Record<string, unknown>;
    expect(Array.isArray(n.rooms)).toBe(true);
    expect(Array.isArray(n.constraints)).toBe(true);
    // forward-compat seams present even though they aren't used yet
    expect(Array.isArray(n.electiveGroups)).toBe(true);
    expect(Array.isArray(n.studentGroups)).toBe(true);
  });

  it("returns the same object when nothing is missing", () => {
    const full = normalizeProject(buildBundledProject());
    const again = normalizeProject(full);
    expect(again).toBe(full); // no needless copy
  });

  it("migrates a legacy R4 rule (from a C2 blob) to a class_teacher_p1 constraint, dropping rules", () => {
    const blob = { ...buildBundledProject() } as Project & Record<string, unknown>;
    blob.rules = [{ id: "R4:Class 7", template: "R4", classId: "Class 7", enabled: true, severity: "prefer", weight: 3 }];
    const n = normalizeProject(blob) as Project & Record<string, unknown>;
    expect(n.rules).toBeUndefined(); // legacy field not carried forward
    expect(n.constraints.some((c) => c.template === "class_teacher_p1" && (c.params as { classId: string }).classId === "Class 7")).toBe(true);
  });
});
