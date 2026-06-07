import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { clearProject, loadProject } from "../persistence/db";
import { enablePersistence, useProjectStore } from "./projectStore";

describe("store entity CRUD — undoable", () => {
  beforeEach(async () => {
    await clearProject();
    useProjectStore.getState().reset();
  });

  it("adds a teacher and undoes it", () => {
    const before = useProjectStore.getState().project.teachers.length;
    const id = useProjectStore.getState().addTeacher("Storey Sam");
    expect(useProjectStore.getState().project.teachers.find((t) => t.id === id)?.name).toBe("Storey Sam");
    useProjectStore.getState().undo();
    expect(useProjectStore.getState().project.teachers.length).toBe(before);
  });

  it("removes a class and undoes it", () => {
    const before = useProjectStore.getState().project.classes.length;
    useProjectStore.getState().removeClass("Class 11 Commerce");
    expect(useProjectStore.getState().project.classes.some((c) => c.id === "Class 11 Commerce")).toBe(false);
    useProjectStore.getState().undo();
    expect(useProjectStore.getState().project.classes.length).toBe(before);
  });
});

describe("store persistence — an edit survives a reload", () => {
  beforeEach(async () => {
    await clearProject();
    useProjectStore.getState().reset();
  });

  it("write-through persists CRUD edits to IndexedDB", async () => {
    const unsub = await enablePersistence();
    useProjectStore.getState().renameSubject("Maths", "Mathematics");
    // allow the async write-through to flush
    await new Promise((r) => setTimeout(r, 10));
    const saved = await loadProject();
    expect(saved?.subjects.find((s) => s.id === "Maths")?.name).toBe("Mathematics");
    unsub();
  });

  it("hydrate loads a previously saved project over the bundled seed", async () => {
    const unsub = await enablePersistence();
    const id = useProjectStore.getState().addClass("Class 99 Test", { band: "senior" });
    await new Promise((r) => setTimeout(r, 10));
    unsub();
    // simulate a fresh app start: reset to bundled, then hydrate from storage
    useProjectStore.getState().reset();
    expect(useProjectStore.getState().project.classes.some((c) => c.id === id)).toBe(false);
    await useProjectStore.getState().hydrate();
    expect(useProjectStore.getState().project.classes.some((c) => c.name === "Class 99 Test")).toBe(true);
  });
});
