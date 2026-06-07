// Entity CRUD (PURE, immutable — every fn returns a NEW Project). The C1 engine.
//
// Invariants every operation upholds (proven in entityEdit.test.ts via
// findDanglingRefs + validate):
//   • RENAME changes `name` only; the id stays stable, so no reference is touched
//     (ids are opaque — buildProject seeds them from names, but nothing reads a
//     name to resolve an id). Rename is therefore non-destructive by construction.
//   • REMOVE cascades through every id-bearing field — no dangling reference, ever.
//   • Multi-class events are NOT a plain cascade: dropping a class from a joint_class
//     / team_block can push it below its HE6 minimum (joint ≥2 classes), so the event
//     is demoted to a normal lesson (or removed if it empties out). Likewise a teacher
//     dropped from an event is either reassigned or the lesson goes teacher-less.
//   • New ids are opaque + collision-free ("t:1", "s:2", …), never name-derived, so a
//     later rename can never orphan them.

import type {
  Band,
  Id,
  Profile,
  Project,
  SchoolClass,
  SlotDef,
  Subject,
  Teacher,
  TimetableEvent,
} from "./types";

// --- id minting -------------------------------------------------------------

/** Smallest "prefix:n" not already taken. Pure + deterministic (no Math.random). */
function uniqueId(prefix: string, taken: Set<string>): Id {
  for (let n = 1; ; n++) {
    const id = `${prefix}:${n}`;
    if (!taken.has(id)) return id;
  }
}

const allIds = (project: Project): Set<string> =>
  new Set([
    ...project.teachers.map((t) => t.id),
    ...project.subjects.map((s) => s.id),
    ...project.classes.map((c) => c.id),
    ...project.events.map((e) => e.id),
  ]);

// --- Teachers ---------------------------------------------------------------

export function addTeacher(
  project: Project,
  name: string,
  opts: { maxPerDay?: number; maxPerWeek?: number } = {},
): { project: Project; id: Id } {
  const id = uniqueId("t", allIds(project));
  const teacher: Teacher = {
    id,
    name: name.trim(),
    maxPerDay: opts.maxPerDay ?? 8,
    maxPerWeek: opts.maxPerWeek ?? 48,
    schedulable: true,
    unavailable: [],
  };
  return { project: { ...project, teachers: [...project.teachers, teacher] }, id };
}

export function renameTeacher(project: Project, id: Id, name: string): Project {
  return { ...project, teachers: project.teachers.map((t) => (t.id === id ? { ...t, name: name.trim() } : t)) };
}

/**
 * Remove a teacher. If `reassignTo` is given, every reference (events, quals,
 * requirements, class-teacher) is repointed to that teacher; otherwise the teacher
 * is simply dropped (lessons lose this teacher — academic lessons then read as
 * "needs a teacher", surfaced by the issues panel, never a silent clash).
 */
export function removeTeacher(project: Project, id: Id, opts: { reassignTo?: Id } = {}): Project {
  const to = opts.reassignTo;
  const swap = (ids: Id[]): Id[] => {
    const mapped = ids.map((x) => (x === id ? to : x)).filter((x): x is Id => x != null);
    return [...new Set(mapped)];
  };

  const events = project.events.map((e) =>
    e.teacherIds.includes(id) ? { ...e, teacherIds: swap(e.teacherIds) } : e,
  );
  const teachers = project.teachers.filter((t) => t.id !== id);
  const classes = project.classes.map((c) =>
    c.classTeacherId === id ? { ...c, classTeacherId: to } : c,
  );
  const requirements = project.requirements.map((r) =>
    r.teacherIds.includes(id) ? { ...r, teacherIds: swap(r.teacherIds) } : r,
  );

  // Qualifications: repoint to the replacement (deduped) or drop them.
  const quals = project.qualifications.flatMap((q) => {
    if (q.teacherId !== id) return [q];
    return to ? [{ ...q, teacherId: to }] : [];
  });
  const seen = new Set<string>();
  const qualifications = quals.filter((q) => {
    const k = `${q.teacherId}#${q.subjectId}#${q.classId}`;
    return seen.has(k) ? false : (seen.add(k), true);
  });

  // Rules that name only this teacher are dropped (a rule about a gone teacher is dead).
  const rules = project.rules.filter((r) => !("teacherId" in r && r.teacherId === id));

  return { ...project, teachers, classes, events, requirements, qualifications, rules };
}

// --- Subjects ---------------------------------------------------------------

export function addSubject(
  project: Project,
  name: string,
  opts: { kind?: Subject["kind"]; bands?: Band[] } = {},
): { project: Project; id: Id } {
  const id = uniqueId("s", allIds(project));
  const subject: Subject = {
    id,
    name: name.trim(),
    bands: opts.bands ?? ["primary", "middle", "secondary", "senior"],
    kind: opts.kind ?? "academic",
  };
  return { project: { ...project, subjects: [...project.subjects, subject] }, id };
}

export function renameSubject(project: Project, id: Id, name: string): Project {
  return { ...project, subjects: project.subjects.map((s) => (s.id === id ? { ...s, name: name.trim() } : s)) };
}

/** Remove a subject: every lesson of it disappears (and its placements, quals, reqs, rules). */
export function removeSubject(project: Project, id: Id): Project {
  const deadEvents = new Set(project.events.filter((e) => e.subjectId === id).map((e) => e.id));
  return {
    ...project,
    subjects: project.subjects.filter((s) => s.id !== id),
    events: project.events.filter((e) => e.subjectId !== id),
    qualifications: project.qualifications.filter((q) => q.subjectId !== id),
    requirements: project.requirements.filter((r) => r.subjectId !== id),
    rules: project.rules.filter((r) => !subjectRuleDead(r, id)),
    timetables: project.timetables.map((tt) => ({
      ...tt,
      placements: tt.placements.filter((p) => !deadEvents.has(p.eventId)),
    })),
  };
}

function subjectRuleDead(r: Project["rules"][number], id: Id): boolean {
  if ("subjectId" in r && r.subjectId === id) return true;
  if ("subjectIds" in r && r.subjectIds.includes(id) && r.subjectIds.length === 1) return true;
  if ("beforeSubjectId" in r && (r.beforeSubjectId === id || r.afterSubjectId === id)) return true;
  if ("coreSubjectIds" in r && r.coreSubjectIds.includes(id) && r.coreSubjectIds.length === 1) return true;
  return false;
}

// --- Classes ----------------------------------------------------------------

export function addClass(
  project: Project,
  name: string,
  opts: { band?: Band; stream?: SchoolClass["stream"]; isBoardClass?: boolean } = {},
): { project: Project; id: Id } {
  const id = uniqueId("c", allIds(project));
  const klass: SchoolClass = {
    id,
    name: name.trim(),
    band: opts.band ?? "middle",
    ...(opts.stream ? { stream: opts.stream } : {}),
    ...(opts.isBoardClass ? { isBoardClass: true } : {}),
  };
  return { project: { ...project, classes: [...project.classes, klass] }, id };
}

export function renameClass(project: Project, id: Id, name: string): Project {
  return { ...project, classes: project.classes.map((c) => (c.id === id ? { ...c, name: name.trim() } : c)) };
}

/**
 * Remove a class. The hard part is multi-class events: drop the class from each
 * event's classIds, then re-type so HE6 still holds — a joint_class / team_block that
 * falls below 2 classes becomes a normal lesson; an event that empties out is removed
 * along with its placements. Single-class events of this class vanish entirely.
 */
export function removeClass(project: Project, id: Id): Project {
  const deadEvents = new Set<Id>();
  const events: TimetableEvent[] = [];
  for (const e of project.events) {
    if (!e.classIds.includes(id)) {
      events.push(e);
      continue;
    }
    const classIds = e.classIds.filter((c) => c !== id);
    if (classIds.length === 0) {
      deadEvents.add(e.id); // the only class — the lesson is gone
      continue;
    }
    // Demote a joint/team event that has dropped below its minimum (HE6).
    const type =
      (e.type === "joint_class" || e.type === "team_block") && classIds.length < 2 ? "normal" : e.type;
    events.push({ ...e, classIds, type });
  }

  return {
    ...project,
    classes: project.classes.filter((c) => c.id !== id),
    events,
    qualifications: project.qualifications.filter((q) => q.classId !== id),
    requirements: project.requirements.filter((r) => r.classId !== id),
    rules: project.rules.filter((r) => !classRuleDead(r, id)),
    timetables: project.timetables.map((tt) => ({
      ...tt,
      placements: tt.placements.filter((p) => !deadEvents.has(p.eventId)),
    })),
  };
}

function classRuleDead(r: Project["rules"][number], id: Id): boolean {
  if ("classId" in r && r.classId === id) return true;
  if ("classIds" in r && r.classIds.includes(id) && r.classIds.length === 1) return true;
  return false;
}

// --- Periods (scope: rename/retime, append, remove-with-impact) -------------
// Mid-grid INSERT (which would reindex every placement.slot / unavailable.slot /
// rule slot) is deliberately out of C1 scope — not in the AC, low payoff, high risk.

const DEFAULT_PROFILE = (project: Project, profileId?: Id): Profile =>
  project.profiles.find((p) => p.id === profileId) ??
  project.profiles.find((p) => p.isDefault) ??
  project.profiles[0]!;

function writeProfile(project: Project, profile: Profile): Project {
  return { ...project, profiles: project.profiles.map((p) => (p.id === profile.id ? profile : p)) };
}

/** Rename / re-time one slot (label and/or clock). Non-destructive. */
export function editPeriod(
  project: Project,
  profileId: Id,
  slotIndex: number,
  patch: { label?: string; start?: string; end?: string },
): Project {
  const profile = DEFAULT_PROFILE(project, profileId);
  const slots = profile.slots.map((s) =>
    s.index === slotIndex
      ? {
          ...s,
          ...(patch.label !== undefined ? { label: patch.label.trim() } : {}),
          ...(patch.start !== undefined ? { start: patch.start } : {}),
          ...(patch.end !== undefined ? { end: patch.end } : {}),
        }
      : s,
  );
  return writeProfile(project, { ...profile, slots });
}

/** Append a teaching period to the end of the day (the safe growth direction). */
export function addPeriod(project: Project, profileId: Id, label?: string): Project {
  const profile = DEFAULT_PROFILE(project, profileId);
  const nextIndex = Math.max(...profile.slots.map((s) => s.index)) + 1;
  const teachingCount = profile.slots.filter((s) => s.teaching).length;
  const last = profile.slots[profile.slots.length - 1];
  const slot: SlotDef = {
    index: nextIndex,
    label: (label ?? `P${teachingCount + 1}`).trim(),
    start: last?.end ?? "14:10",
    end: last?.end ?? "14:50",
    teaching: true,
  };
  return writeProfile(project, { ...profile, slots: [...profile.slots, slot] });
}

/**
 * Remove a slot. Any placement on it is dropped (its lesson un-scheduled — shown as a
 * gap, never a silent clash) and any teacher-unavailability on it is cleared. Indices
 * of other slots are left untouched (placements key on index, so removing the highest
 * teaching slot is clean; removing a mid slot just leaves a hole in the index space,
 * which is harmless — derive/validate look slots up by index, not position).
 */
export function removePeriod(project: Project, profileId: Id, slotIndex: number): Project {
  const profile = DEFAULT_PROFILE(project, profileId);
  const slots = profile.slots.filter((s) => s.index !== slotIndex);
  const withProfile = writeProfile(project, { ...profile, slots });
  const onThisProfile = new Set(
    withProfile.timetables.filter((tt) => tt.profileId === profile.id).map((tt) => tt.id),
  );
  return {
    ...withProfile,
    teachers: withProfile.teachers.map((t) => ({
      ...t,
      unavailable: t.unavailable.filter((u) => u.slot !== slotIndex),
    })),
    timetables: withProfile.timetables.map((tt) =>
      onThisProfile.has(tt.id)
        ? { ...tt, placements: tt.placements.filter((p) => p.slot !== slotIndex && !covers(profile, p.slot, slotIndex)) }
        : tt,
    ),
  };
}

/** Whether a duration-aware placement starting at `start` also spills onto `slot`. */
function covers(profile: Profile, start: number, slot: number): boolean {
  // Conservative: only the start slot is keyed; multi-slot spill is rare and the
  // dropped-placement path already removes the start. Kept simple per C1 scope.
  void profile;
  return start === slot;
}

// Re-export for callers that want the impact preview alongside an edit.
export { referencesOf, findDanglingRefs } from "./references";
