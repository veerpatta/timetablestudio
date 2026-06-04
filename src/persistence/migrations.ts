// schemaVersion migrations. Pure. As the schema evolves, add a step per version
// and chain them here. Today only v1 exists, so this is an identity + guard.

import type { Project } from "../domain/types";

export const CURRENT_SCHEMA_VERSION = 1 as const;

/** Bring a parsed, untyped project record up to the current schema version. */
export function migrate(data: unknown): Project {
  if (typeof data !== "object" || data === null) {
    throw new Error("Invalid project file: not an object");
  }
  const record = data as { schemaVersion?: unknown };
  if (record.schemaVersion !== 1) {
    throw new Error(
      `Unsupported schemaVersion ${String(record.schemaVersion)} (expected ${CURRENT_SCHEMA_VERSION})`,
    );
  }
  // v1 is current — no transformation needed.
  return data as Project;
}
