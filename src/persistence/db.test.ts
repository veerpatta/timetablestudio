import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { saveProject, loadProject, deleteProject, listProjectKeys, CURRENT_KEY } from "./db";
import { useProjectStore, makeSampleProject } from "../store/projectStore";

describe("IndexedDB persistence", () => {
  beforeEach(async () => {
    await deleteProject(CURRENT_KEY);
  });

  it("saves and loads a project (the refresh-restore path)", async () => {
    const project = makeSampleProject();
    await saveProject(project);
    const loaded = await loadProject();
    expect(loaded).toEqual(project);
  });

  it("projectStore.init seeds the sample when storage is empty, and reloads it", async () => {
    useProjectStore.setState({ project: null });
    await useProjectStore.getState().init();
    const seeded = useProjectStore.getState().project!;
    expect(seeded.school.name).toBe("VPPS (sample)");

    // Simulate a page refresh: a fresh store reads back from IndexedDB.
    useProjectStore.setState({ project: null });
    await useProjectStore.getState().init();
    expect(useProjectStore.getState().project).toEqual(seeded);
  });

  it("lists keys and deletes", async () => {
    await saveProject(makeSampleProject());
    expect(await listProjectKeys()).toContain(CURRENT_KEY);
    await deleteProject(CURRENT_KEY);
    expect(await loadProject()).toBeUndefined();
  });
});
