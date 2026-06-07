// PURE builder: a cell grid (16 classes × 6 days × 8 periods of "Subject|Teacher"
// tokens) → a v6 event-model Project. This is where the class-wise view is folded
// into EVENTS: repeated single-class cells collapse to one normal event placed many
// times; cells that share (subject, teacher, day, slot) across classes become ONE
// joint_class event; ELGA cells become ONE team_block. Deterministic; no I/O.
//
// The reverse (project → grid) lives in gridFromProject() so the round-trip is
// checkable cell-for-cell (realGrid.test.ts).

import { buildRegularProfile, teachingSlots } from "./profile";
import type {
  Band,
  EventType,
  Profile,
  Project,
  Qualification,
  Requirement,
  SchoolClass,
  Subject,
  Teacher,
  TimetableEvent,
} from "./types";

export interface ClassMeta {
  band: Band;
  stream?: SchoolClass["stream"];
  isBoardClass?: boolean;
}
export interface TeacherMeta {
  schedulable?: boolean; // default true
  unavailablePeriods?: string[]; // e.g. ["P4","P5"] — mapped to regular-profile slots
  maxPerDay?: number;
  maxPerWeek?: number;
}
export interface BuildInput {
  schoolName: string;
  bundledDataVersion: number;
  classOrder: string[];
  grid: Record<string, string[][]>; // [day 0..5][period 0..7] tokens
  classMeta: Record<string, ClassMeta>;
  teacherMeta: Record<string, TeacherMeta>;
  extraTeachers?: string[]; // e.g. Director — not present in any cell
  subjectKind: Record<string, Subject["kind"]>; // override; default "academic"
  elgaTeam: string[];
}

const SPECIAL_TYPE: Record<string, EventType> = {
  Sports: "sports",
  Robotics: "robotics",
  CCS: "ccs",
  "Self Study": "self_study",
  "NoteBook Checking": "notebook_check",
  Free: "free",
  ELGA: "team_block",
};

interface ParsedCell {
  subject: string;
  teachers: string[];
  type: EventType; // "normal" unless special; joint promotion happens later
}

function parseCell(token: string, elgaTeam: string[]): ParsedCell | null {
  if (!token) return null;
  if (token === "ELGA") return { subject: "ELGA", teachers: [...elgaTeam], type: "team_block" };
  if (token === "Free") return { subject: "Free", teachers: [], type: "free" };
  const [subject, who] = token.split("|");
  const teachers = who ? who.split(",").map((t) => t.trim()).filter(Boolean) : [];
  return { subject: subject!, teachers, type: SPECIAL_TYPE[subject!] ?? "normal" };
}

function bandOf(className: string): Band {
  const n = parseInt(className.replace(/\D/g, ""), 10);
  if (n <= 5) return "primary";
  if (n <= 8) return "middle";
  if (n <= 10) return "secondary";
  return "senior";
}

interface EventBuilder {
  id: string;
  type: EventType;
  subject: string;
  classes: Set<string>;
  teachers: string[];
  duration: number;
  placements: Set<string>; // `${dayIdx}#${period}`
  pinned: boolean;
}

/** Build the full v6 project from a cell grid. */
export function buildProject(input: BuildInput): Project {
  const regular = buildRegularProfile();
  const profiles: Profile[] = [regular];
  const periodToSlot = teachingSlots(regular); // [1,2,3,4,6,7,8,9]

  const events = new Map<string, EventBuilder>();
  const quals = new Set<string>(); // `${teacher}#${subject}#${class}`
  const reqCount = new Map<string, { className: string; subject: string; teachers: Set<string>; n: number }>();
  const subjectNames = new Set<string>();
  const teacherNames = new Set<string>(input.extraTeachers ?? []);

  const getEvent = (key: string, seed: Omit<EventBuilder, "placements">): EventBuilder => {
    let e = events.get(key);
    if (!e) {
      e = { ...seed, placements: new Set() };
      events.set(key, e);
    }
    return e;
  };

  // ELGA: one team_block, one duration-3 placement per ELGA day.
  const elgaDays = new Set<number>();

  for (let day = 0; day < 6; day++) {
    for (let period = 0; period < 8; period++) {
      // gather this slot's cells across classes
      const here: { className: string; cell: ParsedCell }[] = [];
      for (const className of input.classOrder) {
        const cell = parseCell(input.grid[className]?.[day]?.[period] ?? "", input.elgaTeam);
        if (cell) here.push({ className, cell });
      }
      // qualifications + subject/teacher/requirement tallies from every cell
      for (const { className, cell } of here) {
        subjectNames.add(cell.subject);
        for (const t of cell.teachers) {
          teacherNames.add(t);
          quals.add(`${t}#${cell.subject}#${className}`);
        }
        if (cell.type !== "free") {
          const rk = `${className}#${cell.subject}`;
          const r = reqCount.get(rk) ?? { className, subject: cell.subject, teachers: new Set<string>(), n: 0 };
          r.n += 1;
          for (const t of cell.teachers) r.teachers.add(t);
          reqCount.set(rk, r);
        }
      }
      // group non-ELGA by (subject, teachers) to find joint placements
      const groups = new Map<string, { className: string; cell: ParsedCell }[]>();
      for (const row of here) {
        if (row.cell.type === "team_block") {
          elgaDays.add(day);
          continue;
        }
        const gk = `${row.cell.subject}|${row.cell.teachers.join(",")}|${row.cell.type}`;
        (groups.get(gk) ?? groups.set(gk, []).get(gk)!).push(row);
      }
      for (const members of groups.values()) {
        const { subject, teachers, type } = members[0]!.cell;
        if (members.length > 1 && type === "normal") {
          const classes = members.map((m) => m.className).sort();
          const key = `joint:${subject}:${teachers.join(",")}:${classes.join("+")}`;
          const e = getEvent(key, {
            id: key,
            type: "joint_class",
            subject,
            classes: new Set(classes),
            teachers,
            duration: 1,
            pinned: true,
          });
          e.placements.add(`${day}#${period}`);
        } else {
          for (const { className } of members) {
            const key = `${type}:${subject}:${teachers.join(",")}:${className}`;
            const e = getEvent(key, {
              id: key,
              type,
              subject,
              classes: new Set([className]),
              teachers,
              duration: 1,
              pinned: false,
            });
            e.placements.add(`${day}#${period}`);
          }
        }
      }
    }
  }

  // ELGA event + one duration-3 placement per ELGA day (start = P3).
  const ELGA_START_PERIOD = 2; // P3 (0-based)
  const elga = getEvent("ELGA", {
    id: "ELGA",
    type: "team_block",
    subject: "ELGA",
    classes: new Set(input.classOrder.filter((c) => bandOf(c) === "primary")),
    teachers: input.elgaTeam,
    duration: 3,
    pinned: true,
  });
  for (const day of elgaDays) elga.placements.add(`${day}#${ELGA_START_PERIOD}`);

  // --- materialize entities ---
  const classes: SchoolClass[] = input.classOrder.map((name) => {
    const m = input.classMeta[name] ?? { band: bandOf(name) };
    return {
      id: name,
      name,
      band: m.band ?? bandOf(name),
      ...(m.stream ? { stream: m.stream } : {}),
      ...(m.isBoardClass ? { isBoardClass: true } : {}),
    };
  });

  const classBand = new Map(classes.map((c) => [c.id, c.band]));
  const subjects: Subject[] = [...subjectNames].sort().map((name) => {
    const bands = new Set<Band>();
    for (const [cls, sub] of [...reqCount.values()].map((r) => [r.className, r.subject] as const)) {
      if (sub === name) bands.add(classBand.get(cls)!);
    }
    return {
      id: name,
      name,
      bands: [...bands],
      kind: input.subjectKind[name] ?? "academic",
    };
  });

  const teachers: Teacher[] = [...teacherNames].sort().map((name) => {
    const m = input.teacherMeta[name] ?? {};
    const unavailable = (m.unavailablePeriods ?? []).flatMap((p) => {
      const idx = ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8"].indexOf(p);
      const slot = periodToSlot[idx];
      return slot === undefined ? [] : (["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const).map((day) => ({ day, slot }));
    });
    return {
      id: name,
      name,
      maxPerDay: m.maxPerDay ?? 8,
      maxPerWeek: m.maxPerWeek ?? 48,
      schedulable: m.schedulable ?? true,
      unavailable,
    };
  });

  const qualifications: Qualification[] = [...quals].map((q) => {
    const [teacherId, subjectId, classId] = q.split("#");
    return { teacherId: teacherId!, subjectId: subjectId!, classId: classId! };
  });

  const requirements: Requirement[] = [...reqCount.values()].map((r, i) => ({
    id: `req-${i}`,
    classId: r.className,
    subjectId: r.subject,
    teacherIds: [...r.teachers],
    periodsPerWeek: r.n,
  }));

  const evList = [...events.values()].filter((e) => e.placements.size > 0);
  const timetableEvents: TimetableEvent[] = evList.map((e) => ({
    id: e.id,
    type: e.type,
    subjectId: e.subject,
    classIds: [...e.classes],
    teacherIds: e.teachers,
    duration: e.duration,
    source: "imported",
  }));

  const placements = evList.flatMap((e) =>
    [...e.placements].map((p) => {
      const [d, per] = p.split("#").map(Number);
      return { eventId: e.id, day: (["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const)[d!]!, slot: periodToSlot[per!]!, pinned: e.pinned };
    }),
  );

  return {
    schemaVersion: 6,
    bundledDataVersion: input.bundledDataVersion,
    school: { name: input.schoolName },
    profiles,
    teachers,
    classes,
    subjects,
    rooms: [],
    qualifications,
    requirements,
    events: timetableEvents,
    constraints: [],
    timetables: [{ id: "tt-real", name: "2026-27", profileId: regular.id, placements }],
    activeTimetableId: "tt-real",
  };
}
