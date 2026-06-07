// The single edit path (Zustand). Every mutation flows through here as a
// placement-granular edit, so the class / teacher / day views — all projections of
// the same project — update together. In-memory for RB2 (seeds the bundled project
// on load); IndexedDB persistence is a later step. Global undo snapshots the project.

import { create } from "zustand";
import { clearCell, movePlacement, placeNormalLesson } from "../domain/edit";
import { canMove, canSwap, type Cell } from "../domain/swaps";
import { buildBundledProject } from "../fixtures/bundled";
import type { Day, Id, Placement, Project } from "../domain/types";

export type DropResult = "swapped" | "moved" | "illegal";

interface ProjectState {
  project: Project;
  past: Project[];
  timetableId: Id;
  place: (classId: Id, day: Day, slot: number, subjectId: Id, teacherIds: Id[]) => void;
  clear: (classId: Id, day: Day, slot: number) => void;
  move: (placement: Placement, day: Day, slot: number) => void;
  /** Drag a lesson from one cell onto another: legal swap (occupied) or move (empty). */
  tryDrop: (source: Cell, target: Cell) => DropResult;
  /** Apply a precomputed fix (from suggestFixes) — undoable like any edit. */
  applyFix: (next: Project) => void;
  undo: () => void;
  reset: () => void;
}

const initial = buildBundledProject();

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: initial,
  past: [],
  timetableId: initial.activeTimetableId!,
  place: (classId, day, slot, subjectId, teacherIds) =>
    set((s) => ({
      past: [...s.past, s.project],
      project: placeNormalLesson(s.project, s.timetableId, classId, day, slot, subjectId, teacherIds),
    })),
  clear: (classId, day, slot) =>
    set((s) => ({
      past: [...s.past, s.project],
      project: clearCell(s.project, s.timetableId, classId, day, slot),
    })),
  move: (placement, day, slot) =>
    set((s) => ({
      past: [...s.past, s.project],
      project: movePlacement(s.project, s.timetableId, placement, day, slot),
    })),
  tryDrop: (source, target) => {
    const s = get();
    const swap = canSwap(s.project, s.timetableId, source, target);
    if (swap) {
      set({ past: [...s.past, s.project], project: swap.project });
      return "swapped";
    }
    const moved = canMove(s.project, s.timetableId, source, target);
    if (moved) {
      set({ past: [...s.past, s.project], project: moved });
      return "moved";
    }
    return "illegal";
  },
  applyFix: (next) => set((s) => ({ past: [...s.past, s.project], project: next })),
  undo: () =>
    set((s) => (s.past.length === 0 ? s : { project: s.past[s.past.length - 1]!, past: s.past.slice(0, -1) })),
  reset: () =>
    set(() => {
      const project = buildBundledProject();
      return { project, past: [], timetableId: project.activeTimetableId! };
    }),
}));
