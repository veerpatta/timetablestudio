import { diffProjects, type CellDiff } from "../domain/diffTimetables";
import { constraintSentence, evaluateConstraints } from "../domain/constraints";
import { findProfile, placementSlots } from "../domain/derive";
import { validate } from "../domain/validate";
import type { Constraint, Id, Placement, Project, Timetable } from "../domain/types";
import { generate, type GenerateResult } from "./generate";
import { isReschedulable } from "./schedule";

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

// "Make best timetable" used to NUKE the whole board (strip every reschedulable lesson) then
// rebuild from scratch — which threw away a complete, valid timetable and could only ever get
// back ~98% of it, so a re-plan visibly DEGRADED a good timetable. The smarter rule: keep every
// valid placement (preserving completeness) and strip ONLY the ordinary lessons that are
// actually causing a HARD violation, so solve() can re-place those correctly. On an
// already-valid board nothing is stripped and the timetable is returned intact. Pinned and
// structural events (joint/team/electives/self_study — `isReschedulable === false`) never move,
// so a strict request that conflicts with a locked lesson is reported as a blocker, not forced.
function planningBase(project: Project, timetableId: Id): Project {
  const tt = activeTable(project, timetableId);
  const profile = tt && findProfile(project, tt);
  if (!tt || !profile) return project;

  // (day#slot) cells flagged by any hard violation, with the class/teacher/event they implicate.
  const hard = validate(project, tt).filter((v) => v.severity === "hard");
  const flaggedClass = new Set<string>(); // `${classId} ${day}#${slot}`
  const flaggedTeacher = new Set<string>(); // `${teacherId} ${day}#${slot}`
  const flaggedEvent = new Set<string>(); // `${eventId} ${day}#${slot}`
  for (const v of hard) {
    for (const s of v.slots) {
      const dk = `${s.day}#${s.slot}`;
      if (s.classId) flaggedClass.add(`${s.classId} ${dk}`);
      if (s.teacherId) flaggedTeacher.add(`${s.teacherId} ${dk}`);
      if (s.eventId) flaggedEvent.add(`${s.eventId} ${dk}`);
    }
  }
  const eventIndex = new Map(project.events.map((e) => [e.id, e]));
  const inHardViolation = (p: Placement): boolean => {
    const ev = eventIndex.get(p.eventId);
    if (!ev) return false;
    const slots = placementSlots(profile, p, ev);
    if (!slots) return false;
    return slots.some((slot) => {
      const dk = `${p.day}#${slot}`;
      if (flaggedEvent.has(`${ev.id} ${dk}`)) return true;
      if (ev.teacherIds.some((t) => flaggedTeacher.has(`${t} ${dk}`))) return true;
      return ev.classIds.some((c) => flaggedClass.has(`${c} ${dk}`));
    });
  };

  return {
    ...project,
    timetables: project.timetables.map((t) =>
      t.id !== timetableId
        ? t
        : { ...t, placements: t.placements.filter((p) => p.pinned || !isReschedulable(project, p.eventId) || !inHardViolation(p)) },
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

export function planTimetable(project: Project, timetableId: Id, opts?: { seeds?: number; budgetMs?: number }): PlanResult {
  const base = planningBase(project, timetableId);
  const generated = generate(base, timetableId, { seeds: opts?.seeds ?? 12, budgetMs: opts?.budgetMs });
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
