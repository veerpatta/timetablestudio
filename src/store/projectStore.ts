// Source-of-truth store for the loaded Project, plus IndexedDB persistence.
// All storage goes through persistence/ (AGENTS.md §3); components never touch db.

import { create } from "zustand";
import type { Activity, Placement, Project } from "../domain/types";
import { loadProject, saveProject } from "../persistence/db";
import { importLegacyRawData } from "../domain/legacyImport";
import { legacyRawSample } from "../fixtures/legacyRaw.sample";

let saveTimer: ReturnType<typeof setTimeout> | null = null;
const AUTOSAVE_MS = 400;

function scheduleSave(project: Project): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    void saveProject(project);
    saveTimer = null;
  }, AUTOSAVE_MS);
}

/** Default starting project: the bundled VPPS sample (imported from rawData). */
export function makeSampleProject(): Project {
  return importLegacyRawData(legacyRawSample, "VPPS (sample)");
}

interface ProjectState {
  project: Project | null;
  /** Load from IndexedDB if present, else seed with the sample and persist it. */
  init: () => Promise<void>;
  setProject: (project: Project, persist?: boolean) => void;
  /** Replace the active timetable's placements (and project activities). */
  commitActive: (activities: Activity[], placements: Placement[]) => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: null,

  init: async () => {
    const stored = await loadProject();
    if (stored) {
      set({ project: stored });
      return;
    }
    const seeded = makeSampleProject();
    set({ project: seeded });
    await saveProject(seeded);
  },

  setProject: (project, persist = true) => {
    set({ project });
    if (persist) scheduleSave(project);
  },

  commitActive: (activities, placements) => {
    const project = get().project;
    if (!project) return;
    const next: Project = {
      ...project,
      activities,
      timetables: project.timetables.map((t) =>
        t.id === project.activeTimetableId ? { ...t, placements } : t,
      ),
    };
    set({ project: next });
    scheduleSave(next);
  },
}));
