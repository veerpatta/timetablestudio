import { describe, it, expect } from "vitest";
import { VPPS_RAW_DATA, makeRealVppsProject } from "./vppsReal";
import { importLegacyRawData } from "../domain/legacyImport";
import { exportLegacyRawData } from "../domain/legacyExport";
import { validate } from "../domain/validate";

/** Tolerant normalize: the live viewer separates day blocks with a blank line
 * and the exporter doesn't — that's the only cosmetic difference, so a semantic
 * round-trip compares content lines, ignoring blank lines and trailing space. */
const norm = (s: string) =>
  s
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0)
    .join("\n");

describe("real VPPS snapshot — the data spine (M12)", () => {
  it("imports to 16 classes, 6 days, 18 teachers with 0 hard conflicts", () => {
    const p = importLegacyRawData(VPPS_RAW_DATA, "VPPS");
    expect(p.classes).toHaveLength(16);
    expect(p.profiles[0]!.days).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
    expect(p.teachers).toHaveLength(18);
    const hard = validate(p, p.timetables[0]!).filter((v) => v.severity === "hard");
    expect(hard).toEqual([]);
  });

  it("detects ELGA as one atomic block: 5 classes, 5 teachers, length 3, Mon–Thu", () => {
    const p = importLegacyRawData(VPPS_RAW_DATA, "VPPS");
    const elga = p.activities.find((a) => a.kind === "block" && a.name === "ELGA");
    expect(elga).toBeDefined();
    if (!elga || elga.kind !== "block") throw new Error("no ELGA block");
    expect(elga.classIds).toEqual(["Class 1", "Class 2", "Class 3", "Class 4", "Class 5"]);
    expect(elga.teacherIds).toEqual(["Bindu", "Anita", "Rashmita", "Kusum", "Ravina"]);
    expect(elga.length).toBe(3);
    const elgaDays = p.timetables[0]!.placements
      .filter((pl) => pl.activityId === elga.id)
      .map((pl) => pl.day);
    expect(elgaDays.sort()).toEqual(["Mon", "Thu", "Tue", "Wed"]); // Mon–Thu
  });

  it("models senior shared subjects as combined sections (no false teacher clash)", () => {
    const p = importLegacyRawData(VPPS_RAW_DATA, "VPPS");
    const combined = p.activities.filter(
      (a) => a.kind === "block" && a.name !== "ELGA",
    );
    // Senior streams share Hindi / English compulsory / Economics as joint sections.
    expect(combined.length).toBeGreaterThan(0);
    for (const b of combined) {
      if (b.kind !== "block") continue;
      expect(b.classIds.length).toBeGreaterThanOrEqual(2);
      expect(b.length).toBe(1);
    }
  });

  it("semantic round-trip: import → export reproduces the snapshot (modulo blank lines)", () => {
    const p = importLegacyRawData(VPPS_RAW_DATA, "VPPS");
    const out = exportLegacyRawData(p, p.activeTimetableId!);
    expect(norm(out)).toBe(norm(VPPS_RAW_DATA));
  });

  it("the normalized demo project is feasible (0 hard) and keeps 16 classes", () => {
    const demo = makeRealVppsProject();
    expect(demo.classes).toHaveLength(16);
    const active = demo.timetables.find((t) => t.id === demo.activeTimetableId)!;
    const hard = validate(demo, active).filter((v) => v.severity === "hard");
    expect(hard).toEqual([]);
  });
});
