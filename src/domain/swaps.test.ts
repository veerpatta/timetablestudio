import { describe, expect, it } from "vitest";
import { buildBundledProject } from "../fixtures/bundled";
import { makeMiniSchool } from "../fixtures/synthetic";
import { canMove, canSwap, legalSwaps } from "./swaps";
import { validate } from "./validate";
import type { Day, Placement, Project } from "./types";

const hardCount = (p: Project, ttId: string) =>
  validate(p, p.timetables.find((t) => t.id === ttId)!).filter((v) => v.severity === "hard").length;

/** Set the synthetic timetable's placements (its id is "tt"). */
function setPlacements(p: Project, placements: Placement[]): Project {
  return { ...p, timetables: p.timetables.map((t) => (t.id === "tt" ? { ...t, placements } : t)) };
}

/** makeMiniSchool + a second distinct Class 1 normal lesson (EVS/Eva) to swap against. */
function miniWithEvs(): Project {
  const p = makeMiniSchool();
  p.subjects.push({ id: "EVS", name: "EVS", bands: ["primary"], kind: "academic" });
  p.teachers.push({ id: "evsT", name: "Eva", maxPerDay: 8, maxPerWeek: 48, schedulable: true, unavailable: [] });
  p.qualifications.push({ teacherId: "evsT", subjectId: "EVS", classId: "c1" });
  p.events.push({
    id: "evt-evs-c1",
    type: "normal",
    subjectId: "EVS",
    classIds: ["c1"],
    teacherIds: ["evsT"],
    duration: 1,
    source: "manual",
  });
  return p;
}

const place = (eventId: string, day: Day, slot: number): Placement => ({ eventId, day, slot, pinned: false });

describe("canSwap only accepts clash-free exchanges (synthetic, discriminating)", () => {
  it("offers a legal swap between two distinct normal lessons (and applying it stays clash-free)", () => {
    const p = setPlacements(miniWithEvs(), [
      place("evt-maths-c1", "Mon", 1),
      place("evt-evs-c1", "Mon", 2),
    ]);
    const swap = canSwap(p, "tt", { classId: "c1", day: "Mon", slot: 1 }, { classId: "c1", day: "Mon", slot: 2 });
    expect(swap).not.toBeNull();
    expect(hardCount(swap!.project, "tt")).toBe(0);
  });

  it("REFUSES a swap that would move a teacher into an unavailable slot (HE4)", () => {
    const base = miniWithEvs();
    const placements = [place("evt-maths-c1", "Mon", 1), place("evt-evs-c1", "Mon", 2)];
    const ab = { a: { classId: "c1", day: "Mon" as Day, slot: 1 }, b: { classId: "c1", day: "Mon" as Day, slot: 2 } };
    // Control: without any block, the swap IS offered — proves the test discriminates.
    expect(canSwap(setPlacements(base, placements), "tt", ab.a, ab.b)).not.toBeNull();
    // Block Nidhika at Mon P2 (slot 2): swapping her Maths there is now illegal.
    base.teachers.find((t) => t.id === "mMaths")!.unavailable = [{ day: "Mon", slot: 2 }];
    expect(canSwap(setPlacements(base, placements), "tt", ab.a, ab.b)).toBeNull();
  });

  it("REFUSES a swap that would double-book a teacher (HE1)", () => {
    // Nidhika also teaches Class 2 Maths at Mon P2; swapping her Class 1 Maths into Mon P2 clashes.
    const p = setPlacements(miniWithEvs(), [
      place("evt-maths-c1", "Mon", 1),
      place("evt-evs-c1", "Mon", 2),
      place("evt-maths-c2", "Mon", 2),
    ]);
    expect(canSwap(p, "tt", { classId: "c1", day: "Mon", slot: 1 }, { classId: "c1", day: "Mon", slot: 2 })).toBeNull();
  });

  it("REFUSES a swap that would make a double period run off the end of the day (HE7)", () => {
    const p = miniWithEvs();
    p.subjects.push({ id: "Big", name: "Project", bands: ["primary"], kind: "academic" });
    p.qualifications.push({ teacherId: "mMaths", subjectId: "Big", classId: "c1" });
    p.events.push({ id: "evt-big", type: "normal", subjectId: "Big", classIds: ["c1"], teacherIds: ["mMaths"], duration: 2, source: "manual" });
    // Double period at Mon P1 (slots 1,2); a single EVS at Mon P8 (slot 9 = last teaching slot).
    const placed = setPlacements(p, [place("evt-big", "Mon", 1), place("evt-evs-c1", "Mon", 9)]);
    expect(hardCount(placed, "tt")).toBe(0); // valid starting state
    // Swapping the double into slot 9 leaves no room for its 2nd period → rejected.
    expect(canSwap(placed, "tt", { classId: "c1", day: "Mon", slot: 1 }, { classId: "c1", day: "Mon", slot: 9 })).toBeNull();
  });

  it("never swaps a shared (team/joint) cell — that would silently move every member class", () => {
    // ELGA team block at Mon P3 (slots 3,4,6) covers Class 1; a normal Maths at Mon P1.
    const p = setPlacements(makeMiniSchool(), [place("evt-elga", "Mon", 3), place("evt-maths-c1", "Mon", 1)]);
    expect(canSwap(p, "tt", { classId: "c1", day: "Mon", slot: 1 }, { classId: "c1", day: "Mon", slot: 3 })).toBeNull();
  });
});

describe("canMove only accepts a legal drop onto a free slot (synthetic, discriminating)", () => {
  it("moves a normal lesson into a free slot where the teacher is available (stays clash-free)", () => {
    const p = setPlacements(miniWithEvs(), [place("evt-maths-c1", "Mon", 1)]);
    const moved = canMove(p, "tt", { classId: "c1", day: "Mon", slot: 1 }, { classId: "c1", day: "Tue", slot: 1 });
    expect(moved).not.toBeNull();
    expect(hardCount(moved!, "tt")).toBe(0);
  });

  it("REFUSES a move into a slot the teacher is unavailable for (HE4)", () => {
    const base = miniWithEvs();
    base.teachers.find((t) => t.id === "mMaths")!.unavailable = [{ day: "Tue", slot: 1 }];
    const p = setPlacements(base, [place("evt-maths-c1", "Mon", 1)]);
    expect(canMove(p, "tt", { classId: "c1", day: "Mon", slot: 1 }, { classId: "c1", day: "Tue", slot: 1 })).toBeNull();
  });

  it("returns null when the target slot is occupied (that case is a swap, not a move)", () => {
    const p = setPlacements(miniWithEvs(), [place("evt-maths-c1", "Mon", 1), place("evt-evs-c1", "Mon", 2)]);
    expect(canMove(p, "tt", { classId: "c1", day: "Mon", slot: 1 }, { classId: "c1", day: "Mon", slot: 2 })).toBeNull();
  });
});

describe("legalSwaps on the REAL bundled timetable (two-sided: every offered swap is clash-free)", () => {
  const base = buildBundledProject();
  const ttId = base.activeTimetableId!;
  const DAYS: Day[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  it("every offered swap keeps the timetable at zero hard violations, and swaps DO exist", () => {
    let total = 0;
    for (const day of DAYS) {
      // Sample one source cell per day (slot 1 = P1) to keep the validate() count bounded.
      const swaps = legalSwaps(base, ttId, "Class 7", day, 1);
      total += swaps.length;
      for (const s of swaps) expect(hardCount(s.project, ttId)).toBe(0);
    }
    expect(total).toBeGreaterThan(0); // not vacuous — real legal swaps are found
  });
});
