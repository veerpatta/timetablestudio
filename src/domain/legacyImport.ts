// Parse the legacy viewer's rawData text into a Project. PURE.
//
// Best-effort inference of teachers/subjects/classes from cell text, and
// detection of repeated `ELGA (...)` cells across the primary classes into a
// SINGLE atomic BlockActivity (5 classes × 5 teachers × length 3).
//
// Block detection is keyed on the literal subject token "ELGA" (the only block
// in VPPS today). A more general multi-teacher-block heuristic is deferred —
// see docs/DECISIONS.md. Entity ids are the display names (names are unique).

import { LONG_TO_DAY, parseCell } from "./legacyFormat";
import type {
  BlockActivity,
  Day,
  Lesson,
  Placement,
  Project,
  ScheduleProfile,
  SchoolClass,
  Subject,
  Teacher,
} from "./types";

const ELGA = "ELGA";

interface RawGrid {
  dayOrder: Day[];
  classOrder: string[];
  periodCount: number;
  /** `${className}#${day}#${period}` -> parsed cell */
  cells: Map<string, { subject: string; teachers: string[]; free: boolean }>;
}

function parseGrid(rawData: string): RawGrid {
  const lines = rawData
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0);

  const dayOrder: Day[] = [];
  const classOrder: string[] = [];
  const cells: RawGrid["cells"] = new Map();
  let periodCount = 0;
  let currentDay: Day | null = null;

  for (const line of lines) {
    const long = line.trim();
    if (LONG_TO_DAY[long]) {
      currentDay = LONG_TO_DAY[long]!;
      if (!dayOrder.includes(currentDay)) dayOrder.push(currentDay);
      continue;
    }
    const fields = line.split(",");
    if (fields[0]?.trim() === "Class") {
      periodCount = Math.max(periodCount, fields.length - 1);
      continue;
    }
    if (currentDay === null) continue; // data before any day header
    const className = fields[0]?.trim();
    if (!className) continue;
    if (!classOrder.includes(className)) classOrder.push(className);
    for (let i = 1; i < fields.length; i++) {
      const parsed = parseCell(fields[i] ?? "");
      cells.set(`${className}#${currentDay}#${i}`, parsed);
    }
  }
  return { dayOrder, classOrder, periodCount, cells };
}

function inferGroup(name: string): SchoolClass["group"] {
  const m = name.match(/(\d+)/);
  const n = m ? parseInt(m[1]!, 10) : NaN;
  if (n >= 1 && n <= 5) return "primary";
  if (n >= 11) return "senior";
  return "middle";
}

function groupConsecutive(nums: number[]): number[][] {
  const sorted = [...nums].sort((a, b) => a - b);
  const runs: number[][] = [];
  for (const n of sorted) {
    const last = runs[runs.length - 1];
    if (last && n === last[last.length - 1]! + 1) last.push(n);
    else runs.push([n]);
  }
  return runs;
}

export function importLegacyRawData(rawData: string, name = "Imported"): Project {
  const grid = parseGrid(rawData);

  // First-seen subject + teacher order, plus teacher->subjects for H6.
  const subjectOrder: string[] = [];
  const teacherOrder: string[] = [];
  const teacherSubjects = new Map<string, Set<string>>();
  const note = (subject: string, teachers: string[]) => {
    if (subject && !subjectOrder.includes(subject)) subjectOrder.push(subject);
    for (const t of teachers) {
      if (!teacherOrder.includes(t)) teacherOrder.push(t);
      const set = teacherSubjects.get(t) ?? new Set<string>();
      if (subject) set.add(subject);
      teacherSubjects.set(t, set);
    }
  };

  const activities: (Lesson | BlockActivity)[] = [];
  const placements: Placement[] = [];

  // --- Detect ELGA blocks (one BlockActivity per distinct signature) ---
  const blockBySig = new Map<string, BlockActivity>();
  let blockSeq = 0;
  for (const day of grid.dayOrder) {
    const elgaPeriods: number[] = [];
    for (let p = 1; p <= grid.periodCount; p++) {
      const has = grid.classOrder.some(
        (c) => grid.cells.get(`${c}#${day}#${p}`)?.subject === ELGA,
      );
      if (has) elgaPeriods.push(p);
    }
    for (const run of groupConsecutive(elgaPeriods)) {
      const start = run[0]!;
      const length = run.length;
      const classIds = grid.classOrder.filter((c) =>
        run.some((p) => grid.cells.get(`${c}#${day}#${p}`)?.subject === ELGA),
      );
      // teacher order from the first ELGA cell in the run
      let teacherIds: string[] = [];
      outer: for (const c of classIds) {
        for (const p of run) {
          const cell = grid.cells.get(`${c}#${day}#${p}`);
          if (cell?.subject === ELGA) {
            teacherIds = cell.teachers;
            break outer;
          }
        }
      }
      note(ELGA, teacherIds);
      const sig = `${length}|${[...classIds].sort().join(",")}|${teacherIds.join("/")}`;
      let block = blockBySig.get(sig);
      if (!block) {
        block = {
          kind: "block",
          id: `block-elga-${blockSeq++}`,
          name: ELGA,
          classIds,
          teacherIds,
          length,
        };
        blockBySig.set(sig, block);
        activities.push(block);
      }
      placements.push({ activityId: block.id, day, period: start, pinned: true });
    }
  }

  // --- Detect combined sections ---
  // Cells sharing IDENTICAL (subject, teachers) across ≥2 classes in the same
  // slot are one lesson taught to those classes together — e.g. the senior
  // streams' shared Hindi / English compulsory, or any joint section. The
  // legacy viewer duplicates such a cell in every class row (like ELGA), which
  // would otherwise read as a teacher double-booking. We model it as a length-1
  // multi-class BlockActivity so derive/validate count the teacher as occupied
  // once and export reproduces the per-row text. (A real, working timetable's
  // co-located identical cells are intentional combined sections, not clashes —
  // see docs/DECISIONS.md.)
  const consumed = new Set<string>(); // `${class}#${day}#${period}` taken by a combined block
  const combinedBySig = new Map<string, BlockActivity>();
  let combinedSeq = 0;
  for (const day of grid.dayOrder) {
    for (let p = 1; p <= grid.periodCount; p++) {
      const groups = new Map<
        string,
        { classIds: string[]; subject: string; teachers: string[] }
      >();
      for (const c of grid.classOrder) {
        const cell = grid.cells.get(`${c}#${day}#${p}`);
        if (!cell || cell.free || cell.subject === ELGA) continue;
        const sig = `${cell.subject}|${cell.teachers.join("/")}`;
        const g = groups.get(sig) ?? {
          classIds: [],
          subject: cell.subject,
          teachers: cell.teachers,
        };
        g.classIds.push(c);
        groups.set(sig, g);
      }
      for (const g of groups.values()) {
        if (g.classIds.length < 2) continue; // single-class cell → a normal lesson below
        note(g.subject, g.teachers);
        const key = `1|${[...g.classIds].sort().join(",")}|${g.subject}|${g.teachers.join("/")}`;
        let block = combinedBySig.get(key);
        if (!block) {
          block = {
            kind: "block",
            id: `block-combined-${combinedSeq++}`,
            name: g.subject,
            classIds: g.classIds,
            teacherIds: g.teachers,
            length: 1,
          };
          combinedBySig.set(key, block);
          activities.push(block);
        }
        placements.push({ activityId: block.id, day, period: p, pinned: true });
        for (const c of g.classIds) consumed.add(`${c}#${day}#${p}`);
      }
    }
  }

  // --- Lessons (every remaining non-free, non-ELGA, non-combined cell) ---
  for (const className of grid.classOrder) {
    for (const day of grid.dayOrder) {
      for (let p = 1; p <= grid.periodCount; p++) {
        const cell = grid.cells.get(`${className}#${day}#${p}`);
        if (!cell || cell.free || cell.subject === ELGA) continue;
        if (consumed.has(`${className}#${day}#${p}`)) continue;
        note(cell.subject, cell.teachers);
        const lesson: Lesson = {
          kind: "lesson",
          id: `L|${className}|${day}|${p}`,
          classId: className,
          subjectId: cell.subject,
          teacherIds: cell.teachers,
        };
        activities.push(lesson);
        placements.push({ activityId: lesson.id, day, period: p, pinned: false });
      }
    }
  }

  const teachers: Teacher[] = teacherOrder.map((t) => ({
    id: t,
    name: t,
    subjects: [...(teacherSubjects.get(t) ?? new Set<string>())],
    maxPeriodsPerDay: 6,
    maxPeriodsPerWeek: 36,
    unavailable: [],
  }));
  const subjects: Subject[] = subjectOrder.map((s) => ({ id: s, name: s }));
  const classes: SchoolClass[] = grid.classOrder.map((c) => ({
    id: c,
    name: c,
    group: inferGroup(c),
  }));
  const profile: ScheduleProfile = {
    id: "imported",
    name: "imported",
    days: grid.dayOrder,
    periods: Array.from({ length: grid.periodCount }, (_, i) => ({
      label: `P${i + 1}`,
      start: "",
      end: "",
    })),
  };

  return {
    schemaVersion: 1,
    school: { name },
    teachers,
    classes,
    subjects,
    profiles: [profile],
    activities,
    requirements: { curriculum: [], blocks: [] },
    timetables: [
      { id: "imported", name, profileId: "imported", placements },
    ],
    activeTimetableId: "imported",
  };
}
