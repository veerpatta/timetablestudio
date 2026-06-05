// The REAL Veer Patta Public School timetable — the authoritative data spine.
//
// Single source of truth: the verbatim 6-day rawData snapshot lives at
// docs/sources/rawData.vpps.txt and is imported here as raw text (Vite `?raw`),
// so the app demo, the round-trip test, and quota inference all read the SAME
// bytes — no committed-JSON copy to drift (AGENTS.md §2; docs/SCHOOL_CONTEXT.md).

import rawData from "../../docs/sources/rawData.vpps.txt?raw";
import { importLegacyRawData } from "../domain/legacyImport";
import { normalizeProject } from "../domain/requirements";
import type { Project } from "../domain/types";

/** The verbatim legacy rawData snapshot (real VPPS, 6 days, 16 classes). */
export const VPPS_RAW_DATA: string = rawData;

export const VPPS_SCHOOL_NAME = "Veer Patta Public School";

/** Import the real snapshot into a requirement-normalized Project (the app demo
 * and the M9 solver's quota source). ELGA + senior combined sections arrive as
 * blocks; per-class single lessons become curriculum requirements. */
export function makeRealVppsProject(): Project {
  const imported = importLegacyRawData(rawData, VPPS_SCHOOL_NAME);
  return normalizeProject(imported, imported.activeTimetableId!);
}
