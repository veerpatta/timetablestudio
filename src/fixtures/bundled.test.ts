import { describe, it, expect } from "vitest";
import { buildBundledProject, isStaleBundled, BUNDLED_DATA_VERSION } from "./bundled";
import { makeRealVppsProject, VPPS_SCHOOL_NAME } from "./vppsReal";
import { validate } from "../domain/validate";

describe("bundled default project (M19)", () => {
  it("opens as the real VPPS school — rules on, 0 conflicts, version-stamped", () => {
    const p = buildBundledProject();
    expect(p.school.name).toBe(VPPS_SCHOOL_NAME);
    expect(p.classes).toHaveLength(16);
    expect(p.rules.length).toBeGreaterThan(0); // anchors + doubles + ELGA config
    expect(p.bundledDataVersion).toBe(BUNDLED_DATA_VERSION);
    const tt = p.timetables.find((t) => t.id === p.activeTimetableId)!;
    // Pre-enabling the lived-by rules must not introduce a single hard conflict.
    expect(validate(p, tt)).toHaveLength(0);
  });

  it("preserves the reconciled placements cell-for-cell (bundling only adds rules)", () => {
    const bundled = buildBundledProject();
    const real = makeRealVppsProject();
    const bt = bundled.timetables.find((t) => t.id === bundled.activeTimetableId)!;
    const rt = real.timetables.find((t) => t.id === real.activeTimetableId)!;
    expect(bt.placements).toEqual(rt.placements);
  });

  it("flags only a VPPS project older than the current bundled version as stale", () => {
    const current = buildBundledProject();
    expect(isStaleBundled(current)).toBe(false); // up to date

    // A returning v4 browser: a VPPS project saved before bundledDataVersion existed.
    const legacy = { ...current, bundledDataVersion: undefined };
    expect(isStaleBundled(legacy)).toBe(true);

    // A user's own school must never see the banner (escape hatch coupling).
    const ownSchool = { ...current, bundledDataVersion: undefined, school: { name: "My School" } };
    expect(isStaleBundled(ownSchool)).toBe(false);
  });
});
