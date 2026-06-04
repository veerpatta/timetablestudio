import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { useProjectStore, makeSampleProject } from "./projectStore";
import { useEditorStore } from "./editorStore";
import { deriveMaps } from "../domain/derive";
import { validate } from "../domain/validate";
import { lesson } from "../fixtures/synthetic";
import type { Project, Timetable } from "../domain/types";

const active = (p: Project): Timetable =>
  p.timetables.find((t) => t.id === p.activeTimetableId)!;
const proj = () => useProjectStore.getState().project!;

function reset(): Project {
  const p = makeSampleProject();
  useProjectStore.setState({ project: p });
  useEditorStore.setState({
    past: [],
    future: [],
    selection: null,
    selectedDay: "Mon",
    viewMode: "class",
  });
  return p;
}

beforeEach(reset);

describe("editorStore — M2 acceptance criteria", () => {
  it("moving an ELGA block moves all 15 cells atomically", () => {
    const block = proj().activities.find((a) => a.kind === "block")!;
    useEditorStore.getState().move({ activityId: block.id, day: "Mon", period: 3 }, "Sat", 1);

    const maps = deriveMaps(proj(), active(proj()));
    const classes = ["Class 1", "Class 2", "Class 3", "Class 4", "Class 5"];
    let moved = 0;
    for (const c of classes) {
      for (let p = 1; p <= 3; p++) {
        if (maps.classCells.get(c)?.get(`Sat#${p}`)?.length) moved++;
      }
      // old footprint now empty for every class
      for (let p = 3; p <= 5; p++) {
        expect(maps.classCells.get(c)?.get(`Mon#${p}`)).toBeUndefined();
      }
    }
    expect(moved).toBe(15); // 5 classes × 3 periods, all together
  });

  it("placing Kusum opposite an ELGA block flags H1 instantly", () => {
    // ELGA occupies Kusum Mon P3–P5. Add a Class 7 Hindi lesson with Kusum at Mon P4.
    const clash = lesson("L-kusum-clash", "Class 7", "Hindi", ["Kusum"]);
    useEditorStore.getState().add(clash, "Mon", 4);

    const violations = validate(proj(), active(proj()));
    const h1 = violations.filter((v) => v.constraintId === "H1");
    expect(h1.length).toBeGreaterThan(0);
    expect(h1.some((v) => v.message.includes("Kusum"))).toBe(true);
  });

  it("undo restores the exact prior state; redo reapplies", () => {
    const before = structuredClone(proj());
    const block = proj().activities.find((a) => a.kind === "block")!;

    useEditorStore.getState().move({ activityId: block.id, day: "Mon", period: 3 }, "Sat", 1);
    expect(proj()).not.toEqual(before);

    useEditorStore.getState().undo();
    expect(proj()).toEqual(before);

    useEditorStore.getState().redo();
    expect(active(proj()).placements.some((p) => p.day === "Sat")).toBe(true);
  });

  it("pin toggles only the targeted placement", () => {
    const block = proj().activities.find((a) => a.kind === "block")!;
    // imported block placements are pinned; toggle Mon off
    useEditorStore.getState().pin({ activityId: block.id, day: "Mon", period: 3 });
    const placements = active(proj()).placements.filter((p) => p.activityId === block.id);
    const mon = placements.find((p) => p.day === "Mon")!;
    const tue = placements.find((p) => p.day === "Tue")!;
    expect(mon.pinned).toBe(false);
    expect(tue.pinned).toBe(true);
  });
});
