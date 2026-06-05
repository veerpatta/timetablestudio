import { useMemo } from "react";
import { useProjectStore } from "../../store/projectStore";
import { quotaStatus, type QuotaStatus } from "../../domain/validate";
import { scoreTimetable, DEFAULT_WEIGHTS } from "../../solver/score";
import { deriveMaps, type DerivedMaps } from "../../domain/derive";
import type { Project, Timetable, Violation } from "../../domain/types";

export interface Derived {
  project: Project;
  timetable: Timetable;
  /** Hard (clashes) + soft (suggestions). Grids ring hard red, soft amber. */
  violations: Violation[];
  maps: DerivedMaps;
  quota: QuotaStatus[];
}

/** Memoized derived data for the active timetable. Recomputes when the
 * project identity changes (every commit creates a new project object). */
export function useDerived(): Derived | null {
  const project = useProjectStore((s) => s.project);
  return useMemo(() => {
    if (!project) return null;
    const timetable = project.timetables.find((t) => t.id === project.activeTimetableId);
    if (!timetable) return null;
    // Soft list is independent of weights (weights only scale the score number),
    // so default weights are fine for display.
    const { violations } = scoreTimetable(project, timetable, DEFAULT_WEIGHTS);
    return {
      project,
      timetable,
      violations,
      maps: deriveMaps(project, timetable),
      quota: quotaStatus(project, timetable),
    };
  }, [project]);
}
