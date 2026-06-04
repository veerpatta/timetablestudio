import { describe, it, expect } from "vitest";
import { movePlacement, togglePin, removePlacement, addPlacement } from "./edit";
import { elgaFixture, lesson, place } from "../fixtures/synthetic";

describe("edit operations (pure)", () => {
  it("movePlacement moves only the matched occurrence, preserving pinned", () => {
    const placements = [place("act-elga", "Mon", 3, true), place("act-elga", "Tue", 3, true)];
    const next = movePlacement(
      placements,
      { activityId: "act-elga", day: "Mon", period: 3 },
      "Wed",
      2,
    );
    expect(next.find((p) => p.day === "Wed")).toMatchObject({ period: 2, pinned: true });
    expect(next.find((p) => p.day === "Tue")).toMatchObject({ period: 3 }); // untouched
    expect(placements[0]).toMatchObject({ day: "Mon" }); // original not mutated
  });

  it("togglePin flips only the matched placement", () => {
    const placements = [place("L1", "Mon", 1, false)];
    const next = togglePin(placements, { activityId: "L1", day: "Mon", period: 1 });
    expect(next[0]!.pinned).toBe(true);
  });

  it("removePlacement drops the matched placement only", () => {
    const placements = [place("L1", "Mon", 1), place("L1", "Tue", 1)];
    const next = removePlacement(placements, { activityId: "L1", day: "Mon", period: 1 });
    expect(next).toHaveLength(1);
    expect(next[0]!.day).toBe("Tue");
  });

  it("addPlacement appends a new activity and its placement", () => {
    const p = elgaFixture();
    const L = lesson("L-new", "c1", "Maths", ["Bindu"]);
    const res = addPlacement(p.activities, p.timetables[0]!.placements, L, "Mon", 1);
    expect(res.activities.some((a) => a.id === "L-new")).toBe(true);
    expect(res.placements).toHaveLength(1);
  });
});
