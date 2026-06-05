// IndexedDB persistence via idb. Browser-only (allowed in persistence/ layer).
// All component storage access goes through this module (AGENTS.md §3).
//
// v1 is a single-workspace app: we keep the "current" Project plus any number
// of named saves under string keys in one object store.
//
// Resilience (M11): every operation is bounded by a timeout so a wedged
// IndexedDB (e.g. a blocked upgrade held open by another tab) can never strand
// the app awaiting a promise that will not resolve. On timeout we drop the
// memoized connection so the next attempt starts fresh.

import { openDB, deleteDB, type IDBPDatabase } from "idb";
import type { Project } from "../domain/types";
import { migrate } from "./migrations";

const DB_NAME = "timetable-studio";
const STORE = "projects";
const DB_VERSION = 1;
export const CURRENT_KEY = "current";

/** How long any single storage step may take before we give up (ms). */
export const STORAGE_TIMEOUT_MS = 3000;

/** Thrown when a storage operation does not settle within its timeout. */
export class StorageTimeoutError extends Error {
  constructor(message = "Storage did not respond in time") {
    super(message);
    this.name = "StorageTimeoutError";
  }
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE); // out-of-line keys
        }
      },
    });
  }
  return dbPromise;
}

/** Drop the memoized connection so the next call re-opens from scratch.
 * Used after a timeout/error so "Try again" makes a genuinely fresh attempt. */
export function resetDbConnection(): void {
  dbPromise = null;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new StorageTimeoutError()), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

/** Run a store operation bounded by a timeout; on timeout, reset the cached
 * connection so a retry doesn't reuse the same wedged open. */
async function runWithDb<T>(
  op: (db: IDBPDatabase) => Promise<T>,
  timeoutMs: number,
): Promise<T> {
  try {
    const db = await withTimeout(getDb(), timeoutMs);
    return await withTimeout(op(db), timeoutMs);
  } catch (e) {
    if (e instanceof StorageTimeoutError) resetDbConnection();
    throw e;
  }
}

export async function saveProject(
  project: Project,
  key = CURRENT_KEY,
  timeoutMs = STORAGE_TIMEOUT_MS,
): Promise<void> {
  await runWithDb((db) => db.put(STORE, project, key), timeoutMs);
}

export async function loadProject(
  key = CURRENT_KEY,
  timeoutMs = STORAGE_TIMEOUT_MS,
): Promise<Project | undefined> {
  const stored = await runWithDb(
    (db) => db.get(STORE, key) as Promise<unknown>,
    timeoutMs,
  );
  // Migrate on load so a project persisted under an older schema (e.g. a v1
  // project with no `rules`) is brought current before any UI touches it.
  return stored === undefined ? undefined : migrate(stored);
}

export async function deleteProject(
  key: string,
  timeoutMs = STORAGE_TIMEOUT_MS,
): Promise<void> {
  await runWithDb((db) => db.delete(STORE, key), timeoutMs);
}

export async function listProjectKeys(
  timeoutMs = STORAGE_TIMEOUT_MS,
): Promise<string[]> {
  return runWithDb(async (db) => (await db.getAllKeys(STORE)).map(String), timeoutMs);
}

/** Best-effort: drop the whole database so the app can start clean. A delete
 * blocked by another open tab still resolves to a fresh in-memory state — the
 * recovery screen tells the user to close other tabs of this site. */
export async function deleteAllData(timeoutMs = STORAGE_TIMEOUT_MS): Promise<void> {
  resetDbConnection();
  try {
    await withTimeout(deleteDB(DB_NAME), timeoutMs);
  } catch {
    /* blocked or timed out — proceed to a clean in-memory state anyway */
  }
}
