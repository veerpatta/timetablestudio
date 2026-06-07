// Small synthetic v6 project for unit tests (clearly NOT real school data).
// Covers the three structural cases the event model must get right: an ELGA
// team_block (5 classes × 5 teachers), a senior joint_class (3 classes × 1
// teacher), and ordinary normal lessons used to provoke real clashes.

import { buildRegularProfile, REGULAR_PROFILE_ID } from "../domain/profile";
import type {
  Project,
  Qualification,
  SchoolClass,
  Subject,
  Teacher,
  TimetableEvent,
} from "../domain/types";

const teacher = (id: string, name: string, over: Partial<Teacher> = {}): Teacher => ({
  id,
  name,
  maxPerDay: 8,
  maxPerWeek: 48,
  schedulable: true,
  unavailable: [],
  ...over,
});

const subject = (id: string, name: string, kind: Subject["kind"] = "academic"): Subject => ({
  id,
  name,
  bands: ["primary", "middle", "secondary", "senior"],
  kind,
});

const PRIMARY = ["c1", "c2", "c3", "c4", "c5"];
const PRIMARY_TEAM = ["bindu", "anita", "rashmita", "kusum", "ravina"];
const SENIOR11 = ["s11sci", "s11com", "s11arts"];

const classes: SchoolClass[] = [
  ...PRIMARY.map((id, i): SchoolClass => ({ id, name: `Class ${i + 1}`, band: "primary" })),
  { id: "s11sci", name: "Class 11 Science", band: "senior", stream: "Science" },
  { id: "s11com", name: "Class 11 Commerce", band: "senior", stream: "Commerce" },
  { id: "s11arts", name: "Class 11 Arts", band: "senior", stream: "Arts" },
];

const teachers: Teacher[] = [
  ...PRIMARY_TEAM.map((id) => teacher(id, id[0]!.toUpperCase() + id.slice(1))),
  teacher("pEng", "Pradhyuman"),
  teacher("mMaths", "Nidhika"),
];

const subjects: Subject[] = [
  subject("ELGA", "ELGA"),
  subject("Eng", "English"),
  subject("Maths", "Maths"),
];

function buildQualifications(): Qualification[] {
  const q: Qualification[] = [];
  // ELGA: every primary teacher qualified for every primary class (team block).
  for (const teacherId of PRIMARY_TEAM)
    for (const classId of PRIMARY) q.push({ teacherId, subjectId: "ELGA", classId });
  // English: Pradhyuman teaches all senior streams.
  for (const classId of SENIOR11) q.push({ teacherId: "pEng", subjectId: "Eng", classId });
  // Maths: Nidhika teaches Class 1 (used for the real-clash test).
  q.push({ teacherId: "mMaths", subjectId: "Maths", classId: "c1" });
  q.push({ teacherId: "mMaths", subjectId: "Maths", classId: "c2" });
  return q;
}

const events: TimetableEvent[] = [
  {
    id: "evt-elga",
    type: "team_block",
    subjectId: "ELGA",
    classIds: [...PRIMARY],
    teacherIds: [...PRIMARY_TEAM],
    duration: 3,
    source: "imported",
  },
  {
    id: "evt-eng11",
    type: "joint_class",
    subjectId: "Eng",
    classIds: [...SENIOR11],
    teacherIds: ["pEng"],
    duration: 1,
    source: "imported",
  },
  // Two separate normal Maths lessons by the same teacher — used to provoke HE1.
  {
    id: "evt-maths-c1",
    type: "normal",
    subjectId: "Maths",
    classIds: ["c1"],
    teacherIds: ["mMaths"],
    duration: 1,
    source: "imported",
  },
  {
    id: "evt-maths-c2",
    type: "normal",
    subjectId: "Maths",
    classIds: ["c2"],
    teacherIds: ["mMaths"],
    duration: 1,
    source: "imported",
  },
];

/** A minimal v6 project with the regular 8-period profile and one empty timetable.
 * Returns a fresh deep copy each call so tests can mutate it in isolation. */
export function makeMiniSchool(): Project {
  return structuredClone({
    schemaVersion: 6,
    bundledDataVersion: 0,
    school: { name: "Synthetic Test School" },
    profiles: [buildRegularProfile()],
    teachers,
    classes,
    subjects,
    rooms: [],
    qualifications: buildQualifications(),
    requirements: [],
    events,
    rules: [],
    constraints: [],
    timetables: [{ id: "tt", name: "Draft", profileId: REGULAR_PROFILE_ID, placements: [] }],
    activeTimetableId: "tt",
  }) as Project;
}
