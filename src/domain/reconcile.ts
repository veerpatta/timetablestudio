// Reconcile the imported rawData project with the AUTHORITATIVE Class_Wise.pdf
// (docs/sources/Class_Wise.pdf). PURE. The PDF is ground truth (AGENTS rule 16):
// it carries facts rawData.vpps.txt drops — the real per-period clock times, the
// mid-morning break, and the board-class flags — plus canonical subject labels.
//
// What this DOES change (PDF facts the rawData import omits):
//   • per-period start/end times + the break after P4 (heatwave profile)
//   • SchoolClass.isBoardClass on the four "Board class priority protected" pages
// What it does NOT change: the cell subject/teacher data (rawData already matches
// the PDF cell-for-cell). Subject LABELS differ only in verbosity — see
// PDF_SUBJECT_ALIASES — handled as a display/compare alias, NOT a rename, so the
// legacy round-trip (which must reproduce rawData verbatim) stays byte-exact.

import type { Project, ScheduleProfile } from "./types";

/** Heatwave clock, read off Class_Wise.pdf headers (P1 7:30 … break … P6 11:45). */
export const HEATWAVE_PERIOD_TIMES: ReadonlyArray<readonly [string, string]> = [
  ["07:30", "08:10"],
  ["08:10", "08:50"],
  ["08:50", "09:30"],
  ["09:30", "10:10"],
  ["10:25", "11:05"],
  ["11:05", "11:45"],
];

/** The mid-morning break sits between P4 (ends 10:10) and P5 (starts 10:25). */
export const HEATWAVE_BREAK = { afterPeriod: 4, start: "10:10", end: "10:25" } as const;

/** Pages marked "Board class priority protected" in Class_Wise.pdf. */
export const BOARD_CLASSES: ReadonlyArray<string> = [
  "Class 10",
  "Class 12 Arts",
  "Class 12 Commerce",
  "Class 12 Science",
];

/** rawData's verbose subject label → the PDF's canonical (often abbreviated) one.
 * Same subject, different display string — used to compare the grid to the PDF,
 * never to rewrite stored data. */
export const PDF_SUBJECT_ALIASES: Readonly<Record<string, string>> = {
  "English compulsory": "English",
  "Core Revision": "Revision",
  "English Literature": "Eng. Lit.",
  "Political Science": "Pol. Sci.",
  "Business Studies": "B. Studies",
  "English Revision": "Eng. Revision",
};

/** The PDF label for a raw subject name (identity if there is no alias). */
export const pdfSubjectLabel = (raw: string): string => PDF_SUBJECT_ALIASES[raw] ?? raw;

function reconcileProfile(profile: ScheduleProfile): ScheduleProfile {
  // Only fill times the import left blank; respect a profile that already has them.
  const periods = profile.periods.map((p, i) => {
    const t = HEATWAVE_PERIOD_TIMES[i];
    return p.start && p.end ? p : { ...p, start: t?.[0] ?? p.start, end: t?.[1] ?? p.end };
  });
  return { ...profile, periods, break: profile.break ?? { ...HEATWAVE_BREAK } };
}

/** Apply the PDF's structural facts (clock + break + board flags) to a project. */
export function reconcileWithPdf(project: Project): Project {
  const board = new Set(BOARD_CLASSES);
  return {
    ...project,
    profiles: project.profiles.map(reconcileProfile),
    classes: project.classes.map((c) => (board.has(c.id) ? { ...c, isBoardClass: true } : c)),
  };
}
