// Pure assembly of a Project from high-level inputs (the setup wizard and the
// demo builder both use this — one assembly path). PURE: no DOM/store.
//
// Produces an UNSOLVED project: entities + per-class quotas + an optional block
// pinned on its days, with NO lesson placements. The editor/solver fill lessons.

import type {
  BlockActivity,
  BlockRequirement,
  CurriculumRequirement,
  Day,
  Lesson,
  PeriodDef,
  Placement,
  Project,
  ScheduleProfile,
  SchoolClass,
  Subject,
  Teacher,
} from "./types";

export interface TeacherInput {
  name: string;
  subjects: string[];
  maxPeriodsPerDay?: number;
  maxPeriodsPerWeek?: number;
}

export interface QuotaInput {
  className: string;
  subject: string;
  teacher: string;
  periodsPerWeek: number;
  maxPerDay?: number;
}

export interface BlockInput {
  name: string; // e.g. "ELGA"
  classNames: string[];
  teachers: string[];
  length: number;
  days: Day[];
  startPeriod: number;
}

export interface BuildInput {
  schoolName: string;
  profileName?: string;
  days: Day[];
  periods: number;
  classes: { name: string; group: SchoolClass["group"] }[];
  teachers: TeacherInput[];
  quotas: QuotaInput[];
  block?: BlockInput;
}

export const lessonId = (cls: string, subject: string, teacher: string): string =>
  `lesson:${cls}|${subject}|${teacher}`;

function defaultPeriods(count: number): PeriodDef[] {
  return Array.from({ length: count }, (_, i) => {
    const startMin = 7 * 60 + 30 + i * 40;
    const endMin = startMin + 40;
    const fmt = (m: number) =>
      `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    return { label: `P${i + 1}`, start: fmt(startMin), end: fmt(endMin) };
  });
}

/** Assemble an unsolved Project. Pure & deterministic in input order. */
export function buildProject(input: BuildInput): Project {
  const profile: ScheduleProfile = {
    id: "profile",
    name: input.profileName ?? "Schedule",
    days: input.days,
    periods: defaultPeriods(input.periods),
  };

  const classes: SchoolClass[] = input.classes.map((c) => ({
    id: c.name,
    name: c.name,
    group: c.group,
  }));

  // Subjects = union of teacher subjects + quota subjects + block name (first-seen).
  const subjectOrder: string[] = [];
  const addSubject = (s: string) => {
    if (s && !subjectOrder.includes(s)) subjectOrder.push(s);
  };
  for (const t of input.teachers) t.subjects.forEach(addSubject);
  for (const q of input.quotas) addSubject(q.subject);
  if (input.block) addSubject(input.block.name);
  const subjects: Subject[] = subjectOrder.map((name) => ({ id: name, name }));

  const teachers: Teacher[] = input.teachers.map((t) => ({
    id: t.name,
    name: t.name,
    subjects: [...new Set(t.subjects)],
    maxPeriodsPerDay: t.maxPeriodsPerDay ?? 6,
    maxPeriodsPerWeek: t.maxPeriodsPerWeek ?? 36,
    unavailable: [],
  }));

  const lessons: Lesson[] = input.quotas.map((q) => ({
    kind: "lesson",
    id: lessonId(q.className, q.subject, q.teacher),
    classId: q.className,
    subjectId: q.subject,
    teacherIds: [q.teacher],
  }));
  const curriculum: CurriculumRequirement[] = input.quotas.map((q) => ({
    id: `req:${lessonId(q.className, q.subject, q.teacher)}`,
    classId: q.className,
    subjectId: q.subject,
    teacherIds: [q.teacher],
    periodsPerWeek: q.periodsPerWeek,
    maxPerDay: q.maxPerDay ?? 2,
  }));

  const activities: (Lesson | BlockActivity)[] = [...lessons];
  const blocks: BlockRequirement[] = [];
  const placements: Placement[] = [];

  if (input.block) {
    const block: BlockActivity = {
      kind: "block",
      id: `block-${input.block.name.toLowerCase().replace(/\s+/g, "-")}`,
      name: input.block.name,
      classIds: input.block.classNames,
      teacherIds: input.block.teachers,
      length: input.block.length,
    };
    activities.unshift(block);
    blocks.push({
      id: `block-req-${block.id}`,
      blockActivityId: block.id,
      occurrences: input.block.days.map((day) => ({ day, startPeriod: input.block!.startPeriod })),
    });
    for (const day of input.block.days) {
      placements.push({ activityId: block.id, day, period: input.block.startPeriod, pinned: true });
    }
  }

  return {
    schemaVersion: 2,
    school: { name: input.schoolName },
    teachers,
    classes,
    subjects,
    profiles: [profile],
    activities,
    requirements: { curriculum, blocks },
    rules: [],
    timetables: [{ id: "main", name: "Timetable", profileId: "profile", placements }],
    activeTimetableId: "main",
  };
}
