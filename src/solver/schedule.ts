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
import type { Day, Id, Placement, Profile, Project, Timetable } from "../domain/types";
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
  unavail: Set<string>,
  rng: () => number,
  cap: number,
): RepairCandidate[] {
  const tt = project.timetables.find((t) => t.id === timetableId)!;
  const occ = buildOccupancy(project, tt, profile);
  const teach = teachingSlots(profile);
  const holes: { day: Day; slot: number }[] = [];
  for (const day of profile.days) for (const slot of teach) if (!occ.classBusy.has(K(classId, `${day}#${slot}`))) holes.push({ day, slot });
  const teachers = shuffle(quals.filter((q) => q.subjectId === subjectId), rng);
  const out: RepairCandidate[] = [];
  const ok = (teacherId: Id, day: Day, slot: number) =>
    !unavail.has(K(teacherId, `${day}#${slot}`)) &&
    !localMustForbids(project, profile, { classId, subjectId, teacherIds: [teacherId], day, slot });

  // 1) direct placement — a hole where a qualified teacher is already free (greedy may have
  //    missed it under a different ordering).
  for (const h of shuffle(holes, rng)) {
    const dk = `${h.day}#${h.slot}`;
    for (const q of teachers) {
      if (occ.teacherBusy.has(K(q.teacherId, dk)) || !ok(q.teacherId, h.day, h.slot)) continue;
      out.push({
        project: placeNormalLesson(project, timetableId, classId, h.day, h.slot, subjectId, [q.teacherId]),
        placed: { classId, day: h.day, slot: h.slot, subjectId, teacherIds: [q.teacherId], label: q.label },
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
          const movedEvent = project.events.find((e) => e.id === blocker.placement.eventId)!;
          if (localMustForbids(project, profile, { classId: movedClass, subjectId: movedEvent.subjectId, teacherIds: [q.teacherId], day: day2, slot: slot2 })) continue;
          const relocated = movePlacement(project, timetableId, blocker.placement, day2, slot2);
          out.push({
            project: placeNormalLesson(relocated, timetableId, classId, h.day, h.slot, subjectId, [q.teacherId]),
            placed: { classId, day: h.day, slot: h.slot, subjectId, teacherIds: [q.teacherId], label: q.label },
          });
          if (out.length >= cap) return out;
        }
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

/** Greedy construct (`fill`) then a bounded validate-gated repair. Returns a FillResult so it
 *  drops into generate()/plan() unchanged. Deterministic per seed; budget-bounded. */
export function solve(project: Project, timetableId: Id, opts?: SolveOptions): FillResult {
  const base = fill(project, timetableId, { seed: opts?.seed });
  let current = base.project;
  const tt0 = current.timetables.find((t) => t.id === timetableId);
  const profile = tt0 && findProfile(current, tt0);
  if (!tt0 || !profile) return base;
  if (totalShortfall(current, tt0) === 0) return base; // already complete — nothing to repair

  const rng = mulberry32((opts?.seed ?? 1) ^ 0x9e3779b9);
  const budgetMs = opts?.budgetMs ?? 2500;
  const startedAt = Date.now();

  // legal (subject, teacher) options per class, from qualifications (the legal-move rule).
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

  const added: FilledPlacement[] = [...base.added];
  let progressing = true;
  while (progressing && Date.now() - startedAt < budgetMs) {
    progressing = false;
    const ttNow = current.timetables.find((t) => t.id === timetableId)!;
    const shortfallBefore = totalShortfall(current, ttNow);
    if (shortfallBefore === 0) break;
    // re-derive the outstanding (class, subject) gaps each sweep (cheap; gaps are few).
    const gaps = requirementCoverage(current, ttNow).filter((c) => c.short > 0);
    for (const gap of gaps) {
      if (Date.now() - startedAt >= budgetMs) break;
      const cands = gapCandidates(current, timetableId, profile, gap.classId, gap.subjectId, qualsByClass.get(gap.classId) ?? [], unavail, rng, 8);
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

  const finalTt = current.timetables.find((t) => t.id === timetableId)!;
  return { project: current, added, remainingShortfall: totalShortfall(current, finalTt), blockers: base.blockers, gapReasons: base.gapReasons };
}
