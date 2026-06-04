// Derive CurriculumRequirements (and canonical Lesson activities) from an
// existing timetable. PURE. Each requirement becomes ONE Lesson activity placed
// `periodsPerWeek` times — placements may repeat an activityId (like the ELGA
// block across two days), so we don't need a distinct activity per period.
//
// Used to normalize the imported sample (which has one ad-hoc lesson per cell)
// into a requirement-driven project the solver can complete/generate against.

import type {
  Activity,
  BlockRequirement,
  CurriculumRequirement,
  Day,
  Id,
  Lesson,
  Placement,
  Project,
} from "./types";

export interface DerivedRequirements {
  activities: Activity[]; // canonical lessons + original blocks
  placements: Placement[]; // normalized, references canonical activities
  curriculum: CurriculumRequirement[];
  blocks: BlockRequirement[];
}

const teachersKey = (ids: Id[]): string => [...ids].sort().join("+");
const lessonId = (classId: Id, subjectId: Id, ids: Id[]): Id =>
  `lesson:${classId}|${subjectId}|${teachersKey(ids)}`;

export function deriveRequirements(project: Project, timetableId: Id): DerivedRequirements {
  const timetable = project.timetables.find((t) => t.id === timetableId);
  if (!timetable) throw new Error(`Timetable ${timetableId} not found`);
  const index = new Map(project.activities.map((a) => [a.id, a] as const));

  interface Group {
    classId: Id;
    subjectId: Id;
    teacherIds: Id[]; // first-seen order
    placementDays: Day[]; // for per-day max
    count: number;
  }
  const groups = new Map<Id, Group>();
  const blockPlacements: Placement[] = [];
  const blocks = new Map<Id, BlockRequirement>();

  for (const placement of timetable.placements) {
    const activity = index.get(placement.activityId);
    if (!activity) continue;
    if (activity.kind === "block") {
      blockPlacements.push({ ...placement, pinned: true });
      const req = blocks.get(activity.id) ?? {
        id: `block-req-${activity.id}`,
        blockActivityId: activity.id,
        occurrences: [],
      };
      req.occurrences.push({ day: placement.day, startPeriod: placement.period });
      blocks.set(activity.id, req);
      continue;
    }
    const id = lessonId(activity.classId, activity.subjectId, activity.teacherIds);
    const g = groups.get(id) ?? {
      classId: activity.classId,
      subjectId: activity.subjectId,
      teacherIds: activity.teacherIds,
      placementDays: [],
      count: 0,
    };
    g.count++;
    g.placementDays.push(placement.day);
    groups.set(id, g);
  }

  const canonicalLessons: Lesson[] = [];
  const curriculum: CurriculumRequirement[] = [];
  const lessonPlacements: Placement[] = [];

  for (const [id, g] of groups) {
    const lesson: Lesson = {
      kind: "lesson",
      id,
      classId: g.classId,
      subjectId: g.subjectId,
      teacherIds: g.teacherIds,
    };
    canonicalLessons.push(lesson);

    const perDay = new Map<Day, number>();
    for (const d of g.placementDays) perDay.set(d, (perDay.get(d) ?? 0) + 1);
    const observedMaxPerDay = Math.max(1, ...perDay.values());

    curriculum.push({
      id: `req:${id}`,
      classId: g.classId,
      subjectId: g.subjectId,
      teacherIds: g.teacherIds,
      periodsPerWeek: g.count,
      maxPerDay: Math.max(2, observedMaxPerDay),
    });
  }

  // Re-emit lesson placements pointing at canonical activities, in original order.
  for (const placement of timetable.placements) {
    const activity = index.get(placement.activityId);
    if (!activity || activity.kind !== "lesson") continue;
    lessonPlacements.push({
      activityId: lessonId(activity.classId, activity.subjectId, activity.teacherIds),
      day: placement.day,
      period: placement.period,
      pinned: placement.pinned,
    });
  }

  const blockActivities = project.activities.filter((a) => a.kind === "block");

  return {
    activities: [...blockActivities, ...canonicalLessons],
    placements: [...blockPlacements, ...lessonPlacements],
    curriculum,
    blocks: [...blocks.values()],
  };
}

/** Build a normalized, requirement-driven Project from one of its timetables. */
export function normalizeProject(project: Project, timetableId: Id): Project {
  const d = deriveRequirements(project, timetableId);
  return {
    ...project,
    activities: d.activities,
    requirements: { curriculum: d.curriculum, blocks: d.blocks },
    timetables: project.timetables.map((t) =>
      t.id === timetableId ? { ...t, placements: d.placements } : t,
    ),
  };
}
