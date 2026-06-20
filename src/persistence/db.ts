// Persistence (IndexedDB via idb). The ONLY place the app touches storage
// (AGENTS §3). Save is write-through (the store subscribes); load runs a
// field-presence normalizer so a project written by an earlier milestone still
// loads under a later one — we grow the schema by ADDING arrays, never by a
// version-gated migration ladder (advisor: survive C3/C5 schema growth cheaply).
//
// Pure-ish: guarded so a missing `indexedDB` (Node/jsdom without fake-indexeddb)
// is a silent no-op — the app simply runs from the bundled seed.

import { openDB, type IDBPDatabase } from "idb";
import { seedArtsElectives } from "../domain/electives";
import type { Project } from "../domain/types";

// NOTE: a DIFFERENT name than the legacy M19 cell-model DB ("timetable-studio",
// object store "projects"), which still lingers in returning users' browsers. Opening
// that existing v1 DB would skip our `upgrade` (version unchanged) and our object store
// would never be created — every write would silently fail. A fresh name sidesteps it.
const DB_NAME = "timetable-studio-v6";
const STORE = "project";
const KEY = "current";
const KEY_BACKUPS = "backups"; // restore points live alongside the project (same store, new key)

/** A persisted restore point — survives reload so a bad change is always recoverable. */
export interface Backup {
  id: string;
  label: string;
  createdAt: number; // epoch ms
  project: Project;
}

export const MAX_BACKUPS = 15;

const hasIDB = (): boolean => typeof indexedDB !== "undefined";

let dbPromise: Promise<IDBPDatabase> | null = null;
function db(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(d) {
        if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE);
      },
    });
  }
  return dbPromise;
}

/**
 * Fill in any array fields a stored project might predate, so loading never yields
 * `undefined` where the code expects a list. Defensive + forward-compatible: when
 * C3/C5 add `constraints` / `electiveGroups` / `studentGroups`, list them here and a
 * C1-era saved project upgrades transparently on load. Returns the SAME object when
 * nothing was missing (cheap, referentially honest).
 */
export function normalizeProject(project: Project): Project {
  const p = project as Project & Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  const ensureArray = (key: string) => {
    if (!Array.isArray(p[key])) patch[key] = [];
  };
  ensureArray("profiles");
  ensureArray("teachers");
  ensureArray("classes");
  ensureArray("subjects");
  ensureArray("rooms");
  ensureArray("qualifications");
  ensureArray("requirements");
  ensureArray("events");
  ensureArray("timetables");
  ensureArray("constraints");
  // Forward-compat seams (populated by C5; harmless to seed now):
  ensureArray("electiveGroups");
  ensureArray("studentGroups");

  // One-time migration: a project saved during C2 carries deprecated R4 rules
  // (class-teacher-P1). Convert each to a `class_teacher_p1` constraint. `rules` is read
  // off the RAW blob (it survives the type deletion) and is NOT carried forward — the
  // Project type no longer has it. Without this conversion the setting would be lost.
  const rules = (Array.isArray(p.rules) ? p.rules : []) as Array<Record<string, unknown>>;
  const r4s = rules.filter((r) => r.template === "R4");
  let constraints = (Array.isArray(p.constraints) ? [...p.constraints] : (patch.constraints as unknown[]) ?? []) as unknown as Array<Record<string, unknown>>;
  if (r4s.length > 0) {
    constraints = [...constraints];
    for (const r of r4s) {
      const classId = r.classId as string;
      if (constraints.some((c) => c.template === "class_teacher_p1" && (c.params as { classId?: string })?.classId === classId)) continue;
      constraints.push({ id: `ctp1:${classId}`, scope: "class", severity: "prefer", weight: 3, enabled: true, template: "class_teacher_p1", params: { classId, ...(r.subjectId ? { subjectId: r.subjectId } : {}) } });
    }
    patch.constraints = constraints;
  }

  // Nothing missing and no legacy field → already current; return as-is (no needless copy).
  // Such a project already carries electiveGroups, so no elective migration is needed.
  const hadRules = "rules" in p;
  if (Object.keys(patch).length === 0 && !hadRules) return project;

  const result = { ...project, ...patch } as Project & Record<string, unknown>;
  delete result.rules; // legacy field is no longer part of the Project shape
  // Migrate a pre-C5 VPPS project to the elective model on load (idempotent — a no-op if
  // electives already exist or there are no Arts classes). Returning users get the Arts fix.
  return seedArtsElectives(result as Project);
}

/** Persist the whole project under the single "current" key. No-op without IndexedDB. */
export async function saveProject(project: Project): Promise<void> {
  if (!hasIDB()) return;
  try {
    const d = await db();
    await d.put(STORE, project, KEY);
  } catch {
    /* storage is best-effort; never crash the app over a failed write */
  }
}

/** Load the saved project (normalized), or null if none / storage is unavailable. */
export async function loadProject(): Promise<Project | null> {
  if (!hasIDB()) return null;
  try {
    const d = await db();
    const raw = (await d.get(STORE, KEY)) as Project | undefined;
    return raw ? normalizeProject(raw) : null;
  } catch {
    return null;
  }
}

/** Persist the restore-point list (newest first, capped). No-op without IndexedDB. */
export async function saveBackups(backups: Backup[]): Promise<void> {
  if (!hasIDB()) return;
  try {
    const d = await db();
    await d.put(STORE, backups.slice(0, MAX_BACKUPS), KEY_BACKUPS);
  } catch {
    /* best-effort */
  }
}

/** Load the restore points (each project normalized), or [] if none / unavailable. */
export async function loadBackups(): Promise<Backup[]> {
  if (!hasIDB()) return [];
  try {
    const d = await db();
    const raw = (await d.get(STORE, KEY_BACKUPS)) as Backup[] | undefined;
    return Array.isArray(raw) ? raw.map((b) => ({ ...b, project: normalizeProject(b.project) })) : [];
  } catch {
    return [];
  }
}

/** Drop the saved project (Settings "reset to bundled" uses this). */
export async function clearProject(): Promise<void> {
  if (!hasIDB()) return;
  try {
    const d = await db();
    await d.delete(STORE, KEY);
  } catch {
    /* ignore */
  }
}
