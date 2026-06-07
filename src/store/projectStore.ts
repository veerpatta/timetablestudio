// The single edit path (Zustand). Every mutation flows through here as a
// placement-granular edit, so the class / teacher / day views — all projections of
// the same project — update together. In-memory for RB2 (seeds the bundled project
// on load); IndexedDB persistence is a later step. Global undo snapshots the project.

import { create } from "zustand";
import { clearCell, movePlacement, placeNormalLesson } from "../domain/edit";
import { buildBundledProject } from "../fixtures/bundled";
import type { Day, Id, Placement, Project } from "../domain/types";

interface ProjectState {
  project: Project;
  past: Project[];
  timetableId: Id;
  place: (classId: Id, day: Day, slot: number, subjectId: Id, teacherIds: Id[]) => void;
  clear: (classId: Id, day: Day, slot: number) => void;
  move: (placement: Placement, day: Day, slot: number) => void;
  undo: () => void;
  reset: () => void;
}

const initial = buildBundledProject();

export const useProjectStore = create<ProjectState>((set) => ({
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
  undo: () =>
    set((s) => (s.past.length === 0 ? s : { project: s.past[s.past.length - 1]!, past: s.past.slice(0, -1) })),
  reset: () => set(() => ({ project: buildBundledProject(), past: [] })),
}));
