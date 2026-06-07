// The single edit path (Zustand). Every mutation flows through here as a
// placement-granular edit, so the class / teacher / day views — all projections of
// the same project — update together. In-memory for RB2 (seeds the bundled project
// on load); IndexedDB persistence is a later step. Global undo snapshots the project.

import { create } from "zustand";
import { clearCell, movePlacement, placeNormalLesson } from "../domain/edit";
import {
  addClass,
  addPeriod,
  addSubject,
  addTeacher,
  editPeriod,
  removeClass,
  removePeriod,
  removeSubject,
  removeTeacher,
  renameClass,
  renameSubject,
  renameTeacher,
} from "../domain/entityEdit";
import { canMove, canSwap, type Cell } from "../domain/swaps";
import { buildBundledProject } from "../fixtures/bundled";
import { loadProject, saveProject } from "../persistence/db";
import type { Band, Day, Id, Placement, Project, Rule, SchoolClass } from "../domain/types";

export type DropResult = "swapped" | "moved" | "illegal";

export interface NamedVersion {
  id: Id;
  name: string;
  project: Project;
}

interface ProjectState {
  project: Project;
  past: Project[];
  timetableId: Id;
  versions: NamedVersion[];
  place: (classId: Id, day: Day, slot: number, subjectId: Id, teacherIds: Id[]) => void;
  clear: (classId: Id, day: Day, slot: number) => void;
  move: (placement: Placement, day: Day, slot: number) => void;
  /** Drag a lesson from one cell onto another: legal swap (occupied) or move (empty). */
  tryDrop: (source: Cell, target: Cell) => DropResult;
  /** Apply a precomputed fix (from suggestFixes) — undoable like any edit. */
  applyFix: (next: Project) => void;
  /** Rules (RB6): add (from a suggestion or builder), toggle on/off, remove. Undoable. */
  addRule: (rule: Rule) => void;
  toggleRule: (id: Id) => void;
  removeRule: (id: Id) => void;
  /** Entity CRUD (C1) — every op is undoable and persisted. Returns the new id on add. */
  addTeacher: (name: string) => Id;
  renameTeacher: (id: Id, name: string) => void;
  removeTeacher: (id: Id, reassignTo?: Id) => void;
  addSubject: (name: string) => Id;
  renameSubject: (id: Id, name: string) => void;
  removeSubject: (id: Id) => void;
  addClass: (name: string, opts?: { band?: Band; stream?: SchoolClass["stream"] }) => Id;
  renameClass: (id: Id, name: string) => void;
  removeClass: (id: Id) => void;
  editPeriod: (slotIndex: number, patch: { label?: string; start?: string; end?: string }) => void;
  addPeriod: (label?: string) => void;
  removePeriod: (slotIndex: number) => void;
  /** Named versions (RB8): snapshot the current project; restore is undoable. */
  saveVersion: (name: string) => void;
  restoreVersion: (id: Id) => void;
  deleteVersion: (id: Id) => void;
  undo: () => void;
  reset: () => void;
  /** Load a persisted project from IndexedDB, if any (replaces the bundled seed). */
  hydrate: () => Promise<void>;
}

const initial = buildBundledProject();

/** The profile id the active timetable runs on (period edits target it). */
const profileIdOf = (p: Project): Id =>
  p.timetables.find((t) => t.id === p.activeTimetableId)?.profileId ??
  p.profiles.find((x) => x.isDefault)?.id ??
  p.profiles[0]!.id;

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: initial,
  past: [],
  timetableId: initial.activeTimetableId!,
  versions: [],
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
  addRule: (rule) =>
    set((s) => ({ past: [...s.past, s.project], project: { ...s.project, rules: [...s.project.rules, rule] } })),
  toggleRule: (id) =>
    set((s) => ({
      past: [...s.past, s.project],
      project: { ...s.project, rules: s.project.rules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)) },
    })),
  removeRule: (id) =>
    set((s) => ({ past: [...s.past, s.project], project: { ...s.project, rules: s.project.rules.filter((r) => r.id !== id) } })),

  addTeacher: (name) => {
    const { project, id } = addTeacher(get().project, name);
    set((s) => ({ past: [...s.past, s.project], project }));
    return id;
  },
  renameTeacher: (id, name) =>
    set((s) => ({ past: [...s.past, s.project], project: renameTeacher(s.project, id, name) })),
  removeTeacher: (id, reassignTo) =>
    set((s) => ({ past: [...s.past, s.project], project: removeTeacher(s.project, id, { reassignTo }) })),
  addSubject: (name) => {
    const { project, id } = addSubject(get().project, name);
    set((s) => ({ past: [...s.past, s.project], project }));
    return id;
  },
  renameSubject: (id, name) =>
    set((s) => ({ past: [...s.past, s.project], project: renameSubject(s.project, id, name) })),
  removeSubject: (id) =>
    set((s) => ({ past: [...s.past, s.project], project: removeSubject(s.project, id) })),
  addClass: (name, opts) => {
    const { project, id } = addClass(get().project, name, opts);
    set((s) => ({ past: [...s.past, s.project], project }));
    return id;
  },
  renameClass: (id, name) =>
    set((s) => ({ past: [...s.past, s.project], project: renameClass(s.project, id, name) })),
  removeClass: (id) =>
    set((s) => ({ past: [...s.past, s.project], project: removeClass(s.project, id) })),
  editPeriod: (slotIndex, patch) =>
    set((s) => ({ past: [...s.past, s.project], project: editPeriod(s.project, profileIdOf(s.project), slotIndex, patch) })),
  addPeriod: (label) =>
    set((s) => ({ past: [...s.past, s.project], project: addPeriod(s.project, profileIdOf(s.project), label) })),
  removePeriod: (slotIndex) =>
    set((s) => ({ past: [...s.past, s.project], project: removePeriod(s.project, profileIdOf(s.project), slotIndex) })),
  saveVersion: (name) =>
    set((s) => ({ versions: [...s.versions, { id: `ver:${s.versions.length + 1}`, name, project: s.project }] })),
  restoreVersion: (id) =>
    set((s) => {
      const v = s.versions.find((x) => x.id === id);
      return v ? { past: [...s.past, s.project], project: v.project } : s;
    }),
  deleteVersion: (id) => set((s) => ({ versions: s.versions.filter((v) => v.id !== id) })),
  undo: () =>
    set((s) => (s.past.length === 0 ? s : { project: s.past[s.past.length - 1]!, past: s.past.slice(0, -1) })),
  reset: () =>
    set(() => {
      const project = buildBundledProject();
      return { project, past: [], timetableId: project.activeTimetableId! };
    }),
  hydrate: async () => {
    const saved = await loadProject();
    if (saved) set({ project: saved, past: [], timetableId: saved.activeTimetableId! });
  },
}));

/**
 * Turn on IndexedDB persistence: load any saved project, then write-through on every
 * change (edits, CRUD, undo, restore — so a reload reflects the latest state including
 * undone steps). Call once at app start (main.tsx); no-op in tests/Node without IDB.
 * Returns an unsubscribe fn. Persisting is intentionally NOT debounced — saves are
 * tiny and "edits survive reload" must hold even if the tab closes immediately.
 */
export async function enablePersistence(): Promise<() => void> {
  await useProjectStore.getState().hydrate();
  let prev = useProjectStore.getState().project;
  void saveProject(prev); // ensure a seed exists on first run
  return useProjectStore.subscribe((s) => {
    if (s.project !== prev) {
      prev = s.project;
      void saveProject(prev);
    }
  });
}
