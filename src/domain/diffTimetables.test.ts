import { describe, expect, it } from "vitest";
import { buildBundledProject } from "../fixtures/bundled";
import { clearCell } from "./edit";
import { diffProjects } from "./diffTimetables";

describe("diffProjects compares by rendered cell value", () => {
  const base = buildBundledProject();
  const ttId = base.activeTimetableId!;

  it("identical snapshots diff to nothing", () => {
    expect(diffProjects(base, base)).toEqual([]);
  });

  it("one edit shows up as exactly one changed cell, with before/after", () => {
    const after = clearCell(base, ttId, "Class 1", "Mon", 1); // Maths (Bindu) → Free
    const diff = diffProjects(base, after);
    expect(diff).toHaveLength(1);
    expect(diff[0]!.classId).toBe("Class 1");
    expect(diff[0]!.before).toMatch(/Maths/);
    expect(diff[0]!.after).toBe("Free");
  });
});
