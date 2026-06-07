// C7 — a student in a chosen combination gets a CLEAN personal timetable: the three chosen
// electives + Self Study, never the dropped one, plus every compulsory whole-class lesson —
// and it reconciles with the grid (each busy class slot → exactly one event the student
// attends, identical to the class grid's event there).

import { describe, expect, it } from "vitest";
import { deriveMaps } from "./derive";
import { electiveReport, studentTimetable } from "./studentView";
import { buildBundledProject } from "../fixtures/bundled";
import type { Project, Timetable } from "./types";

const tableOf = (p: Project): Timetable => p.timetables.find((t) => t.id === p.activeTimetableId)!;

describe("C7 student view — clean per-combination personal timetable", () => {
  const base = buildBundledProject();
  const tt = tableOf(base);
  const subjName = new Map(base.subjects.map((s) => [s.id, s.name]));
  const offeredByClass = new Map(electiveReport(base).map((l) => [l.classId, new Set(l.offered.map((o) => o.subjectId))]));
  const artsGroups = base.studentGroups.filter((g) => offeredByClass.has(g.classId));

  it("seeds four combinations per Arts class (free 3-of-4)", () => {
    expect(artsGroups.filter((g) => g.classId === "Class 11 Arts").length).toBe(4);
    expect(artsGroups.filter((g) => g.classId === "Class 12 Arts").length).toBe(4);
  });

  for (const group of artsGroups) {
    it(`"${group.name}" sees exactly its 3 chosen electives + Self Study, never the dropped one`, () => {
      const personal = studentTimetable(base, tt, group.id);
      const offered = offeredByClass.get(group.classId)!;
      const chosen = new Set(group.electiveSubjectIds);
      const dropped = [...offered].filter((s) => !chosen.has(s));

      const subjectsSeen = new Set([...personal.values()].map((s) => s.event.subjectId));
      // every chosen elective present; the dropped elective ABSENT (clean = complete + correct)
      for (const s of chosen) expect(subjectsSeen.has(s), `chosen ${subjName.get(s)} present`).toBe(true);
      for (const s of dropped) expect(subjectsSeen.has(s), `dropped ${subjName.get(s)} absent`).toBe(false);
      // the dropper gets a supervised Self Study instead of forced sitting
      expect(subjectsSeen.has("Self Study")).toBe(true);
      // and the compulsory whole-class load is still there (not just electives)
      const compulsory = [...subjectsSeen].filter((s) => !offered.has(s) && s !== "Self Study");
      expect(compulsory.length).toBeGreaterThan(0);
    });
  }

  it("reconciles with derive(): each busy class slot → exactly one attended event, matching the grid", () => {
    const maps = deriveMaps(base, tt);
    for (const group of artsGroups) {
      const personal = studentTimetable(base, tt, group.id);
      const cells = maps.classCells.get(group.classId)!;
      // every slot the class occupies yields exactly one personal event (no silent drop / dup)
      expect(personal.size).toBe(cells.size);
      for (const [key, slot] of personal) {
        const occ = cells.get(key)!;
        expect(occ.some((o) => o.event.id === slot.event.id)).toBe(true); // it's a real event at that slot
      }
    }
  });
});
