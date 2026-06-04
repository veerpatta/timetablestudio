// Synthetic test fixtures — NOT real VPPS data (AGENTS.md §2 allows clearly
// marked synthetic fixtures). Ids are readable strings (ids are opaque).
//
// Mirrors the ELGA structure: 5 primary classes regroup under 5 primary
// teachers as one atomic 3-period BlockActivity.

import type {
  BlockActivity,
  Day,
  Lesson,
  Placement,
  Project,
  ScheduleProfile,
} from "../domain/types";

const PRIMARY_TEACHERS = ["Bindu", "Anita", "Rashmita", "Kusum", "Ravina"];
const PRIMARY_CLASSES = ["Class 1", "Class 2", "Class 3", "Class 4", "Class 5"];

export const sixPeriodProfile: ScheduleProfile = {
  id: "heatwave",
  name: "heatwave",
  days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  periods: Array.from({ length: 6 }, (_, i) => ({
    label: `P${i + 1}`,
    start: "00:00",
    end: "00:40",
  })),
};

/** Base project: 5 primary classes + Class 7, ELGA block defined but UNPLACED. */
export function elgaFixture(): Project {
  const classIds = PRIMARY_CLASSES.map((_, i) => `c${i + 1}`);
  const elga: BlockActivity = {
    kind: "block",
    id: "act-elga",
    name: "ELGA",
    classIds,
    teacherIds: [...PRIMARY_TEACHERS],
    length: 3,
  };
  return {
    schemaVersion: 1,
    school: { name: "Synthetic" },
    teachers: [
      ...PRIMARY_TEACHERS.map((name) => ({
        id: name,
        name,
        subjects: ["Maths", "Hindi", "EVS", "English", "ELGA"],
        maxPeriodsPerDay: 6,
        maxPeriodsPerWeek: 36,
        unavailable: [],
      })),
      {
        id: "Nidhika",
        name: "Nidhika",
        subjects: ["Maths"],
        maxPeriodsPerDay: 6,
        maxPeriodsPerWeek: 36,
        unavailable: [],
      },
    ],
    classes: [
      ...PRIMARY_CLASSES.map((name, i) => ({
        id: `c${i + 1}`,
        name,
        group: "primary" as const,
      })),
      { id: "c7", name: "Class 7", group: "middle" as const },
    ],
    subjects: [
      { id: "Maths", name: "Maths" },
      { id: "Hindi", name: "Hindi" },
      { id: "EVS", name: "EVS" },
      { id: "English", name: "English" },
      { id: "ELGA", name: "ELGA" },
    ],
    profiles: [sixPeriodProfile],
    activities: [elga],
    requirements: { curriculum: [], blocks: [] },
    timetables: [
      { id: "tt", name: "Draft", profileId: "heatwave", placements: [] },
    ],
    activeTimetableId: "tt",
  };
}

export function lesson(
  id: string,
  classId: string,
  subjectId: string,
  teacherIds: string[],
): Lesson {
  return { kind: "lesson", id, classId, subjectId, teacherIds };
}

export function place(
  activityId: string,
  day: Day,
  period: number,
  pinned = false,
): Placement {
  return { activityId, day, period, pinned };
}
