import { describe, expect, it } from "vitest";
import { gridFromProject } from "../domain/gridReconstruct";
import { buildBundledProjectRaw } from "./bundled";
import { REAL_GRID, REAL_GRID_CLASS_ORDER } from "./realGrid";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

describe("bundled project round-trips to the authoritative grid cell-for-cell", () => {
  // The RAW build (no elective modelling) is what mirrors the source grid; the elective
  // model intentionally diverges (Study replaces forced-sitting) and is tested separately.
  const project = buildBundledProjectRaw();
  const rebuilt = gridFromProject(project);

  it("reproduces every one of the 16×6×8 = 768 cells exactly", () => {
    const diffs: string[] = [];
    for (const className of REAL_GRID_CLASS_ORDER) {
      for (let d = 0; d < 6; d++) {
        for (let p = 0; p < 8; p++) {
          const want = REAL_GRID[className]![d]![p]!;
          const got = rebuilt[className]?.[d]?.[p] ?? "";
          if (want !== got) diffs.push(`${className} ${DAYS[d]} P${p + 1}: want "${want}" got "${got}"`);
        }
      }
    }
    expect(diffs).toEqual([]);
  });
});
