// Source-of-truth store for the loaded Project, plus IndexedDB persistence.
// All storage goes through persistence/ (AGENTS.md §3); components never touch db.

import { create } from "zustand";
import type { Activity, Placement, Project } from "../domain/types";
import {
  loadProject,
  saveProject,
  deleteProject,
  listProjectKeys,
  deleteAllData,
  resetDbConnection,
} from "../persistence/db";
import { importLegacyRawData } from "../domain/legacyImport";
import { normalizeProject } from "../domain/requirements";
import { deserializeProject } from "../persistence/projectFile";
import { legacyRawSample } from "../fixtures/legacyRaw.sample";
import { buildBundledProject, isStaleBundled } from "../fixtures/bundled";
import demoJson from "../fixtures/vpps.demo.ttproj.json";

/** Storage-key prefix for project snapshots kept when the bundled timetable is
 * adopted or reset (Prompt F rule 19 — never overwrite without keeping a draft). */
const PREVIOUS_PREFIX = "previous:";
let previousCounter = 0;
function makePreviousKey(): string {
  return `${PREVIOUS_PREFIX}${new Date().toISOString()}:${++previousCounter}`;
}

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
  /** True when the stored project is a VPPS-bundled project older than the
   * current bundled version — drives the M19 "update available" banner. */
  bundledStale: boolean;
  /** Storage key of the most recently kept previous project (one-step undo of an
   * adopt/reset). Null when there is nothing to undo. */
  lastPreviousKey: string | null;
  /** Keys of project snapshots kept across bundled adopt/reset, newest last. */
  previousKeys: string[];
  /** Load the stored project from IndexedDB; a fresh/cleared browser is seeded
   * with the bundled real timetable automatically (M19 zero setup). */
  init: () => Promise<void>;
  /** Re-attempt the storage open after a failure (recovery: "Try again"). */
  retryStorage: () => Promise<void>;
  /** Read the saved project via a fresh, timeout-bounded attempt (recovery:
   * "Download a backup"). Returns null if storage is still unreadable. */
  readBackup: () => Promise<Project | null>;
  /** Wipe storage and re-seed the bundled real timetable (recovery: "Start
   * fresh") — a cleared browser still opens into a working school (M19). */
  startFresh: () => Promise<void>;
  /** Load the bundled real timetable and make it the active project. */
  loadDemo: () => void;
  /** Adopt the latest bundled timetable, keeping the current project as a
   * restorable draft. Used by the stale banner and Settings "Reset". Resolves
   * false (leaving the current project untouched) if the snapshot can't be saved. */
  adoptBundled: () => Promise<boolean>;
  /** Hide the stale banner for this session without changing data. */
  dismissStale: () => void;
  /** Refresh `previousKeys` from storage. */
  refreshPreviousKeys: () => Promise<void>;
  /** Restore a kept previous project as the active one (one-step undo). */
  restorePrevious: (key: string) => Promise<boolean>;
  /** Delete a kept previous project. */
  deletePrevious: (key: string) => Promise<void>;
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
  bundledStale: false,
  lastPreviousKey: null,
  previousKeys: [],

  init: async () => {
    // Don't clobber a project already created in-memory (wizard/import/tests).
    if (get().project) {
      set({ initialized: true, storageStatus: "ready" });
      return;
    }
    try {
      const stored = await loadProject();
      if (stored) {
        set({
          project: stored,
          initialized: true,
          storageStatus: "ready",
          bundledStale: isStaleBundled(stored),
        });
      } else {
        // Zero setup (M19): a fresh/cleared browser opens straight into the real
        // school — full grid, rules on, 0 conflicts — with no user action.
        const bundled = buildBundledProject();
        set({ project: bundled, initialized: true, storageStatus: "ready", bundledStale: false });
        scheduleSave(bundled);
      }
      void get().refreshPreviousKeys();
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
    // Re-seed the bundled school so "start fresh" still lands on a working
    // timetable rather than a blank app (M19 zero setup).
    const bundled = buildBundledProject();
    set({
      project: bundled,
      initialized: true,
      storageStatus: "ready",
      saveFailed: false,
      bundledStale: false,
      lastPreviousKey: null,
      previousKeys: [],
    });
    scheduleSave(bundled);
  },

  loadDemo: () => {
    // The bundled real VPPS school (16 classes, 6 days, ELGA Mon–Thu, rules on).
    const bundled = buildBundledProject();
    set({ project: bundled, initialized: true, storageStatus: "ready", bundledStale: false });
    scheduleSave(bundled);
  },

  adoptBundled: async () => {
    const current = get().project;
    let prevKey: string | null = null;
    if (current) {
      // Keep the current project as a restorable draft BEFORE replacing it. If
      // this save fails we abort — never overwrite without a kept copy (rule 19).
      prevKey = makePreviousKey();
      try {
        await saveProject(current, prevKey);
      } catch {
        set({ saveFailed: true });
        return false;
      }
    }
    const bundled = buildBundledProject();
    set({ project: bundled, bundledStale: false, lastPreviousKey: prevKey });
    scheduleSave(bundled);
    void get().refreshPreviousKeys();
    return true;
  },

  dismissStale: () => set({ bundledStale: false }),

  refreshPreviousKeys: async () => {
    try {
      const keys = await listProjectKeys();
      set({ previousKeys: keys.filter((k) => k.startsWith(PREVIOUS_PREFIX)).sort() });
    } catch {
      /* storage unreadable — leave the list as-is */
    }
  },

  restorePrevious: async (key) => {
    let restored: Project | undefined;
    try {
      restored = (await loadProject(key)) ?? undefined;
    } catch {
      return false;
    }
    if (!restored) return false;
    set((s) => ({
      project: restored,
      bundledStale: isStaleBundled(restored!),
      lastPreviousKey: null,
      previousKeys: s.previousKeys.filter((k) => k !== key),
    }));
    scheduleSave(restored);
    try {
      await deleteProject(key);
    } catch {
      /* best-effort cleanup */
    }
    void get().refreshPreviousKeys();
    return true;
  },

  deletePrevious: async (key) => {
    try {
      await deleteProject(key);
    } catch {
      /* best-effort */
    }
    set((s) => ({
      previousKeys: s.previousKeys.filter((k) => k !== key),
      lastPreviousKey: s.lastPreviousKey === key ? null : s.lastPreviousKey,
    }));
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
