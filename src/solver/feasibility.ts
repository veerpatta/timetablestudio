import { totalShortfall } from "../domain/coverage";
import { findProfile } from "../domain/derive";
import { occupiedSlots, teachingSlots } from "../domain/profile";
import type { Constraint, Id, Project, Timetable } from "../domain/types";
import { validate } from "../domain/validate";
import type { Blocker, FeasibilityReport } from "./types";

const names = <T extends { id: Id; name: string }>(items: T[]) => new Map(items.map((x) => [x.id, x.name]));

function activeTable(project: Project, timetableId: Id): Timetable | undefined {
  return project.timetables.find((t) => t.id === timetableId);
}

function pushUnique(list: string[], message: string): void {
  if (!list.includes(message)) list.push(message);
}

function addBlocker(blockers: string[], relaxations: string[], structured: Blocker[], b: Blocker): void {
  pushUnique(blockers, b.message);
  pushUnique(relaxations, b.relaxation.message);
  if (!structured.some((x) => x.message === b.message)) structured.push(b);
}

function teacherMaxMusts(project: Project): Extract<Constraint, { template: "teacher_max_per_week" }>[] {
  return project.constraints.filter(
    (c): c is Extract<Constraint, { template: "teacher_max_per_week" }> =>
      c.enabled && c.severity === "must" && c.template === "teacher_max_per_week",
  );
}

export function analyzeFeasibility(project: Project, timetableId: Id): FeasibilityReport {
  const timetable = activeTable(project, timetableId);
  const profile = timetable && findProfile(project, timetable);
  const blockers: string[] = [];
  const relaxationSuggestions: string[] = [];
  const structuredBlockers: Blocker[] = [];

  if (!timetable || !profile) {
    return {
      status: "blocked",
      blockers: ["The active timetable is missing its school-day setup."],
      relaxationSuggestions: ["Open Setup and check the school day before generating."],
      structuredBlockers: [],
    };
  }

  const className = names(project.classes);
  const subjectName = names(project.subjects);
  const teacherName = names(project.teachers);
  const teacherById = new Map(project.teachers.map((t) => [t.id, t]));

  const qualifiedByClassSubject = new Map<string, Id[]>();
  for (const q of project.qualifications) {
    const key = `${q.classId}#${q.subjectId}`;
    const list = qualifiedByClassSubject.get(key) ?? [];
    list.push(q.teacherId);
    qualifiedByClassSubject.set(key, list);
  }

  // Pre-compute sole-qualifier forced demand per teacher (reused by checks 3 and 6).
  // joint_class events teach multiple classes simultaneously — count each such event ONCE,
  // not once per class, to avoid inflating a teacher's apparent forced demand.
  const countedAsJoint = new Set<string>(); // "classId#subjectId" pairs already counted via joint events
  const teacherForcedDemand = new Map<Id, number>();
  for (const event of project.events) {
    if (event.type !== "joint_class" || event.teacherIds.length !== 1) continue;
    const tid = event.teacherIds[0]!;
    const isSole = event.classIds.every((cid) => {
      const q = qualifiedByClassSubject.get(`${cid}#${event.subjectId}`) ?? [];
      return q.length === 1 && q[0] === tid;
    });
    if (!isSole) continue;
    const firstClass = event.classIds[0];
    if (!firstClass) continue;
    const req = project.requirements.find((r) => r.classId === firstClass && r.subjectId === event.subjectId);
    if (!req || req.periodsPerWeek === 0) continue;
    teacherForcedDemand.set(tid, (teacherForcedDemand.get(tid) ?? 0) + req.periodsPerWeek);
    for (const cid of event.classIds) countedAsJoint.add(`${cid}#${event.subjectId}`);
  }
  for (const req of project.requirements) {
    if (countedAsJoint.has(`${req.classId}#${req.subjectId}`)) continue;
    const qualified = qualifiedByClassSubject.get(`${req.classId}#${req.subjectId}`) ?? [];
    if (qualified.length === 1) {
      const tid = qualified[0]!;
      teacherForcedDemand.set(tid, (teacherForcedDemand.get(tid) ?? 0) + req.periodsPerWeek);
    }
  }

  // Check 1 — subject_capacity: no qualified teacher for a (class, subject) requirement.
  const classDemand = new Map<Id, number>();
  for (const req of project.requirements) {
    classDemand.set(req.classId, (classDemand.get(req.classId) ?? 0) + req.periodsPerWeek);
    const qualified = qualifiedByClassSubject.get(`${req.classId}#${req.subjectId}`) ?? [];
    if (req.periodsPerWeek > 0 && qualified.length === 0) {
      const sn = subjectName.get(req.subjectId) ?? req.subjectId;
      const cn = className.get(req.classId) ?? req.classId;
      addBlocker(blockers, relaxationSuggestions, structuredBlockers, {
        kind: "subject_capacity",
        message: `No available teacher is qualified to teach ${sn} to ${cn}.`,
        entityRefs: [
          { type: "subject", id: req.subjectId },
          { type: "class", id: req.classId },
        ],
        relaxation: {
          message: `Assign a teacher for ${sn}, or reduce that weekly requirement.`,
          severity: "moderate",
        },
      });
    }
  }

  // Check 2 — class_capacity: class demand exceeds available weekly teaching slots.
  const capacityPerClass = profile.days.length * teachingSlots(profile).length;
  for (const [classId, demand] of classDemand) {
    if (demand > capacityPerClass) {
      const cn = className.get(classId) ?? classId;
      addBlocker(blockers, relaxationSuggestions, structuredBlockers, {
        kind: "class_capacity",
        message: `${cn} needs ${demand} teaching periods, but only ${capacityPerClass} teaching slots exist in the week.`,
        entityRefs: [{ type: "class", id: classId }],
        relaxation: {
          message: `Reduce weekly subject periods for ${cn}, or add teaching periods to the school day.`,
          severity: "moderate",
        },
      });
    }
  }

  // Check 3 — teacher_capacity: teacher's intrinsic maxPerWeek field < sole-qualifier demand.
  for (const [teacherId, forced] of teacherForcedDemand) {
    const teacher = teacherById.get(teacherId);
    if (!teacher || forced <= teacher.maxPerWeek) continue;
    const tn = teacher.name;
    const cap = teacher.maxPerWeek;
    addBlocker(blockers, relaxationSuggestions, structuredBlockers, {
      kind: "teacher_capacity",
      message: `${tn} can teach at most ${cap} periods per week but is the sole qualified teacher for ${forced} required periods.`,
      entityRefs: [{ type: "teacher", id: teacherId }],
      relaxation: {
        message: `Raise ${tn}'s weekly limit to at least ${forced}, reduce demand, or qualify another teacher.`,
        severity: "moderate",
        apply: (p: Project): Project => ({
          ...p,
          teachers: p.teachers.map((t) => (t.id === teacherId ? { ...t, maxPerWeek: forced } : t)),
        }),
      },
    });
  }

  // Check 4 — slot_contention: a subject_only_periods must constraint forces more periods
  // into its allowed slots than the week can supply. (Note: day-based restrictions like
  // "Mon–Thu only" cannot be expressed in v6 — only slot-index restrictions are checked here.)
  const onlyPeriodMusts = project.constraints.filter(
    (c): c is Extract<Constraint, { template: "subject_only_periods" }> =>
      c.enabled && c.severity === "must" && c.template === "subject_only_periods",
  );
  for (const c of onlyPeriodMusts) {
    const availablePerWeek = c.params.slots.length * profile.days.length;
    for (const classId of c.params.classIds) {
      for (const subjectId of c.params.subjectIds) {
        const req = project.requirements.find((r) => r.classId === classId && r.subjectId === subjectId);
        if (!req || req.periodsPerWeek === 0 || req.periodsPerWeek <= availablePerWeek) continue;
        const sn = subjectName.get(subjectId) ?? subjectId;
        const cn = className.get(classId) ?? classId;
        const n = c.params.slots.length;
        const slotList = c.params.slots.join(", ");
        addBlocker(blockers, relaxationSuggestions, structuredBlockers, {
          kind: "slot_contention",
          message: `${sn} for ${cn} needs ${req.periodsPerWeek} periods but the "only periods" rule restricts it to at most ${availablePerWeek} (${n} slot${n === 1 ? "" : "s"} × ${profile.days.length} days).`,
          entityRefs: [
            { type: "subject", id: subjectId },
            { type: "class", id: classId },
            ...c.params.slots.map((s) => ({ type: "slot" as const, id: String(s) })),
          ],
          relaxation: {
            message: `Expand the allowed periods for ${sn} (currently slot${n === 1 ? "" : "s"} ${slotList}), or reduce the weekly requirement for ${cn}.`,
            severity: "moderate",
          },
        });
      }
    }
  }

  // Check 5 — locked_conflict: a pinned event violates a hard constraint.
  const pinnedIds = new Set(timetable.placements.filter((p) => p.pinned).map((p) => p.eventId));
  const eventIndex = new Map(project.events.map((e) => [e.id, e]));
  const pinnedCells = new Set<string>();
  for (const placement of timetable.placements.filter((p) => p.pinned)) {
    const event = eventIndex.get(placement.eventId);
    const slots = event ? occupiedSlots(profile, placement.slot, event.duration) : null;
    if (!event || !slots) continue;
    for (const slot of slots) for (const classId of event.classIds) pinnedCells.add(`${classId}#${placement.day}#${slot}`);
  }
  const hard = validate(project, timetable).filter((v) => v.severity === "hard");
  for (const v of hard) {
    if (v.slots.some((s) => (s.eventId && pinnedIds.has(s.eventId)) || (s.classId && pinnedCells.has(`${s.classId}#${s.day}#${s.slot}`)))) {
      addBlocker(blockers, relaxationSuggestions, structuredBlockers, {
        kind: "locked_conflict",
        message: `A locked lesson blocks a strict rule: ${v.message}`,
        entityRefs: v.slots.flatMap((s) => [
          ...(s.classId ? [{ type: "class" as const, id: s.classId }] : []),
          ...(s.teacherId ? [{ type: "teacher" as const, id: s.teacherId }] : []),
        ]),
        relaxation: {
          message: "Unlock the lesson or relax the strict rule, then run Make timetable again.",
          severity: "large",
        },
      });
    }
  }

  // Check 6 — cap_sum: a teacher_max_per_week MUST constraint cap < sole-qualifier demand.
  for (const cap of teacherMaxMusts(project)) {
    const teacherId = cap.params.teacherId;
    const forced = teacherForcedDemand.get(teacherId) ?? 0;
    if (forced <= cap.params.max) continue;
    const tn = teacherName.get(teacherId) ?? teacherId;
    const capMax = cap.params.max;
    const capId = cap.id;
    addBlocker(blockers, relaxationSuggestions, structuredBlockers, {
      kind: "cap_sum",
      message: `${tn} is the only qualified teacher for ${forced} required periods, but the limit is ${capMax}.`,
      entityRefs: [{ type: "teacher", id: teacherId }],
      relaxation: {
        message: `Raise ${tn}'s weekly limit, reduce demand, or qualify another teacher.`,
        severity: "small",
        apply: (p: Project): Project => ({
          ...p,
          constraints: p.constraints.map((c) => {
            if (c.id !== capId) return c;
            return { ...cap, params: { ...cap.params, max: forced } } as Constraint;
          }),
        }),
      },
    });
  }

  if (blockers.length > 0) return { status: "blocked", blockers, relaxationSuggestions, structuredBlockers };
  if (totalShortfall(project, timetable) > 0 || hard.length > 0) return { status: "ready", blockers: [], relaxationSuggestions: [], structuredBlockers: [] };
  return { status: "ready", blockers: [], relaxationSuggestions: [], structuredBlockers: [] };
}
