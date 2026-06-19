import { diffProjects, type CellDiff } from "../domain/diffTimetables";
import { constraintSentence, evaluateConstraints } from "../domain/constraints";
import { validate } from "../domain/validate";
import type { Constraint, Id, Project, Timetable } from "../domain/types";
import { generate, type GenerateResult } from "./generate";

export type RequestStatus = "satisfied" | "blocked";

export interface PlannerRequestStatus {
  constraintId: Id;
  sentence: string;
  severity: Constraint["severity"];
  status: RequestStatus;
  messages: string[];
}

export interface PlanResult extends GenerateResult {
  changes: CellDiff[];
  hardCount: number;
  softCount: number;
  improvedRequests: number;
  blockedRequests: number;
  requestStatuses: PlannerRequestStatus[];
}

function activeTable(project: Project, timetableId: Id): Timetable | undefined {
  return project.timetables.find((t) => t.id === timetableId);
}

function canPlannerRemove(project: Project, placementEventId: Id): boolean {
  const event = project.events.find((e) => e.id === placementEventId);
  return !!event && event.type === "normal" && event.classIds.length === 1 && event.duration === 1;
}

function planningBase(project: Project, timetableId: Id): Project {
  return {
    ...project,
    timetables: project.timetables.map((tt) =>
      tt.id !== timetableId
        ? tt
        : {
            ...tt,
            placements: tt.placements.filter((p) => p.pinned || !canPlannerRemove(project, p.eventId)),
          },
    ),
  };
}

function requestStatuses(project: Project, timetable: Timetable): PlannerRequestStatus[] {
  const violations = evaluateConstraints(project, timetable);
  return project.constraints
    .filter((c) => c.enabled)
    .map((c) => {
      const messages = violations.filter((v) => v.constraintId === c.template).map((v) => v.message);
      return {
        constraintId: c.id,
        sentence: constraintSentence(project, c),
        severity: c.severity,
        status: messages.length === 0 ? "satisfied" : "blocked",
        messages,
      };
    });
}

function lockedBlockers(project: Project, timetable: Timetable): string[] {
  const pinnedIds = new Set(timetable.placements.filter((p) => p.pinned).map((p) => p.eventId));
  if (pinnedIds.size === 0) return [];
  const hard = validate(project, timetable).filter((v) => v.severity === "hard");
  return hard.some((v) => v.slots.some((s) => s.eventId && pinnedIds.has(s.eventId)) || v.constraintId !== "HE1")
    ? ["One or more locked lessons prevent a strict request from being fully met. Unlock those lessons or relax the request."]
    : [];
}

export function planTimetable(project: Project, timetableId: Id, opts?: { seeds?: number }): PlanResult {
  const base = planningBase(project, timetableId);
  const generated = generate(base, timetableId, { seeds: opts?.seeds ?? 32 });
  const timetable = activeTable(generated.project, timetableId);
  const hard = timetable ? validate(generated.project, timetable).filter((v) => v.severity === "hard") : [];
  const soft = timetable ? validate(generated.project, timetable).filter((v) => v.severity === "soft") : [];
  const statuses = timetable ? requestStatuses(generated.project, timetable) : [];
  const blockers = new Set([...generated.blockers, ...(timetable ? lockedBlockers(generated.project, timetable) : [])]);
  for (const status of statuses) {
    if (status.severity === "must" && status.status === "blocked") {
      for (const message of status.messages) blockers.add(message);
    }
  }

  return {
    ...generated,
    blockers: [...blockers],
    changes: diffProjects(project, generated.project),
    hardCount: hard.length,
    softCount: soft.length,
    improvedRequests: statuses.filter((s) => s.status === "satisfied").length,
    blockedRequests: statuses.filter((s) => s.status === "blocked").length,
    requestStatuses: statuses,
  };
}
