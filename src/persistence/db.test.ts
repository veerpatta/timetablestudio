import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { saveProject, loadProject, deleteProject, listProjectKeys, CURRENT_KEY } from "./db";
import { useProjectStore, makeSampleProject } from "../store/projectStore";

describe("IndexedDB persistence", () => {
  beforeEach(async () => {
    await deleteProject(CURRENT_KEY);
    useProjectStore.setState({ project: null, initialized: false });
  });

  it("saves and loads a project (the refresh-restore path)", async () => {
    const project = makeSampleProject();
    await saveProject(project);
    const loaded = await loadProject();
    expect(loaded).toEqual(project);
  });

  it("init leaves an empty project null on first run (v2: no auto-seed)", async () => {
    await useProjectStore.getState().init();
    expect(useProjectStore.getState().project).toBeNull();
    expect(useProjectStore.getState().initialized).toBe(true);
  });

  it("loadDemo seeds the demo, and init restores it after a refresh", async () => {
    useProjectStore.getState().loadDemo();
    const demo = useProjectStore.getState().project!;
    // M12: the demo is the real VPPS school (16 classes, 6 days).
    expect(demo.school.name).toMatch(/Veer Patta/);
    expect(demo.classes).toHaveLength(16);
    await saveProject(demo); // loadDemo autosaves (debounced); persist now for the test

    // Simulate a page refresh: a fresh store reads back from IndexedDB.
    useProjectStore.setState({ project: null, initialized: false });
    await useProjectStore.getState().init();
    expect(useProjectStore.getState().project).toEqual(demo);
  });

  it("lists keys and deletes", async () => {
    await saveProject(makeSampleProject());
    expect(await listProjectKeys()).toContain(CURRENT_KEY);
    await deleteProject(CURRENT_KEY);
    expect(await loadProject()).toBeUndefined();
  });
});
