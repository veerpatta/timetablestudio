import { describe, expect, it } from "vitest";
import { constraintTier, severityForTier, tierChipLabel, tierDescription } from "./constraintText";
import type { ConstraintBase } from "./types";

function makeBase(overrides: Partial<ConstraintBase> = {}): ConstraintBase {
  return {
    id: "c1",
    scope: "subject",
    severity: "must",
    weight: 1,
    enabled: true,
    ...overrides,
  };
}

describe("constraintTier (M-C)", () => {
  it("migrates must→0 when tier is absent", () => {
    expect(constraintTier(makeBase({ severity: "must" }))).toBe(0);
  });

  it("migrates prefer→2 when tier is absent", () => {
    expect(constraintTier(makeBase({ severity: "prefer" }))).toBe(2);
  });

  it("reads tier directly when present — overrides severity-based default", () => {
    expect(constraintTier(makeBase({ severity: "must", tier: 1 }))).toBe(1);
    expect(constraintTier(makeBase({ severity: "prefer", tier: 3 }))).toBe(3);
  });

  it("severityForTier: 0 and 1 → must", () => {
    expect(severityForTier(0)).toBe("must");
    expect(severityForTier(1)).toBe("must");
  });

  it("severityForTier: 2 and 3 → prefer", () => {
    expect(severityForTier(2)).toBe("prefer");
    expect(severityForTier(3)).toBe("prefer");
  });

  it("tierChipLabel returns T0..T3", () => {
    expect(tierChipLabel(0)).toBe("T0");
    expect(tierChipLabel(3)).toBe("T3");
  });

  it("tierDescription returns a non-empty string for each tier", () => {
    for (const t of [0, 1, 2, 3] as const) {
      expect(tierDescription(t).length).toBeGreaterThan(0);
    }
  });
});
