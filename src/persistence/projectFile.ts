// JSON project file import/export (*.ttproj.json). PURE — no DOM/IndexedDB.
// This is the backup story: one pretty-printed JSON file, no server.

import type { Project } from "../domain/types";
import { migrate } from "./migrations";

export const PROJECT_FILE_EXT = ".ttproj.json";

/** Pretty-printed JSON, trailing newline (git-friendly, stable diffs). */
export function serializeProject(project: Project): string {
  return JSON.stringify(project, null, 2) + "\n";
}

/** Parse + migrate a project file's text. Throws on malformed/unsupported input. */
export function deserializeProject(text: string): Project {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error(`Invalid project file: not valid JSON (${(e as Error).message})`);
  }
  return migrate(data);
}

/** Suggested download filename from the school name, e.g. `vpps.ttproj.json`. */
export function suggestFilename(project: Project): string {
  const slug =
    project.school.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "timetable";
  return `${slug}${PROJECT_FILE_EXT}`;
}
