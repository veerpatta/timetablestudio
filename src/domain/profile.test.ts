import { describe, expect, it } from "vitest";
import {
  buildHeatwaveProfile,
  buildRegularProfile,
  isTeachingSlot,
  occupiedSlots,
  slotLabel,
  teachingSlots,
} from "./profile";

describe("regular 2026-27 profile", () => {
  const p = buildRegularProfile();

  it("has Assembly + 8 teaching periods + a positioned Recess", () => {
    expect(p.slots).toHaveLength(10);
    expect(p.slots.filter((s) => s.teaching)).toHaveLength(8);
    expect(slotLabel(p, 0)).toBe("Assembly");
    expect(slotLabel(p, 5)).toBe("Recess");
    expect(p.isDefault).toBe(true);
  });

  it("places Recess physically between P4 and P5 (teaching slots are non-contiguous)", () => {
    // P4 = index 4, Recess = index 5, P5 = index 6.
    expect(teachingSlots(p)).toEqual([1, 2, 3, 4, 6, 7, 8, 9]);
    expect(isTeachingSlot(p, 5)).toBe(false);
    expect(isTeachingSlot(p, 6)).toBe(true);
  });
});

describe("heatwave (secondary) profile", () => {
  const h = buildHeatwaveProfile();

  it("is 6 teaching periods with a Break after P4 and no Assembly", () => {
    expect(h.slots).toHaveLength(7);
    expect(h.slots.filter((s) => s.teaching)).toHaveLength(6);
    expect(h.slots.some((s) => s.label === "Assembly")).toBe(false);
    expect(slotLabel(h, 4)).toBe("Break");
    expect(teachingSlots(h)).toEqual([0, 1, 2, 3, 5, 6]);
    expect(h.isDefault).toBeUndefined();
  });

  it("a 2-period block over the break spans P4,P5 (skipping the Break slot)", () => {
    expect(occupiedSlots(h, 3, 2)).toEqual([3, 5]);
  });
});

describe("occupiedSlots — duration skips fixed slots", () => {
  const p = buildRegularProfile();

  it("an ELGA-style P3 block of 3 periods spans P3,P4,P5 across the recess", () => {
    // P3=3, P4=4, then skip Recess(5), P5=6.
    expect(occupiedSlots(p, 3, 3)).toEqual([3, 4, 6]);
  });

  it("a single lesson occupies just its slot", () => {
    expect(occupiedSlots(p, 1, 1)).toEqual([1]);
    expect(occupiedSlots(p, 9, 1)).toEqual([9]);
  });

  it("rejects starts on Assembly/Recess and overflow off the end of the day", () => {
    expect(occupiedSlots(p, 0, 1)).toBeNull(); // Assembly
    expect(occupiedSlots(p, 5, 1)).toBeNull(); // Recess
    expect(occupiedSlots(p, 9, 2)).toBeNull(); // P8 + 1 more → overflow
    expect(occupiedSlots(p, 1, 0)).toBeNull(); // degenerate duration
  });
});
