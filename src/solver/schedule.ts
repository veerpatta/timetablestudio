// Complete-as-feasible scheduler (PURE, seeded) — OVERHAUL A3. The greedy `fill` is a fast
// MRV + forward-checking constructor, but a single greedy pass leaves the most contended
// holes empty (it never reconsiders an earlier choice). This adds a bounded, deterministic
// REPAIR on top: for each remaining coverage gap it tries to place the missing lesson,
// directly or by relocating ONE ordinary lesson out of the way (single-eviction-relocation).
//
// The acceptance gate is the one oracle, not a second constraint engine: a proposed change is
// kept iff validate() shows no hard violation AND totalShortfall strictly drops (A2). Because
// every cap-must is already a hard violation in validate() (constraintAggregates → validate),
// caps are enforced for free — no incremental cap state, no rollback (advisor). Strictly-
// improving acceptance means the repair can never regress an already-valid timetable.
//
// What the repair must NEVER move: pinned, joint/team blocks, and group-scoped electives +
// their self_study (A1) — moving an elective would resurrect the Self Study collapse. That
// set is exactly `isReschedulable === false`, shared with plan.ts.

import { localMustForbids } from "../domain/constraints";
import { requirementCoverage, totalShortfall } from "../domain/coverage";
import { findProfile } from "../domain/derive";
import { movePlacement, placeNormalLesson } from "../domain/edit";
import { occupiedSlots, teachingSlots } from "../domain/profile";
import { validate } from "../domain/validate";
import type { Day, Id, Placement, Profile, Project, Timetable, TimetableEvent } from "../domain/types";
import { fill, type FillResult, type FilledPlacement } from "./fill";
import { mulberry32 } from "./rng";

/** An ordinary whole-class lesson the planner/repair may freely relocate or remove. Anything
 *  else (pinned, joint_class, team_block, electives with studentGroupIds, self_study, doubles)
 *  is structural and stays put. Shared with plan.ts so both protect exactly the same set. */
export function isReschedulable(project: Project, eventId: Id): boolean {
  const e = project.events.find((ev) => ev.id === eventId);
  if (!e) return false;
  if (e.type !== "normal" || e.classIds.length !== 1 || e.duration !== 1) return false;
  if (e.studentGroupIds && e.studentGroupIds.length > 0) return false;
  return true;
}

const K = (a: string, b: string): string => `${a} ${b}`;

interface Qual {
  subjectId: Id;
  teacherId: Id;
  label: string;
}
interface Occupancy {
  teacherBusy: Set<string>; // `${teacherId} ${day}#${slot}`
  classBusy: Set<string>; // `${classId} ${day}#${slot}`
  movableAt: Map<string, { placement: Placement; classId: Id }>; // teacher slot -> the one movable lesson there
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function buildOccupancy(project: Project, tt: Timetable, profile: Profile): Occupancy {
  const teacherBusy = new Set<string>();
  const classBusy = new Set<string>();
  const movableAt = new Map<string, { placement: Placement; classId: Id }>();
  const eventIndex = new Map(project.events.map((e) => [e.id, e]));
  for (const p of tt.placements) {
    const ev = eventIndex.get(p.eventId);
    if (!ev) continue;
    const slots = occupiedSlots(profile, p.slot, ev.duration);
    if (!slots) continue;
    const movable = isReschedulable(project, ev.id);
    for (const s of slots) {
      const dk = `${p.day}#${s}`;
      for (const c of ev.classIds) classBusy.add(K(c, dk));
      for (const t of ev.teacherIds) {
        teacherBusy.add(K(t, dk));
        if (movable) movableAt.set(K(t, dk), { placement: p, classId: ev.classIds[0]! });
      }
    }
  }
  return { teacherBusy, classBusy, movableAt };
}

/** Return the teacherId who has the most already-placed lessons for (classId, subjectId). */
function primaryTeacher(
  tt: Timetable,
  classId: Id,
  subjectId: Id,
  eventIndex: Map<Id, TimetableEvent>,
): Id | null {
  const counts = new Map<Id, number>();
  for (const p of tt.placements) {
    const ev = eventIndex.get(p.eventId);
    if (!ev || ev.subjectId !== subjectId || !ev.classIds.includes(classId)) continue;
    for (const tid of ev.teacherIds) counts.set(tid, (counts.get(tid) ?? 0) + 1);
  }
  let best: Id | null = null, bestCount = 0;
  for (const [tid, n] of counts) if (n > bestCount) { best = tid; bestCount = n; }
  return best;
}

/** Candidate repair moves for one gap, each with the newly-placed lesson for the diff. */
interface RepairCandidate {
  project: Project;
  placed: FilledPlacement;
}

function gapCandidates(
  project: Project,
  timetableId: Id,
  profile: Profile,
  classId: Id,
  subjectId: Id,
  quals: Qual[],
  allQualsByClass: Map<Id, Qual[]>,
  unavail: Set<string>,
  rng: () => number,
  cap: number,
): RepairCandidate[] {
  const tt = project.timetables.find((t) => t.id === timetableId)!;
  const occ = buildOccupancy(project, tt, profile);
  const teach = teachingSlots(profile);
  const holes: { day: Day; slot: number }[] = [];
  for (const day of profile.days) for (const slot of teach) if (!occ.classBusy.has(K(classId, `${day}#${slot}`))) holes.push({ day, slot });

  // Continuity preference (M-D): put the teacher who has the most already-placed periods for
  // this (classId, subjectId) first; shuffle the rest. The solver prefers same-teacher for
  // subject continuity and only substitutes when continuity-preserving fill is impossible.
  const eventIndex = new Map(project.events.map((e) => [e.id, e]));
  const primaryId = primaryTeacher(tt, classId, subjectId, eventIndex);
  const rawTeachers = quals.filter((q) => q.subjectId === subjectId);
  const primary = rawTeachers.filter((q) => q.teacherId === primaryId);
  const others = shuffle(rawTeachers.filter((q) => q.teacherId !== primaryId), rng);
  const teachers: Qual[] = [...primary, ...others];

  const out: RepairCandidate[] = [];

  // okFor: gate check for arbitrary (classId, subjectId, teacher) placement.
  const okFor = (teacherId: Id, cId: Id, sId: Id, day: Day, slot: number): boolean =>
    !unavail.has(K(teacherId, `${day}#${slot}`)) &&
    !localMustForbids(project, profile, { classId: cId, subjectId: sId, teacherIds: [teacherId], day, slot });
  const ok = (teacherId: Id, day: Day, slot: number): boolean => okFor(teacherId, classId, subjectId, day, slot);

  // 1) direct placement — a hole where a qualified teacher is already free (greedy may have
  //    missed it under a different ordering). Primary teacher tried first (continuity).
  for (const h of shuffle(holes, rng)) {
    const dk = `${h.day}#${h.slot}`;
    for (const q of teachers) {
      if (occ.teacherBusy.has(K(q.teacherId, dk)) || !ok(q.teacherId, h.day, h.slot)) continue;
      const note =
        primaryId !== null && q.teacherId !== primaryId
          ? `substituted for primary teacher (continuity relaxed)`
          : undefined;
      out.push({
        project: placeNormalLesson(project, timetableId, classId, h.day, h.slot, subjectId, [q.teacherId]),
        placed: { classId, day: h.day, slot: h.slot, subjectId, teacherIds: [q.teacherId], label: q.label, note },
      });
      if (out.length >= cap) return out;
    }
  }

  // 2) single-eviction-relocation — a hole where the qualified teacher is busy teaching ONE
  //    movable lesson; relocate that lesson to another legal slot, then take the hole.
  for (const h of shuffle(holes, rng)) {
    const dk = `${h.day}#${h.slot}`;
    for (const q of teachers) {
      const blocker = occ.movableAt.get(K(q.teacherId, dk));
      if (!blocker || !ok(q.teacherId, h.day, h.slot)) continue;
      const movedClass = blocker.classId;
      for (const day2 of profile.days) {
        for (const slot2 of teach) {
          if (day2 === h.day && slot2 === h.slot) continue;
          const dk2 = `${day2}#${slot2}`;
          if (occ.classBusy.has(K(movedClass, dk2)) || occ.teacherBusy.has(K(q.teacherId, dk2))) continue;
          if (unavail.has(K(q.teacherId, dk2))) continue;
          const movedEvent = eventIndex.get(blocker.placement.eventId)!;
          if (localMustForbids(project, profile, { classId: movedClass, subjectId: movedEvent.subjectId, teacherIds: [q.teacherId], day: day2, slot: slot2 })) continue;
          const relocated = movePlacement(project, timetableId, blocker.placement, day2, slot2);
          const note =
            primaryId !== null && q.teacherId !== primaryId
              ? `substituted for primary teacher (continuity relaxed)`
              : undefined;
          out.push({
            project: placeNormalLesson(relocated, timetableId, classId, h.day, h.slot, subjectId, [q.teacherId]),
            placed: { classId, day: h.day, slot: h.slot, subjectId, teacherIds: [q.teacherId], label: q.label, note },
          });
          if (out.length >= cap) return out;
        }
      }
    }
  }

  // 3) load-swap (M-D) — when a qualified teacher Q is busy at the gap hole with a movable
  //    lesson for a DIFFERENT class, try substituting another teacher Y into Q's lesson (Q→Y
  //    for that class), freeing Q to fill the gap. This handles the case where phase 2 can't
  //    relocate Q's blocker lesson (Q is unavailable in all other slots) but a substitute Y
  //    can step in. Reported as a load-rebalancing note.
  for (const h of shuffle(holes, rng)) {
    const dk = `${h.day}#${h.slot}`;
    for (const q of teachers) {
      const blocker = occ.movableAt.get(K(q.teacherId, dk));
      if (!blocker) continue;
      if (blocker.classId === classId) continue; // same class — phase 2 territory
      if (!ok(q.teacherId, h.day, h.slot)) continue;
      const blockerEvent = eventIndex.get(blocker.placement.eventId);
      if (!blockerEvent) continue;
      const blockerSubject = blockerEvent.subjectId;
      const subs = (allQualsByClass.get(blocker.classId) ?? []).filter((r) => r.subjectId === blockerSubject);
      for (const y of shuffle(subs, rng)) {
        if (y.teacherId === q.teacherId) continue;
        if (occ.teacherBusy.has(K(y.teacherId, dk))) continue;
        if (!okFor(y.teacherId, blocker.classId, blockerSubject, h.day, h.slot)) continue;
        const yName = project.teachers.find((t) => t.id === y.teacherId)?.name ?? y.teacherId;
        const blockerClassName = project.classes.find((c) => c.id === blocker.classId)?.name ?? blocker.classId;
        const blockerSubjectName = project.subjects.find((s) => s.id === blockerSubject)?.name ?? blockerSubject;
        const swapped = placeNormalLesson(project, timetableId, blocker.classId, h.day, h.slot, blockerSubject, [y.teacherId]);
        const filled = placeNormalLesson(swapped, timetableId, classId, h.day, h.slot, subjectId, [q.teacherId]);
        out.push({
          project: filled,
          placed: {
            classId, day: h.day, slot: h.slot, subjectId, teacherIds: [q.teacherId], label: q.label,
            note: `load rebalanced — ${yName} covers ${blockerSubjectName} for ${blockerClassName}`,
          },
        });
        if (out.length >= cap) return out;
      }
    }
  }

  return out;
}

export interface SolveOptions {
  seed?: number;
  budgetMs?: number;
}

const hardCount = (project: Project, tt: Timetable): number => validate(project, tt).filter((v) => v.severity === "hard").length;

/** Relocate soft-violated reschedulable placements to their least-conflicting legal slots.
 *  Accepts a move only when: hard violations stay 0, shortfall does not increase, and soft
 *  violation count strictly drops. Runs until no single-swap improvement is found or the
 *  budget expires. Deterministic per the supplied rng. */
function softImprovePass(
  project: Project,
  timetableId: Id,
  profile: Profile,
  rng: () => number,
  budgetMs: number,
  startedAt: number,
): Project {
  let current = project;
  const teach = teachingSlots(profile);
  let madeProgress = true;
  while (madeProgress && Date.now() - startedAt < budgetMs) {
    madeProgress = false;
    const tt = current.timetables.find((t) => t.id === timetableId)!;
    const sf0 = totalShortfall(current, tt);
    const allViolations = validate(current, tt);
    const softBefore = allViolations.filter((v) => v.severity === "soft").length;
    if (softBefore === 0) break;
    // Collect (classId, day, slot) keys from soft violation slots.  Local constraint
    // violations report { classId, day, slot } (no eventId); aggregate ones may carry
    // eventId instead. Handle both so no violated placement is overlooked.
    const violatedKeys = new Set<string>();
    for (const v of allViolations) {
      if (v.severity !== "soft") continue;
      for (const s of v.slots) {
        if (s.classId !== undefined) violatedKeys.add(`c:${s.classId}:${s.day}:${s.slot}`);
        if (s.eventId !== undefined) violatedKeys.add(`e:${s.eventId}:${s.day}:${s.slot}`);
      }
    }
    const eventIndex = new Map(current.events.map((e) => [e.id, e]));
    const candidates = shuffle(
      tt.placements.filter((p) => {
        if (!isReschedulable(current, p.eventId)) return false;
        if (violatedKeys.has(`e:${p.eventId}:${p.day}:${p.slot}`)) return true;
        const ev = eventIndex.get(p.eventId);
        return ev !== undefined && ev.classIds.some((cId) => violatedKeys.has(`c:${cId}:${p.day}:${p.slot}`));
      }),
      rng,
    );
    for (const p of candidates) {
      if (Date.now() - startedAt >= budgetMs) break;
      for (const day2 of profile.days) {
        for (const slot2 of teach) {
          if (day2 === p.day && slot2 === p.slot) continue;
          if (Date.now() - startedAt >= budgetMs) break;
          const moved = movePlacement(current, timetableId, p, day2, slot2);
          const movedTt = moved.timetables.find((t) => t.id === timetableId)!;
          if (hardCount(moved, movedTt) > 0) continue;
          if (totalShortfall(moved, movedTt) > sf0) continue;
          const newSoft = validate(moved, movedTt).filter((v) => v.severity === "soft").length;
          if (newSoft < softBefore) {
            current = moved;
            madeProgress = true;
            break;
          }
        }
        if (madeProgress) break;
      }
      if (madeProgress) break;
    }
  }
  return current;
}

/** Greedy construct (`fill`) then a bounded validate-gated repair, followed by a soft
 *  improvement pass. Returns a FillResult so it drops into generate()/plan() unchanged.
 *  Deterministic per seed; budget-bounded.
 *
 *  M-F upgrades (2026-06-21):
 *  - Contention-directed gap ordering: repair tackles the most constrained (fewest qualified
 *    teachers) gaps first, giving scarce resources first access to open slots.
 *  - Min-conflicts soft improvement: after repair, relocate soft-violated lessons to less-
 *    conflicting positions even when shortfall is already 0. */
export function solve(project: Project, timetableId: Id, opts?: SolveOptions): FillResult {
  const base = fill(project, timetableId, { seed: opts?.seed });
  let current = base.project;
  const tt0 = current.timetables.find((t) => t.id === timetableId);
  const profile = tt0 && findProfile(current, tt0);
  if (!tt0 || !profile) return base;

  const budgetMs = opts?.budgetMs ?? 2500;
  const startedAt = Date.now();
  const added: FilledPlacement[] = [...base.added];

  // Repair loop: fill coverage gaps that greedy fill could not close.
  if (totalShortfall(current, tt0) > 0) {
    const rng = mulberry32((opts?.seed ?? 1) ^ 0x9e3779b9);
    // legal (subject, teacher) options per class, from qualifications.
    const teacherById = new Map(project.teachers.map((t) => [t.id, t]));
    const subjName = new Map(project.subjects.map((s) => [s.id, s.name]));
    const teaName = new Map(project.teachers.map((t) => [t.id, t.name]));
    const qualsByClass = new Map<Id, Qual[]>();
    for (const q of project.qualifications) {
      if (!teacherById.get(q.teacherId)?.schedulable) continue;
      const list = qualsByClass.get(q.classId) ?? [];
      list.push({ subjectId: q.subjectId, teacherId: q.teacherId, label: `${subjName.get(q.subjectId) ?? q.subjectId} — ${teaName.get(q.teacherId) ?? q.teacherId}` });
      qualsByClass.set(q.classId, list);
    }
    const unavail = new Set<string>();
    for (const t of project.teachers) for (const u of t.unavailable) unavail.add(K(t.id, `${u.day}#${u.slot}`));

    let progressing = true;
    while (progressing && Date.now() - startedAt < budgetMs) {
      progressing = false;
      const ttNow = current.timetables.find((t) => t.id === timetableId)!;
      const shortfallBefore = totalShortfall(current, ttNow);
      if (shortfallBefore === 0) break;
      // Contention-directed ordering: fewest qualified teachers first → most constrained gap
      // gets first pick of still-open slots, reducing the chance of a dead-end.
      const gaps = requirementCoverage(current, ttNow)
        .filter((c) => c.short > 0)
        .sort((a, b) => {
          const aCount = (qualsByClass.get(a.classId) ?? []).filter((q) => q.subjectId === a.subjectId).length;
          const bCount = (qualsByClass.get(b.classId) ?? []).filter((q) => q.subjectId === b.subjectId).length;
          return aCount - bCount;
        });
      for (const gap of gaps) {
        if (Date.now() - startedAt >= budgetMs) break;
        const cands = gapCandidates(current, timetableId, profile, gap.classId, gap.subjectId, qualsByClass.get(gap.classId) ?? [], qualsByClass, unavail, rng, 8);
        for (const cand of cands) {
          const candTt = cand.project.timetables.find((t) => t.id === timetableId)!;
          if (hardCount(cand.project, candTt) === 0 && totalShortfall(cand.project, candTt) < shortfallBefore) {
            current = cand.project;
            added.push(cand.placed);
            progressing = true;
            break;
          }
        }
        if (progressing) break; // recompute gaps from the new state
      }
    }
  }

  // Min-conflicts soft improvement: relocate prefer-violated lessons to less-conflicting slots.
  if (Date.now() - startedAt < budgetMs) {
    const rngSoft = mulberry32((opts?.seed ?? 1) ^ 0xdeadbeef);
    current = softImprovePass(current, timetableId, profile, rngSoft, budgetMs, startedAt);
  }

  const finalTt = current.timetables.find((t) => t.id === timetableId)!;
  return { project: current, added, remainingShortfall: totalShortfall(current, finalTt), blockers: base.blockers, gapReasons: base.gapReasons };
}
