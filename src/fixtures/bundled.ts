// The bundled, zero-setup default project: the REAL 8-period 2026-27 VPPS
// timetable on the event model. The app opens to this, pre-loaded and clash-free,
// so the owner only tweaks (docs/REBUILD.md decision 1). It is built deterministically
// from the authoritative cell grid (realGrid.ts) by the pure buildProject() folder.
//
// Bump BUNDLED_DATA_VERSION whenever this data changes (Prompt F rule 19 / REBUILD).

import { buildProject, type BuildInput } from "../domain/buildProject";
import type { Project, Subject } from "../domain/types";
import { REAL_GRID, REAL_GRID_CLASS_ORDER } from "./realGrid";

export const BUNDLED_DATA_VERSION = 1;
export const VPPS_SCHOOL_NAME = "Shri Veer Patta Senior Secondary School";

/** The five primary teachers who co-teach the ELGA team block (analysis §3.1). */
const ELGA_TEAM = ["Bindu", "Anita", "Rashmita", "Kusum", "Ravina"];

// Board-exam classes (CBSE: X and XII). Powers R9 (RB6); refine if the owner's
// "Board classes highlighted" set differs (the PDF highlight colour was ambiguous).
const BOARD = new Set(["Class 10", "Class 12 Science", "Class 12 Commerce", "Class 12 Arts"]);

const STREAMS: Record<string, "Science" | "Commerce" | "Arts"> = {
  "Class 11 Science": "Science",
  "Class 11 Commerce": "Commerce",
  "Class 11 Arts": "Arts",
  "Class 12 Science": "Science",
  "Class 12 Commerce": "Commerce",
  "Class 12 Arts": "Arts",
};

const SUBJECT_KIND: Record<string, Subject["kind"]> = {
  Sports: "activity",
  Robotics: "activity",
  CCS: "activity",
  "NoteBook Checking": "activity",
  "Self Study": "study",
  Free: "study",
};

function buildInput(): BuildInput {
  const classMeta: BuildInput["classMeta"] = {};
  for (const name of REAL_GRID_CLASS_ORDER) {
    const n = parseInt(name.replace(/\D/g, ""), 10);
    classMeta[name] = {
      band: n <= 5 ? "primary" : n <= 8 ? "middle" : n <= 10 ? "secondary" : "senior",
      ...(STREAMS[name] ? { stream: STREAMS[name] } : {}),
      ...(BOARD.has(name) ? { isBoardClass: true } : {}),
    };
  }
  return {
    schoolName: VPPS_SCHOOL_NAME,
    bundledDataVersion: BUNDLED_DATA_VERSION,
    classOrder: REAL_GRID_CLASS_ORDER,
    grid: REAL_GRID,
    classMeta,
    teacherMeta: {
      // Hard availability windows (analysis §3.4). Mahesh teaches only the early
      // periods; Anjana only after recess. Director is admin, never scheduled.
      Mahesh: { unavailablePeriods: ["P4", "P5", "P6", "P7", "P8"] },
      Anjana: { unavailablePeriods: ["P1", "P2", "P3", "P4"] },
      Director: { schedulable: false },
    },
    extraTeachers: ["Director"],
    subjectKind: SUBJECT_KIND,
    elgaTeam: ELGA_TEAM,
  };
}

/**
 * The RAW transcription (no elective modelling) — matches the source grid cell-for-cell.
 * Used by the round-trip test; the live app uses buildBundledProject (with electives).
 */
export function buildBundledProjectRaw(): Project {
  return buildProject(buildInput());
}

/**
 * Build the bundled real VPPS project (fresh each call). Arts electives are ordinary
 * whole-class lessons exactly as the school's authoritative timetable shows them — no
 * per-student "Self Study" option-line model (owner decision, 2026-06-20). The raw grid
 * already runs the four electives in distinct slots, so this needs no extra modelling.
 */
export function buildBundledProject(): Project {
  return buildBundledProjectRaw();
}
