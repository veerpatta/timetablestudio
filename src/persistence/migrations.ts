// schemaVersion migrations. Pure. As the schema evolves, add a step per version
// and chain them here. Loading a v1 project upgrades it to v2 (adds `rules: []`).

import type { Project } from "../domain/types";

export const CURRENT_SCHEMA_VERSION = 2 as const;

/** v1 → v2: introduce the configurable Rule system. v1 has no `rules` field;
 * new entity/profile fields (classTeacherId, isBoardClass, block allowedDays,
 * lesson duration, profile break) are all optional, so no rewrite is needed. */
function migrateV1toV2(data: Record<string, unknown>): Record<string, unknown> {
  return {
    ...data,
    schemaVersion: 2,
    rules: Array.isArray(data.rules) ? data.rules : [],
  };
}

/** Bring a parsed, untyped project record up to the current schema version. */
export function migrate(data: unknown): Project {
  if (typeof data !== "object" || data === null) {
    throw new Error("Invalid project file: not an object");
  }
  let record = data as Record<string, unknown>;
  if (record.schemaVersion === 1) {
    record = migrateV1toV2(record);
  }
  if (record.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported schemaVersion ${String(record.schemaVersion)} (expected ${CURRENT_SCHEMA_VERSION})`,
    );
  }
  return record as unknown as Project;
}
