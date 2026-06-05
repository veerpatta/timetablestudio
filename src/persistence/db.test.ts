import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { saveProject, loadProject, deleteProject, listProjectKeys, CURRENT_KEY } from "./db";
import { useProjectStore, makeSampleProject } from "../store/projectStore";
import { BUNDLED_DATA_VERSION } from "../fixtures/bundled";

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

  it("init seeds the bundled real timetable on first run (M19 zero setup)", async () => {
    await useProjectStore.getState().init();
    const seeded = useProjectStore.getState().project;
    expect(seeded).not.toBeNull();
    // The built-in school: real VPPS, 16 classes, rules on, current bundled version.
    expect(seeded!.school.name).toMatch(/Veer Patta/);
    expect(seeded!.classes).toHaveLength(16);
    expect(seeded!.rules.length).toBeGreaterThan(0);
    expect(seeded!.bundledDataVersion).toBe(BUNDLED_DATA_VERSION);
    expect(useProjectStore.getState().bundledStale).toBe(false);
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
