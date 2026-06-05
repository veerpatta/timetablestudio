import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { useProjectStore, makeSampleProject } from "./projectStore";
import { useEditorStore } from "./editorStore";
import { useScenarioStore } from "./scenarioStore";

const activePlacements = () => {
  const p = useProjectStore.getState().project!;
  return JSON.stringify(p.timetables.find((t) => t.id === p.activeTimetableId)!.placements);
};
const basePlacements = (baseId: string) =>
  JSON.stringify(useProjectStore.getState().project!.timetables.find((t) => t.id === baseId)!.placements);

describe("scenario branch → edit → promote → undo (M17 AC)", () => {
  beforeEach(() => {
    useProjectStore.getState().setProject(makeSampleProject(), false);
    useEditorStore.setState({ past: [], future: [] });
    useScenarioStore.setState({ baseId: null, branchId: null, active: false });
  });

  it("branching makes an editable copy without touching the live timetable", () => {
    const baseId = useProjectStore.getState().project!.activeTimetableId!;
    const before = basePlacements(baseId);
    useScenarioStore.getState().start();
    const branchId = useScenarioStore.getState().branchId!;
    expect(useScenarioStore.getState().active).toBe(true);
    expect(useProjectStore.getState().project!.activeTimetableId).toBe(branchId);
    expect(basePlacements(baseId)).toBe(before); // live untouched
  });

  it("promote replaces live with the branch and is undoable; discard drops the branch", () => {
    const baseId = useProjectStore.getState().project!.activeTimetableId!;
    const before = basePlacements(baseId);

    useScenarioStore.getState().start();
    const branchId = useScenarioStore.getState().branchId!;
    // edit the branch: move its first lesson to a different period
    const branch = useProjectStore.getState().project!.timetables.find((t) => t.id === branchId)!;
    const p0 = branch.placements.find((p) => !p.pinned) ?? branch.placements[0]!;
    useEditorStore.getState().move({ activityId: p0.activityId, day: p0.day, period: p0.period }, p0.day, p0.period === 6 ? 5 : 6);
    expect(activePlacements()).not.toBe(before);

    useScenarioStore.getState().promote();
    const after = useProjectStore.getState().project!;
    expect(after.activeTimetableId).toBe(baseId); // back on live
    expect(after.timetables.some((t) => t.id === branchId)).toBe(false); // branch dropped
    expect(basePlacements(baseId)).not.toBe(before); // live now carries the change

    useEditorStore.getState().undo();
    expect(basePlacements(baseId)).toBe(before); // promote fully undone
  });

  it("discard returns to live and removes the branch", () => {
    const baseId = useProjectStore.getState().project!.activeTimetableId!;
    const count = useProjectStore.getState().project!.timetables.length;
    useScenarioStore.getState().start();
    expect(useProjectStore.getState().project!.timetables.length).toBe(count + 1);
    useScenarioStore.getState().discard();
    expect(useProjectStore.getState().project!.activeTimetableId).toBe(baseId);
    expect(useProjectStore.getState().project!.timetables.length).toBe(count);
    expect(useScenarioStore.getState().active).toBe(false);
  });
});
