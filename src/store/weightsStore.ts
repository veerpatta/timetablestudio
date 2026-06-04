// Soft-constraint weights (S1–S6). Feeds scoreTimetable so the user can re-rank
// candidates without re-solving. Defaults from CONSTRAINTS.md.

import { create } from "zustand";
import { DEFAULT_WEIGHTS, type SoftWeights } from "../solver/score";

interface WeightsState {
  weights: SoftWeights;
  setWeight: (key: keyof SoftWeights, value: number) => void;
  reset: () => void;
}

export const useWeightsStore = create<WeightsState>((set) => ({
  weights: { ...DEFAULT_WEIGHTS },
  setWeight: (key, value) =>
    set((s) => ({ weights: { ...s.weights, [key]: Math.max(0, value) } })),
  reset: () => set({ weights: { ...DEFAULT_WEIGHTS } }),
}));
