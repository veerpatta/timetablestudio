import { describe, expect, it } from "vitest";
import { buildBundledProject } from "../fixtures/bundled";
import { clearCell, eventSignature, placeNormalLesson } from "./edit";
import { gridFromProject } from "./gridReconstruct";
import { legalOptions } from "./legalMoves";
import { validate } from "./validate";
import type { Project } from "./types";

const ttId = (p: Project) => p.activeTimetableId!;
const cellsOf = (p: Project, classId: string) => gridFromProject(p)[classId]!;

describe("placement-granular edits don't disturb other placements of a shared event", () => {
  it("replacing ONE Class 1 Maths cell leaves every other Maths/Bindu cell intact", () => {
    const base = buildBundledProject();
    const before = cellsOf(base, "Class 1");
    // Class 1 Mon P1 (slot 1) is Maths|Bindu. Replace it with EVS|Ravina (both qualified).
    const after = placeNormalLesson(base, ttId(base), "Class 1", "Mon", 1, "EVS", ["Ravina"]);
    const a = cellsOf(after, "Class 1");
    expect(before[0]![0]).toBe("Maths|Bindu"); // Mon P1 was Maths/Bindu
    expect(a[0]![0]).toBe("EVS|Ravina"); // now replaced
    // Every OTHER cell is unchanged.
    let changed = 0;
    for (let d = 0; d < 6; d++) for (let p = 0; p < 8; p++) if (before[d]![p] !== a[d]![p]) changed++;
    expect(changed).toBe(1);
  });

  it("clearing a joint cell removes it for ALL member streams but keeps the event's other placements", () => {
    const base = buildBundledProject();
    // Class 11 English (joint, Pradhyuman) at Mon P4 (slot 4) covers all three 11 streams.
    const before = base.timetables.find((t) => t.id === ttId(base))!.placements.length;
    const after = clearCell(base, ttId(base), "Class 11 Science", "Mon", 4);
    // The cell is gone for all three streams.
    for (const stream of ["Class 11 Science", "Class 11 Commerce", "Class 11 Arts"]) {
      expect(cellsOf(after, stream)![0]![3]).toBe(""); // Mon P4 now empty
    }
    // Exactly one placement removed; the joint event still has its other weekly placements.
    const afterPlacements = after.timetables.find((t) => t.id === ttId(after))!.placements;
    expect(afterPlacements.length).toBe(before - 1);
    const engEvent = base.events.find((e) => e.type === "joint_class" && e.subjectId === "English compulsory" && e.classIds.includes("Class 11 Science"))!;
    expect(afterPlacements.some((p) => p.eventId === engEvent.id)).toBe(true);
  });

  it("placing the same lesson signature twice reuses one event (no duplicates)", () => {
    const base = buildBundledProject();
    let p = placeNormalLesson(base, ttId(base), "Class 1", "Fri", 7, "Maths", ["Bindu"]);
    p = placeNormalLesson(p, ttId(p), "Class 1", "Sat", 7, "Maths", ["Bindu"]);
    const sig = eventSignature({ type: "normal", subjectId: "Maths", teacherIds: ["Bindu"], classIds: ["Class 1"] });
    expect(p.events.filter((e) => eventSignature(e) === sig)).toHaveLength(1);
  });

  it("placing a legalOptions candidate keeps the timetable clash-free", () => {
    const base = buildBundledProject();
    const cleared = clearCell(base, ttId(base), "Class 11 Commerce", "Mon", 9); // P8 (Free)
    const opt = legalOptions(cleared, ttId(cleared), "Class 11 Commerce", "Mon", 9)[0]!;
    const after = placeNormalLesson(cleared, ttId(cleared), "Class 11 Commerce", "Mon", 9, opt.subjectId, opt.teacherIds);
    expect(validate(after, after.timetables.find((t) => t.id === ttId(after))!).filter((v) => v.severity === "hard")).toEqual([]);
  });
});
