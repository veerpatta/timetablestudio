// Small UI-preference store. `advanced` reveals developer details (constraint
// codes, seeds, raw scores) that are hidden from everyday users by default.

import { create } from "zustand";

interface UiState {
  advanced: boolean;
  toggleAdvanced: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  advanced: false,
  toggleAdvanced: () => set((s) => ({ advanced: !s.advanced })),
}));
