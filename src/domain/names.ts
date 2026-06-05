// Pure entity-name lookups, shared by the rule engine and the sentence renderer.
// Falls back to the id when an entity is missing, so messages never go blank.

import type { Id, Project, SchoolClass } from "./types";

export interface Names {
  teacher: (id: Id) => string;
  className: (id: Id) => string;
  subject: (id: Id) => string;
  classOf: (id: Id) => SchoolClass | undefined;
}

export function buildNames(project: Project): Names {
  const t = new Map(project.teachers.map((x) => [x.id, x.name] as const));
  const c = new Map(project.classes.map((x) => [x.id, x] as const));
  const s = new Map(project.subjects.map((x) => [x.id, x.name] as const));
  return {
    teacher: (id) => t.get(id) ?? id,
    className: (id) => c.get(id)?.name ?? id,
    subject: (id) => s.get(id) ?? id,
    classOf: (id) => c.get(id),
  };
}

/** "1, 2, 3" */
export const listPeriods = (periods: number[]): string => periods.join(", ");
/** "Mon, Tue, Wed" */
export const listDays = (days: string[]): string => days.join(", ");
/** "Maths, Science" */
export function listNames(ids: Id[], name: (id: Id) => string): string {
  return ids.map(name).join(", ");
}
