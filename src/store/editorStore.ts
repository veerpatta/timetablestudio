// Editor state: current day, view mode, selection, and undo/redo history.
// Mutations apply pure ops from domain/edit and commit through projectStore.
// History stores immutable snapshots, so undo restores the exact prior state.

import { create } from "zustand";
import type { Activity, Day, Placement } from "../domain/types";
import {
  addPlacement,
  movePlacement,
  removePlacement,
  togglePin,
  type PlacementRef,
} from "../domain/edit";
import { useProjectStore } from "./projectStore";

interface Snapshot {
  activities: Activity[];
  placements: Placement[];
}

function currentSnapshot(): Snapshot | null {
  const project = useProjectStore.getState().project;
  if (!project) return null;
  const tt = project.timetables.find((t) => t.id === project.activeTimetableId);
  if (!tt) return null;
  // Arrays are treated immutably everywhere, so references are safe to keep.
  return { activities: project.activities, placements: tt.placements };
}

interface EditorState {
  selectedDay: Day;
  viewMode: "class" | "teacher";
  selection: PlacementRef | null;
  past: Snapshot[];
  future: Snapshot[];

  setSelectedDay: (day: Day) => void;
  setViewMode: (mode: "class" | "teacher") => void;
  select: (ref: PlacementRef | null) => void;

  move: (ref: PlacementRef, toDay: Day, toPeriod: number) => void;
  pin: (ref: PlacementRef) => void;
  remove: (ref: PlacementRef) => void;
  add: (activity: Activity, day: Day, period: number, pinned?: boolean) => void;

  undo: () => void;
  redo: () => void;
}

export const useEditorStore = create<EditorState>((set, get) => {
  const apply = (producer: (snap: Snapshot) => Snapshot): void => {
    const snap = currentSnapshot();
    if (!snap) return;
    const next = producer(snap);
    set((s) => ({ past: [...s.past, snap], future: [] }));
    useProjectStore.getState().commitActive(next.activities, next.placements);
  };

  return {
    selectedDay: "Mon",
    viewMode: "class",
    selection: null,
    past: [],
    future: [],

    setSelectedDay: (day) => set({ selectedDay: day }),
    setViewMode: (viewMode) => set({ viewMode }),
    select: (selection) => set({ selection }),

    move: (ref, toDay, toPeriod) =>
      apply((s) => ({
        activities: s.activities,
        placements: movePlacement(s.placements, ref, toDay, toPeriod),
      })),

    pin: (ref) =>
      apply((s) => ({
        activities: s.activities,
        placements: togglePin(s.placements, ref),
      })),

    remove: (ref) =>
      apply((s) => ({
        activities: s.activities,
        placements: removePlacement(s.placements, ref),
      })),

    add: (activity, day, period, pinned = false) =>
      apply((s) => addPlacement(s.activities, s.placements, activity, day, period, pinned)),

    undo: () => {
      const { past } = get();
      if (past.length === 0) return;
      const prev = past[past.length - 1]!;
      const cur = currentSnapshot();
      if (!cur) return;
      set((s) => ({ past: s.past.slice(0, -1), future: [cur, ...s.future] }));
      useProjectStore.getState().commitActive(prev.activities, prev.placements);
    },

    redo: () => {
      const { future } = get();
      if (future.length === 0) return;
      const nextSnap = future[0]!;
      const cur = currentSnapshot();
      if (!cur) return;
      set((s) => ({ past: [...s.past, cur], future: s.future.slice(1) }));
      useProjectStore.getState().commitActive(nextSnap.activities, nextSnap.placements);
    },
  };
});
