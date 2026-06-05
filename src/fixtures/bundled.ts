// The bundled VPPS timetable — the app's zero-setup default project (M19).
//
// `buildBundledProject()` is the single source of the built-in school: the
// PDF-true real dataset (`makeRealVppsProject`) with the rules the timetable
// already lives by (R4 anchors, R6 doubles, R7 ELGA config) pre-detected and
// enabled, stamped with the current `BUNDLED_DATA_VERSION`. A fresh browser
// opens straight into this — full grid, rules on, 0 conflicts, no user action.
//
// BUNDLED_DATA_VERSION is sacred (AGENTS Prompt F rule 19): bump it whenever the
// built-in timetable changes so returning browsers are offered the update; never
// overwrite a user's project without keeping the old one as a draft.

import { detectRules, acceptProposal } from "../domain/ruleDetect";
import type { Project } from "../domain/types";
import { makeRealVppsProject, VPPS_SCHOOL_NAME } from "./vppsReal";

/** Revision of the built-in timetable. Bump on ANY change to the bundled data
 * or its pre-enabled rules so stale-data detection fires for returning users. */
export const BUNDLED_DATA_VERSION = 1;

/** Build the bundled default project: real VPPS data + its lived-by rules,
 * stamped with the current bundled version. Deterministic and side-effect-free. */
export function buildBundledProject(): Project {
  let project = makeRealVppsProject();
  const timetable = project.timetables.find((t) => t.id === project.activeTimetableId);
  if (timetable) {
    // Accept every rule the actual timetable already satisfies — anchors, doubles
    // and the ELGA block config. All are detected FROM the placements, so they add
    // zero hard conflicts (the R7 block "must" matches the real ELGA slots).
    for (const proposal of detectRules(project, timetable)) {
      project = acceptProposal(project, proposal);
    }
  }
  return { ...project, bundledDataVersion: BUNDLED_DATA_VERSION };
}

/** True when a stored project is a VPPS-bundled project older than the current
 * bundled version (so the M19 update banner should offer the latest). Gated on
 * the school name so a user's own school never sees the banner — "Start a
 * different school" is the escape hatch (see docs/DECISIONS.md). */
export function isStaleBundled(project: Project): boolean {
  return (
    project.school.name === VPPS_SCHOOL_NAME &&
    (project.bundledDataVersion ?? 0) < BUNDLED_DATA_VERSION
  );
}
