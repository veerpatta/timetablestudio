import { beforeEach, describe, expect, it } from "vitest";
import { deriveMaps, slotKey } from "../domain/derive";
import { useProjectStore } from "./projectStore";

describe("projectStore — one edit path feeds every view", () => {
  beforeEach(() => useProjectStore.getState().reset());

  it("a class edit shows up in the teacher view (both read deriveMaps)", () => {
    // Clear Class 11 Commerce Mon P8 (slot 9, a Free) then place EVS… use a real
    // qualified+free pairing: place Business Studies/Nidhika is busy; instead use the
    // store to place Accountancy/Nathulal — assert Nathulal now occupies that slot.
    const { place } = useProjectStore.getState();
    place("Class 11 Commerce", "Mon", 9, "Accountancy", ["Nathulal"]);
    const { project } = useProjectStore.getState();
    const tt = project.timetables.find((t) => t.id === project.activeTimetableId)!;
    const maps = deriveMaps(project, tt);
    const occ = maps.teacherCells.get("Nathulal")?.get(slotKey("Mon", 9));
    expect(occ?.some((o) => o.event.subjectId === "Accountancy" && o.event.classIds.includes("Class 11 Commerce"))).toBe(true);
  });

  it("undo reverts the last edit", () => {
    const before = JSON.stringify(useProjectStore.getState().project);
    useProjectStore.getState().place("Class 11 Commerce", "Mon", 9, "Accountancy", ["Nathulal"]);
    expect(JSON.stringify(useProjectStore.getState().project)).not.toBe(before);
    useProjectStore.getState().undo();
    expect(JSON.stringify(useProjectStore.getState().project)).toBe(before);
  });
});
