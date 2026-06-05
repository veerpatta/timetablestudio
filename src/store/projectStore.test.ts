import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { useProjectStore, makeSampleProject } from "./projectStore";

beforeEach(() => {
  useProjectStore.setState({ project: makeSampleProject() });
});

describe("projectStore.addDraft (M3: apply solver result as a new draft)", () => {
  it("adds a new timetable, switches to it, and never overwrites the source", () => {
    const before = useProjectStore.getState().project!;
    const sourceId = before.activeTimetableId!;
    const sourceCount = before.timetables.length;
    const sourcePlacements = before.timetables.find((t) => t.id === sourceId)!.placements;

    const newId = useProjectStore.getState().addDraft("Auto-completed (seed 1)", []);

    const after = useProjectStore.getState().project!;
    expect(newId).toBeTruthy();
    expect(after.timetables).toHaveLength(sourceCount + 1);
    expect(after.activeTimetableId).toBe(newId);
    // original draft untouched
    const source = after.timetables.find((t) => t.id === sourceId)!;
    expect(source.placements).toBe(sourcePlacements);
    expect(source.placements.length).toBeGreaterThan(0);
  });
});

describe("projectStore draft switching (M8)", () => {
  it("setActiveTimetable switches the active draft", () => {
    const store = useProjectStore.getState();
    const sourceId = useProjectStore.getState().project!.activeTimetableId!;
    const newId = store.addDraft("Filled-in timetable", [])!;
    store.setActiveTimetable(sourceId);
    expect(useProjectStore.getState().project!.activeTimetableId).toBe(sourceId);
    store.setActiveTimetable(newId);
    expect(useProjectStore.getState().project!.activeTimetableId).toBe(newId);
  });

  it("deleteTimetable removes a draft and never leaves zero; re-points active", () => {
    const store = useProjectStore.getState();
    const sourceId = useProjectStore.getState().project!.activeTimetableId!;
    const newId = store.addDraft("Filled-in timetable", [])!; // active = newId
    store.deleteTimetable(newId);
    const after = useProjectStore.getState().project!;
    expect(after.timetables.some((t) => t.id === newId)).toBe(false);
    expect(after.activeTimetableId).toBe(sourceId);

    // refuses to delete the last remaining draft
    store.deleteTimetable(sourceId);
    expect(useProjectStore.getState().project!.timetables.length).toBeGreaterThanOrEqual(1);
  });
});
