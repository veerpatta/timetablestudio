// Demo school builder — a faithful, clearly-SYNTHETIC 6-day VPPS dataset using
// the real roster/classes/subjects from docs/SCHOOL_CONTEXT.md. NOT real
// timetable data (no real rawData snapshot exists in this repo — see HANDOFF).
//
// Returns an UNSOLVED project: entities + per-class quotas + the ELGA block
// pinned on its days, with NO lesson placements. `scripts/buildDemoFixture.ts`
// solves it once (deterministically) at build time and commits the result as
// `vpps.demo.ttproj.json`, which the app loads for "Explore demo".
//
// Quotas are intentionally moderate (free periods left), which is both realistic
// and keeps the build-time solve easy. Synthetic assumptions (ELGA on Mon+Thu,
// senior stream subjects/teachers) are owner-confirmable — tracked in HANDOFF.

import type { Day, Project, SchoolClass } from "../domain/types";
import { buildProject, type BuildInput, type QuotaInput, type TeacherInput } from "../domain/projectBuilder";

const PRIMARY_TEACHERS = ["Bindu", "Anita", "Rashmita", "Kusum", "Ravina"];
const ELGA_DAYS: Day[] = ["Mon", "Thu"];
const ELGA_START = 3;
const ELGA_LEN = 3;

// One requirement row: class needs `pw` periods/week of `subject` from `teacher`.
interface Spec {
  cls: string;
  subject: string;
  teacher: string;
  pw: number;
}

// classTeacher = the primary teacher who also runs that class's ELGA level.
const PRIMARY = [
  { cls: "Class 1", classTeacher: "Bindu" },
  { cls: "Class 2", classTeacher: "Anita" },
  { cls: "Class 3", classTeacher: "Rashmita" },
  { cls: "Class 4", classTeacher: "Kusum" },
  { cls: "Class 5", classTeacher: "Ravina" },
];

const MIDDLE = ["Class 6", "Class 7", "Class 8", "Class 9", "Class 10"];

const SENIOR: { cls: string; subjects: { subject: string; teacher: string }[] }[] = [
  {
    cls: "Class 11 Science",
    subjects: [
      { subject: "Physics", teacher: "Pradhyuman" },
      { subject: "Chemistry", teacher: "Prakash" },
      { subject: "Biology", teacher: "Jainendra" },
      { subject: "Maths", teacher: "Rakesh" },
    ],
  },
  {
    cls: "Class 12 Science",
    subjects: [
      { subject: "Physics", teacher: "Pradhyuman" },
      { subject: "Chemistry", teacher: "Prakash" },
      { subject: "Biology", teacher: "Jainendra" },
      { subject: "Maths", teacher: "Rakesh" },
    ],
  },
  {
    cls: "Class 11 Commerce",
    subjects: [
      { subject: "Accountancy", teacher: "Nathulal" },
      { subject: "Business Studies", teacher: "Nathulal" },
      { subject: "Economics", teacher: "Pradhyuman" },
      { subject: "English", teacher: "Hemlata" },
    ],
  },
  {
    cls: "Class 12 Commerce",
    subjects: [
      { subject: "Accountancy", teacher: "Nathulal" },
      { subject: "Business Studies", teacher: "Nathulal" },
      { subject: "Economics", teacher: "Pradhyuman" },
      { subject: "English", teacher: "Hemlata" },
    ],
  },
  {
    cls: "Class 11 Arts",
    subjects: [
      { subject: "History", teacher: "Jainendra" },
      { subject: "Political Science", teacher: "Prakash" },
      { subject: "Economics", teacher: "Rakesh" },
      { subject: "English", teacher: "Hemlata" },
    ],
  },
  {
    cls: "Class 12 Arts",
    subjects: [
      { subject: "History", teacher: "Jainendra" },
      { subject: "Political Science", teacher: "Prakash" },
      { subject: "Economics", teacher: "Rakesh" },
      { subject: "English", teacher: "Hemlata" },
    ],
  },
];

function buildSpecs(): Spec[] {
  const specs: Spec[] = [];
  // Primary (ELGA handled separately as a block): Maths 5, EVS 3 by class teacher;
  // English 4 (Antima), Hindi 5 (Maya), English Revision 1 (Hemlata).
  for (const p of PRIMARY) {
    specs.push({ cls: p.cls, subject: "Maths", teacher: p.classTeacher, pw: 5 });
    specs.push({ cls: p.cls, subject: "EVS", teacher: p.classTeacher, pw: 3 });
    specs.push({ cls: p.cls, subject: "English", teacher: "Antima", pw: 4 });
    specs.push({ cls: p.cls, subject: "Hindi", teacher: "Maya", pw: 5 });
    specs.push({ cls: p.cls, subject: "English Revision", teacher: "Hemlata", pw: 1 });
  }
  // Middle: English 5 (Harshita), Hindi 4 (Anjana), Maths 5 (Nidhika),
  // Science 4 (Mahesh), Social Science 4 (Toshit).
  for (const cls of MIDDLE) {
    specs.push({ cls, subject: "English", teacher: "Harshita", pw: 5 });
    specs.push({ cls, subject: "Hindi", teacher: "Anjana", pw: 4 });
    specs.push({ cls, subject: "Maths", teacher: "Nidhika", pw: 5 });
    specs.push({ cls, subject: "Science", teacher: "Mahesh", pw: 4 });
    specs.push({ cls, subject: "Social Science", teacher: "Toshit", pw: 4 });
  }
  // Senior: 4 stream subjects × 5 periods.
  for (const s of SENIOR) {
    for (const sub of s.subjects) {
      specs.push({ cls: s.cls, subject: sub.subject, teacher: sub.teacher, pw: 5 });
    }
  }
  return specs;
}

function group(name: string): SchoolClass["group"] {
  const m = name.match(/(\d+)/);
  const n = m ? parseInt(m[1]!, 10) : NaN;
  if (n >= 1 && n <= 5) return "primary";
  if (n >= 11) return "senior";
  return "middle";
}

/** Build the unsolved demo project (entities + quotas + pinned ELGA, no lessons placed). */
export function buildDemoSchool(): Project {
  const specs = buildSpecs();
  const classNames = [...PRIMARY.map((p) => p.cls), ...MIDDLE, ...SENIOR.map((s) => s.cls)];

  // teacher → subjects (primary five also teach ELGA)
  const teacherSubjects = new Map<string, Set<string>>();
  for (const t of PRIMARY_TEACHERS) teacherSubjects.set(t, new Set(["ELGA"]));
  for (const s of specs) {
    const set = teacherSubjects.get(s.teacher) ?? new Set<string>();
    set.add(s.subject);
    teacherSubjects.set(s.teacher, set);
  }
  const teachers: TeacherInput[] = [...teacherSubjects.keys()]
    .sort()
    .map((name) => ({ name, subjects: [...teacherSubjects.get(name)!] }));
  const quotas: QuotaInput[] = specs.map((s) => ({
    className: s.cls,
    subject: s.subject,
    teacher: s.teacher,
    periodsPerWeek: s.pw,
  }));

  const input: BuildInput = {
    schoolName: "VPPS — Demo",
    profileName: "Heatwave",
    days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    periods: 6,
    classes: classNames.map((name) => ({ name, group: group(name) })),
    teachers,
    quotas,
    block: {
      name: "ELGA",
      classNames: PRIMARY.map((p) => p.cls),
      teachers: [...PRIMARY_TEACHERS],
      length: ELGA_LEN,
      days: ELGA_DAYS,
      startPeriod: ELGA_START,
    },
  };
  return buildProject(input);
}
