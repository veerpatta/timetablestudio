import { useMemo } from "react";
import { useProjectStore } from "../../store/projectStore";
import { validate, quotaStatus, type QuotaStatus } from "../../domain/validate";
import { deriveMaps, type DerivedMaps } from "../../domain/derive";
import type { Project, Timetable, Violation } from "../../domain/types";

export interface Derived {
  project: Project;
  timetable: Timetable;
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
    return {
      project,
      timetable,
      violations: validate(project, timetable),
      maps: deriveMaps(project, timetable),
      quota: quotaStatus(project, timetable),
    };
  }, [project]);
}
