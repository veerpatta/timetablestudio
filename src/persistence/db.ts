// IndexedDB persistence via idb. Browser-only (allowed in persistence/ layer).
// All component storage access goes through this module (AGENTS.md §3).
//
// v1 is a single-workspace app: we keep the "current" Project plus any number
// of named saves under string keys in one object store.

import { openDB, type IDBPDatabase } from "idb";
import type { Project } from "../domain/types";

const DB_NAME = "timetable-studio";
const STORE = "projects";
const DB_VERSION = 1;
export const CURRENT_KEY = "current";

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

export async function saveProject(project: Project, key = CURRENT_KEY): Promise<void> {
  const db = await getDb();
  await db.put(STORE, project, key);
}

export async function loadProject(key = CURRENT_KEY): Promise<Project | undefined> {
  const db = await getDb();
  return (await db.get(STORE, key)) as Project | undefined;
}

export async function deleteProject(key: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORE, key);
}

export async function listProjectKeys(): Promise<string[]> {
  const db = await getDb();
  return (await db.getAllKeys(STORE)).map(String);
}
