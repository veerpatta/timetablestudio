import { describe, it, expect, beforeEach } from "vitest";
import { useWeightsStore } from "./weightsStore";
import { DEFAULT_WEIGHTS } from "../solver/score";

beforeEach(() => useWeightsStore.getState().reset());

describe("weightsStore", () => {
  it("starts at the CONSTRAINTS.md defaults", () => {
    expect(useWeightsStore.getState().weights).toEqual(DEFAULT_WEIGHTS);
  });

  it("setWeight updates one key and clamps to >= 0", () => {
    useWeightsStore.getState().setWeight("S1", 9);
    expect(useWeightsStore.getState().weights.S1).toBe(9);
    useWeightsStore.getState().setWeight("S2", -5);
    expect(useWeightsStore.getState().weights.S2).toBe(0);
  });

  it("reset restores defaults", () => {
    useWeightsStore.getState().setWeight("S3", 99);
    useWeightsStore.getState().reset();
    expect(useWeightsStore.getState().weights).toEqual(DEFAULT_WEIGHTS);
  });
});
