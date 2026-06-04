// Source-of-truth store for the loaded Project, plus IndexedDB persistence.
// All storage goes through persistence/ (AGENTS.md §3); components never touch db.

import { create } from "zustand";
import type { Activity, Placement, Project } from "../domain/types";
import { loadProject, saveProject } from "../persistence/db";
import { importLegacyRawData } from "../domain/legacyImport";
import { normalizeProject } from "../domain/requirements";
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

/** Default starting project: the bundled VPPS sample (imported from rawData),
 * normalized into a requirement-driven project so quotas + the solver work. */
export function makeSampleProject(): Project {
  const imported = importLegacyRawData(legacyRawSample, "VPPS (sample)");
  return normalizeProject(imported, imported.activeTimetableId!);
}

interface ProjectState {
  project: Project | null;
  /** Load from IndexedDB if present, else seed with the sample and persist it. */
  init: () => Promise<void>;
  setProject: (project: Project, persist?: boolean) => void;
  /** Replace the active timetable's placements (and project activities). */
  commitActive: (activities: Activity[], placements: Placement[]) => void;
  /** Add a new timetable draft (e.g. a solver result) and make it active.
   * Never overwrites the source draft. Returns the new timetable id. */
  addDraft: (name: string, placements: Placement[]) => string | null;
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

  addDraft: (name, placements) => {
    const project = get().project;
    if (!project) return null;
    const source = project.timetables.find((t) => t.id === project.activeTimetableId);
    const profileId = source?.profileId ?? project.profiles[0]?.id ?? "";
    let id = `draft-${project.timetables.length + 1}`;
    while (project.timetables.some((t) => t.id === id)) id += "x";
    const next: Project = {
      ...project,
      timetables: [...project.timetables, { id, name, profileId, placements }],
      activeTimetableId: id,
    };
    set({ project: next });
    scheduleSave(next);
    return id;
  },
}));
