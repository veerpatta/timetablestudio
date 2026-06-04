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
