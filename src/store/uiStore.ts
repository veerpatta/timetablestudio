// Small UI-preference store. `advanced` reveals developer details (constraint
// codes, seeds, raw scores) that are hidden from everyday users by default.
// `tourOpen` drives the first-run guided tour (M14) — auto-open until seen,
// replayable from Settings.

import { create } from "zustand";
import { getTourSeen, setTourSeen } from "../persistence/uiPrefs";

interface UiState {
  advanced: boolean;
  toggleAdvanced: () => void;
  /** Whether the guided tour is currently showing. */
  tourOpen: boolean;
  /** Replay the tour (Settings). */
  startTour: () => void;
  /** Finish/skip the tour and remember it so it won't auto-open again. */
  endTour: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  advanced: false,
  toggleAdvanced: () => set((s) => ({ advanced: !s.advanced })),
  tourOpen: !getTourSeen(),
  startTour: () => set({ tourOpen: true }),
  endTour: () => {
    setTourSeen(true);
    set({ tourOpen: false });
  },
}));
