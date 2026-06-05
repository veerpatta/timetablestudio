// Source-of-truth store for the loaded Project, plus IndexedDB persistence.
// All storage goes through persistence/ (AGENTS.md §3); components never touch db.

import { create } from "zustand";
import type { Activity, Placement, Project } from "../domain/types";
import { loadProject, saveProject, deleteAllData, resetDbConnection } from "../persistence/db";
import { importLegacyRawData } from "../domain/legacyImport";
import { normalizeProject } from "../domain/requirements";
import { deserializeProject } from "../persistence/projectFile";
import { legacyRawSample } from "../fixtures/legacyRaw.sample";
import { makeRealVppsProject } from "../fixtures/vppsReal";
import demoJson from "../fixtures/vpps.demo.ttproj.json";

let saveTimer: ReturnType<typeof setTimeout> | null = null;
const AUTOSAVE_MS = 400;

function scheduleSave(project: Project): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    // saveProject is timeout-bounded, so a wedged IndexedDB rejects here
    // instead of hanging — that flips the non-blocking "not saving" banner on.
    saveProject(project).then(
      () => useProjectStore.setState({ saveFailed: false }),
      () => useProjectStore.setState({ saveFailed: true }),
    );
  }, AUTOSAVE_MS);
}

/** The 2-day synthetic VPPS sample — TEST fixture only (used by ~60 unit tests).
 * NOT the app's first-run data; the app uses the demo (see `loadDemo`). */
export function makeSampleProject(): Project {
  const imported = importLegacyRawData(legacyRawSample, "VPPS (sample)");
  return normalizeProject(imported, imported.activeTimetableId!);
}

/** Synthetic clean 6-day project (built by scripts/buildDemoFixture.ts).
 * TEST fixture only since M12 — the app's "Explore demo" now loads the REAL
 * VPPS school (`makeRealVppsProject`); this stays as a representative 16-class
 * project for the many solver/grid/edit tests that depend on it. */
export function makeDemoProject(): Project {
  return deserializeProject(JSON.stringify(demoJson));
}

/** Storage health, so the UI can distinguish loading / ready / wedged. */
export type StorageStatus = "loading" | "ready" | "error";

interface ProjectState {
  project: Project | null;
  /** True once init() has run, so the UI can tell "loading" from "empty". */
  initialized: boolean;
  /** Whether IndexedDB opened cleanly. "error" drives the recovery screen. */
  storageStatus: StorageStatus;
  /** True when the debounced autosave last failed — drives a non-blocking banner. */
  saveFailed: boolean;
  /** Load the stored project from IndexedDB if any. Never auto-seeds — a fresh
   * user gets the empty state and chooses a path (wizard / import / demo). */
  init: () => Promise<void>;
  /** Re-attempt the storage open after a failure (recovery: "Try again"). */
  retryStorage: () => Promise<void>;
  /** Read the saved project via a fresh, timeout-bounded attempt (recovery:
   * "Download a backup"). Returns null if storage is still unreadable. */
  readBackup: () => Promise<Project | null>;
  /** Wipe storage and start from a clean empty state (recovery: "Start fresh"). */
  startFresh: () => Promise<void>;
  /** Load the demo dataset and make it the active project (explicit user action). */
  loadDemo: () => void;
  setProject: (project: Project, persist?: boolean) => void;
  /** Replace the active timetable's placements (and project activities). */
  commitActive: (activities: Activity[], placements: Placement[]) => void;
  /** Add a new timetable draft (e.g. a solver result) and make it active.
   * Never overwrites the source draft. Returns the new timetable id. */
  addDraft: (name: string, placements: Placement[]) => string | null;
  /** Switch the active timetable draft. */
  setActiveTimetable: (id: string) => void;
  /** Delete a draft (keeps at least one); re-points active if needed. */
  deleteTimetable: (id: string) => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: null,
  initialized: false,
  storageStatus: "loading",
  saveFailed: false,

  init: async () => {
    // Don't clobber a project already created in-memory (wizard/import/tests).
    if (get().project) {
      set({ initialized: true, storageStatus: "ready" });
      return;
    }
    try {
      const stored = await loadProject();
      set({ project: stored ?? null, initialized: true, storageStatus: "ready" });
    } catch {
      // Wedged/erroring IndexedDB — never strand on "Loading…"; show recovery.
      set({ project: null, initialized: true, storageStatus: "error" });
    }
  },

  retryStorage: async () => {
    resetDbConnection();
    set({ project: null, initialized: false, storageStatus: "loading" });
    await get().init();
  },

  readBackup: async () => {
    resetDbConnection();
    try {
      return (await loadProject()) ?? null;
    } catch {
      return null;
    }
  },

  startFresh: async () => {
    await deleteAllData();
    set({ project: null, initialized: true, storageStatus: "ready", saveFailed: false });
  },

  loadDemo: () => {
    // M12: the demo IS the real VPPS school (16 classes, 6 days, ELGA Mon–Thu).
    const demo = makeRealVppsProject();
    set({ project: demo, initialized: true, storageStatus: "ready" });
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

  setActiveTimetable: (id) => {
    const project = get().project;
    if (!project || !project.timetables.some((t) => t.id === id)) return;
    const next = { ...project, activeTimetableId: id };
    set({ project: next });
    scheduleSave(next);
  },

  deleteTimetable: (id) => {
    const project = get().project;
    if (!project || project.timetables.length <= 1) return;
    const timetables = project.timetables.filter((t) => t.id !== id);
    const activeTimetableId =
      project.activeTimetableId === id ? timetables[0]!.id : project.activeTimetableId;
    const next = { ...project, timetables, activeTimetableId };
    set({ project: next });
    scheduleSave(next);
  },
}));
