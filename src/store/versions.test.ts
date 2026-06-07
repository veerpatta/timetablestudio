import { beforeEach, describe, expect, it } from "vitest";
import { diffProjects } from "../domain/diffTimetables";
import { useProjectStore } from "./projectStore";

describe("named versions: save, restore (undoable), compare", () => {
  beforeEach(() => useProjectStore.getState().reset());

  it("restores a saved snapshot exactly, and the restore is undoable", () => {
    const s = () => useProjectStore.getState();
    s().saveVersion("original");
    const original = s().project;
    const versionId = s().versions[0]!.id;

    // Edit away from the snapshot.
    s().clear("Class 1", "Mon", 1);
    expect(diffProjects(original, s().project)).toHaveLength(1);

    // Restore → back to the snapshot (no differences).
    s().restoreVersion(versionId);
    expect(diffProjects(original, s().project)).toEqual([]);

    // Restore was undoable → undo returns to the edited state.
    s().undo();
    expect(diffProjects(original, s().project)).toHaveLength(1);
  });
});
