// Source-of-truth store for the loaded Project, plus IndexedDB persistence.
// All storage goes through persistence/ (AGENTS.md §3); components never touch db.

import { create } from "zustand";
import type { Activity, Placement, Project } from "../domain/types";
import { loadProject, saveProject } from "../persistence/db";
import { importLegacyRawData } from "../domain/legacyImport";
import { normalizeProject } from "../domain/requirements";
import { deserializeProject } from "../persistence/projectFile";
import { legacyRawSample } from "../fixtures/legacyRaw.sample";
import demoJson from "../fixtures/vpps.demo.ttproj.json";

let saveTimer: ReturnType<typeof setTimeout> | null = null;
const AUTOSAVE_MS = 400;

function scheduleSave(project: Project): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    void saveProject(project);
    saveTimer = null;
  }, AUTOSAVE_MS);
}

/** The 2-day synthetic VPPS sample — TEST fixture only (used by ~60 unit tests).
 * NOT the app's first-run data; the app uses the demo (see `loadDemo`). */
export function makeSampleProject(): Project {
  const imported = importLegacyRawData(legacyRawSample, "VPPS (sample)");
  return normalizeProject(imported, imported.activeTimetableId!);
}

/** The bundled clean 6-day demo project (built by scripts/buildDemoFixture.ts). */
export function makeDemoProject(): Project {
  return deserializeProject(JSON.stringify(demoJson));
}

interface ProjectState {
  project: Project | null;
  /** True once init() has run, so the UI can tell "loading" from "empty". */
  initialized: boolean;
  /** Load the stored project from IndexedDB if any. Never auto-seeds — a fresh
   * user gets the empty state and chooses a path (wizard / import / demo). */
  init: () => Promise<void>;
  /** Load the demo dataset and make it the active project (explicit user action). */
  loadDemo: () => void;
  setProject: (project: Project, persist?: boolean) => void;
  /** Replace the active timetable's placements (and project activities). */
  commitActive: (activities: Activity[], placements: Placement[]) => void;
  /** Add a new timetable draft (e.g. a solver result) and make it active.
   * Never overwrites the source draft. Returns the new timetable id. */
  addDraft: (name: string, placements: Placement[]) => string | null;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: null,
  initialized: false,

  init: async () => {
    // Don't clobber a project already created in-memory (wizard/import/tests).
    if (get().project) {
      set({ initialized: true });
      return;
    }
    const stored = await loadProject();
    set({ project: stored ?? null, initialized: true });
  },

  loadDemo: () => {
    const demo = makeDemoProject();
    set({ project: demo, initialized: true });
    scheduleSave(demo);
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
