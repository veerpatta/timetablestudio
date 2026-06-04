// Pure timetable-edit operations. PURE — no DOM/store. Each returns NEW arrays
// (immutable) so stores can snapshot for undo/redo. A placement is identified by
// its ref (activityId, day, period) — blocks have one placement per day, so the
// ref disambiguates which occurrence is being moved/pinned/removed.

import type { Activity, Day, Id, Placement } from "./types";

export interface PlacementRef {
  activityId: Id;
  day: Day;
  period: number;
}

const sameRef = (p: Placement, ref: PlacementRef): boolean =>
  p.activityId === ref.activityId && p.day === ref.day && p.period === ref.period;

/** Move one placement to a new (day, period). Pinned state is preserved. */
export function movePlacement(
  placements: Placement[],
  ref: PlacementRef,
  toDay: Day,
  toPeriod: number,
): Placement[] {
  return placements.map((p) =>
    sameRef(p, ref) ? { ...p, day: toDay, period: toPeriod } : p,
  );
}

/** Toggle the `pinned` flag of one placement. */
export function togglePin(placements: Placement[], ref: PlacementRef): Placement[] {
  return placements.map((p) => (sameRef(p, ref) ? { ...p, pinned: !p.pinned } : p));
}

/** Remove one placement. Activities are left intact (may be placed elsewhere). */
export function removePlacement(placements: Placement[], ref: PlacementRef): Placement[] {
  return placements.filter((p) => !sameRef(p, ref));
}

/** Add an activity (if new) and place it. Returns updated activities + placements. */
export function addPlacement(
  activities: Activity[],
  placements: Placement[],
  activity: Activity,
  day: Day,
  period: number,
  pinned = false,
): { activities: Activity[]; placements: Placement[] } {
  const activitiesNext = activities.some((a) => a.id === activity.id)
    ? activities
    : [...activities, activity];
  const placementsNext = [...placements, { activityId: activity.id, day, period, pinned }];
  return { activities: activitiesNext, placements: placementsNext };
}
