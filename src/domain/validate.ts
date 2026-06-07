// Shared validation core (PURE) — used by BOTH the editor (live badges) and the
// solver (feasibility oracle). One implementation, never duplicated (AGENTS §3).
//
// Implements the event-model hard constraints HE1–HE7 (docs/CONSTRAINTS.md):
//   HE1 teacher clash, HE2 class clash, HE3 qualification, HE4 availability,
//   HE5 fixed-slot, HE6 event integrity, HE7 duration fit.
// HE8 (pinned immovable) is a solver-time invariant with no static representation
// (enforced in solver/, RB5). Configurable rules join here in RB6.
//
// THE clash rule: a (entity, day, slot) collision is a real clash ONLY when the
// occupancies come from DIFFERENT eventIds. Same-event overlap (joint_class's many
// classes, team_block's many teachers) is legal by construction.

import { evaluateConstraints } from "./constraints";
import { distinctEventIds, deriveMaps, findProfile, type DerivedMaps } from "./derive";
import { isTeachingSlot, occupiedSlots, slotLabel } from "./profile";
import { evaluateRules } from "./rules";
import type {
  Day,
  Id,
  Profile,
  Project,
  SchoolClass,
  Subject,
  Teacher,
  Timetable,
  TimetableEvent,
  Violation,
} from "./types";

interface Lookups {
  teacher: Map<Id, Teacher>;
  klass: Map<Id, SchoolClass>;
  subject: Map<Id, Subject>;
  /** `${teacherId}#${subjectId}#${classId}` set of allowed qualification triples. */
  quals: Set<string>;
}

function buildLookups(project: Project): Lookups {
  const teacher = new Map<Id, Teacher>();
  for (const t of project.teachers) teacher.set(t.id, t);
  const klass = new Map<Id, SchoolClass>();
  for (const c of project.classes) klass.set(c.id, c);
  const subject = new Map<Id, Subject>();
  for (const s of project.subjects) subject.set(s.id, s);
  const quals = new Set<string>();
  for (const q of project.qualifications) quals.add(`${q.teacherId}#${q.subjectId}#${q.classId}`);
  return { teacher, klass, subject, quals };
}

const tName = (l: Lookups, id: Id) => l.teacher.get(id)?.name ?? id;
const cName = (l: Lookups, id: Id) => l.klass.get(id)?.name ?? id;
const sName = (l: Lookups, id: Id) => l.subject.get(id)?.name ?? id;
const at = (p: Profile, day: Day, slot: number) => `${day} ${slotLabel(p, slot)}`;

// --- HE1 / HE2: clash = >1 distinct eventId in one slot ---
function checkClashes(
  maps: DerivedMaps,
  look: Lookups,
  profile: Profile,
): Violation[] {
  const out: Violation[] = [];
  for (const [teacherId, slots] of maps.teacherCells) {
    for (const occ of slots.values()) {
      const ids = distinctEventIds(occ);
      if (ids.length > 1) {
        const { day, slot } = occ[0]!;
        out.push({
          constraintId: "HE1",
          severity: "hard",
          message: `${tName(look, teacherId)} is double-booked at ${at(profile, day, slot)} (${ids.length} different lessons).`,
          slots: [{ teacherId, day, slot }],
        });
      }
    }
  }
  for (const [classId, slots] of maps.classCells) {
    for (const occ of slots.values()) {
      const ids = distinctEventIds(occ);
      if (ids.length > 1) {
        const { day, slot } = occ[0]!;
        out.push({
          constraintId: "HE2",
          severity: "hard",
          message: `${cName(look, classId)} has ${ids.length} different lessons at ${at(profile, day, slot)}.`,
          slots: [{ classId, day, slot }],
        });
      }
    }
  }
  return out;
}

// --- HE3: qualification — every (teacher, subject, class) used must be a triple ---
function checkQualified(
  timetable: Timetable,
  maps: DerivedMaps,
  look: Lookups,
  profile: Profile,
): Violation[] {
  const out: Violation[] = [];
  for (const placement of timetable.placements) {
    const event = maps.eventIndex.get(placement.eventId);
    if (!event || event.teacherIds.length === 0) continue; // free/self-study: nobody to qualify
    for (const teacherId of event.teacherIds) {
      for (const classId of event.classIds) {
        if (!look.quals.has(`${teacherId}#${event.subjectId}#${classId}`)) {
          out.push({
            constraintId: "HE3",
            severity: "hard",
            message: `${tName(look, teacherId)} is not qualified to teach ${sName(look, event.subjectId)} to ${cName(look, classId)} (${at(profile, placement.day, placement.slot)}).`,
            slots: [{ classId, teacherId, eventId: event.id, day: placement.day, slot: placement.slot }],
          });
        }
      }
    }
  }
  return out;
}

// --- HE4: availability — no teacher in an unavailable slot; non-schedulable never placed ---
function checkAvailability(maps: DerivedMaps, look: Lookups, profile: Profile): Violation[] {
  const out: Violation[] = [];
  for (const [teacherId, slots] of maps.teacherCells) {
    const teacher = look.teacher.get(teacherId);
    if (!teacher) continue;
    const blocked = new Set(teacher.unavailable.map((u) => `${u.day}#${u.slot}`));
    for (const occ of slots.values()) {
      const { day, slot } = occ[0]!;
      if (!teacher.schedulable) {
        out.push({
          constraintId: "HE4",
          severity: "hard",
          message: `${teacher.name} is not a schedulable teacher but is placed at ${at(profile, day, slot)}.`,
          slots: [{ teacherId, day, slot }],
        });
      } else if (blocked.has(`${day}#${slot}`)) {
        out.push({
          constraintId: "HE4",
          severity: "hard",
          message: `${teacher.name} is scheduled at ${at(profile, day, slot)} but is unavailable then.`,
          slots: [{ teacherId, day, slot }],
        });
      }
    }
  }
  return out;
}

// --- HE5 (fixed slot) + HE7 (duration fit): every placement lands on teaching
// slots and fits the day. A start on Assembly/Recess is HE5; an overflow is HE7. ---
function checkPlacementBounds(
  timetable: Timetable,
  maps: DerivedMaps,
  look: Lookups,
  profile: Profile,
): Violation[] {
  const out: Violation[] = [];
  for (const placement of timetable.placements) {
    const event = maps.eventIndex.get(placement.eventId);
    if (!event) continue;
    if (!isTeachingSlot(profile, placement.slot)) {
      out.push({
        constraintId: "HE5",
        severity: "hard",
        message: `${sName(look, event.subjectId)} is placed on ${at(profile, placement.day, placement.slot)}, which is not a teaching period.`,
        slots: [{ eventId: event.id, day: placement.day, slot: placement.slot }],
      });
      continue;
    }
    if (occupiedSlots(profile, placement.slot, event.duration) === null) {
      out.push({
        constraintId: "HE7",
        severity: "hard",
        message: `${sName(look, event.subjectId)} at ${at(profile, placement.day, placement.slot)} runs past the end of the day (${event.duration} periods don't fit).`,
        slots: [{ eventId: event.id, day: placement.day, slot: placement.slot }],
      });
    }
  }
  return out;
}

// --- HE6: event integrity — joint/team/normal events are well-formed ---
function checkEventIntegrity(project: Project, look: Lookups): Violation[] {
  const out: Violation[] = [];
  const bad = (e: TimetableEvent, why: string): Violation => ({
    constraintId: "HE6",
    severity: "hard",
    message: `${sName(look, e.subjectId)} event (${e.type}) is malformed: ${why}.`,
    slots: [{ eventId: e.id, day: "Mon", slot: 0 }],
  });
  for (const e of project.events) {
    if (e.type === "normal" && e.classIds.length !== 1) {
      out.push(bad(e, "a normal lesson must have exactly one class"));
    } else if (e.type === "joint_class" && (e.classIds.length < 2 || e.teacherIds.length < 1)) {
      out.push(bad(e, "a joint class needs ≥2 classes and a teacher"));
    } else if (e.type === "team_block" && (e.classIds.length < 2 || e.teacherIds.length < 2)) {
      out.push(bad(e, "a team block needs ≥2 classes and ≥2 teachers"));
    } else if (e.classIds.length === 0) {
      out.push(bad(e, "an event must have at least one class"));
    }
  }
  return out;
}

/** Run all implemented event-model hard constraints. Pure; sorted for stability. */
export function validate(project: Project, timetable: Timetable): Violation[] {
  const profile = findProfile(project, timetable);
  if (!profile) {
    return [
      {
        constraintId: "HE0",
        severity: "hard",
        message: `Timetable "${timetable.name}" references an unknown profile.`,
        slots: [],
      },
    ];
  }
  const look = buildLookups(project);
  const maps = deriveMaps(project, timetable);
  const violations: Violation[] = [
    ...checkClashes(maps, look, profile),
    ...checkQualified(timetable, maps, look, profile),
    ...checkAvailability(maps, look, profile),
    ...checkPlacementBounds(timetable, maps, look, profile),
    ...checkEventIntegrity(project, look),
    ...evaluateRules(project, timetable), // DEPRECATED R1–R15 (RB6) — parallel until C4
    ...evaluateConstraints(project, timetable), // v6.1 applied constraints (C3): must→hard, prefer→soft
  ];
  violations.sort((a, b) => a.constraintId.localeCompare(b.constraintId));
  return violations;
}
