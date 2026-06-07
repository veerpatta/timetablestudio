// Cap-must pre-respect for the generator (PURE) — C6. A "cap must" is an enabled MUST
// constraint whose violation can only be INTRODUCED by adding a lesson (never removed),
// so the greedy generator can refuse any candidate that would breach it, using running
// counters seeded from the kept placements. This mirrors the aggregate evaluators in
// constraintAggregates.ts so fill refuses EXACTLY what validate() would flag hard
// (one-oracle discipline, AGENTS §3).
//
// Pre-respected here: every monotone counter cap (teacher week/day/days/consecutive +
// min-free-as-a-cap, subject-per-day, class teachers-per-day, class same-in-a-row) plus
// two cheap local musts (board-protect, not-adjacent). GENUINELY non-monotone musts
// (order/spread/compact/variety/balance) cannot be greedily pre-respected — they are
// surfaced by validate() and reduced by the multi-seed pass (see docs/DECISIONS.md).

import { names, type Names } from "../domain/constraintShared";
import { occupiedSlots, teachingSlots } from "../domain/profile";
import type { Constraint, Day, Id, Placement, Profile, Project, Subject } from "../domain/types";

type SubjectKind = Subject["kind"];

/** A single-class, single-teacher lesson the generator is about to place. */
export interface CapCandidate {
  classId: Id;
  teacherId: Id;
  subjectId: Id;
  day: Day;
  slot: number; // raw slot index
}

/** Pre-respect guard: refuses a candidate that would breach an enabled MUST cap, with a
 *  plain-language reason for the blocker report. forbids() is read-only; commit() records
 *  an accepted placement so later checks see it. */
export interface CapGuard {
  forbids(cand: CapCandidate): string | null;
  commit(cand: CapCandidate): void;
}

interface Guard {
  forbids(cand: CapCandidate): string | null;
  commit(cand: CapCandidate): void;
}

interface GuardCtx {
  units: Unit[];
  teach: number[];
  totalTeaching: number;
  n: Names;
  subjectKind: Map<Id, SubjectKind>;
}

/** A kept lesson, expanded to one entry per occupied slot (a placement spans many slots). */
interface Unit {
  classIds: Id[];
  teacherIds: Id[];
  subjectId: Id;
  day: Day;
  slot: number;
}

/** Length of the maximal run of teach-adjacent slots in `slots` that passes THROUGH `slot`.
 *  Using "through the candidate" (not the global longest) means a pre-existing over-cap run
 *  in the kept placements never blocks an unrelated candidate. teach-index adjacency, never
 *  raw slot numbers (Recess sits mid-array). */
function consecutiveThrough(slot: number, slots: number[], teach: number[]): number {
  const have = new Set(slots.map((s) => teach.indexOf(s)).filter((i) => i >= 0));
  const c = teach.indexOf(slot);
  if (c < 0 || !have.has(c)) return 0;
  let len = 1;
  for (let i = c - 1; have.has(i); i--) len++;
  for (let i = c + 1; have.has(i); i++) len++;
  return len;
}

const push = <K, V>(m: Map<K, V[]>, k: K, v: V): void => {
  (m.get(k) ?? m.set(k, []).get(k)!).push(v);
};

/** A teacher weekly-count cap (shared by max-per-week and min-free, which is the same cap
 *  expressed as `lessons ≤ total − min`). */
function teacherWeekGuard(teacherId: Id, max: number, message: string, x: GuardCtx): Guard {
  let count = x.units.filter((u) => u.teacherIds.includes(teacherId)).length;
  return {
    forbids: (cand) => (cand.teacherId === teacherId && count + 1 > max ? message : null),
    commit: (cand) => {
      if (cand.teacherId === teacherId) count++;
    },
  };
}

function makeGuard(c: Constraint, x: GuardCtx): Guard | null {
  switch (c.template) {
    case "teacher_max_per_week":
      return teacherWeekGuard(c.params.teacherId, c.params.max, `${x.n.t(c.params.teacherId)} would teach more than ${c.params.max} period(s) a week.`, x);

    case "teacher_min_free_per_week":
      return teacherWeekGuard(c.params.teacherId, x.totalTeaching - c.params.min, `${x.n.t(c.params.teacherId)} would have fewer than ${c.params.min} free period(s) a week.`, x);

    case "teacher_max_per_day": {
      const t = c.params.teacherId;
      const max = c.params.max;
      const perDay = new Map<Day, number>();
      for (const u of x.units) if (u.teacherIds.includes(t)) perDay.set(u.day, (perDay.get(u.day) ?? 0) + 1);
      return {
        forbids: (cand) => (cand.teacherId === t && (perDay.get(cand.day) ?? 0) + 1 > max ? `${x.n.t(t)} would teach more than ${max} period(s) on ${cand.day}.` : null),
        commit: (cand) => {
          if (cand.teacherId === t) perDay.set(cand.day, (perDay.get(cand.day) ?? 0) + 1);
        },
      };
    }

    case "teacher_max_days_per_week": {
      const t = c.params.teacherId;
      const max = c.params.max;
      const days = new Set<Day>();
      for (const u of x.units) if (u.teacherIds.includes(t)) days.add(u.day);
      return {
        forbids: (cand) => (cand.teacherId === t && !days.has(cand.day) && days.size + 1 > max ? `${x.n.t(t)} would teach on more than ${max} day(s) a week.` : null),
        commit: (cand) => {
          if (cand.teacherId === t) days.add(cand.day);
        },
      };
    }

    case "teacher_max_consecutive": {
      const t = c.params.teacherId;
      const max = c.params.max;
      const perDay = new Map<Day, number[]>();
      for (const u of x.units) if (u.teacherIds.includes(t)) push(perDay, u.day, u.slot);
      return {
        forbids: (cand) => (cand.teacherId === t && consecutiveThrough(cand.slot, [...(perDay.get(cand.day) ?? []), cand.slot], x.teach) > max ? `${x.n.t(t)} would teach more than ${max} period(s) in a row on ${cand.day}.` : null),
        commit: (cand) => {
          if (cand.teacherId === t) push(perDay, cand.day, cand.slot);
        },
      };
    }

    case "subject_max_per_day": {
      const cls = new Set(c.params.classIds);
      const subs = new Set(c.params.subjectIds);
      const max = c.params.max;
      const perKey = new Map<string, number>(); // `${classId}#${day}`
      for (const u of x.units) if (subs.has(u.subjectId)) for (const cid of u.classIds) if (cls.has(cid)) perKey.set(`${cid}#${u.day}`, (perKey.get(`${cid}#${u.day}`) ?? 0) + 1);
      const matches = (cand: CapCandidate) => cls.has(cand.classId) && subs.has(cand.subjectId);
      const label = c.params.subjectIds.map(x.n.s).join("/");
      return {
        forbids: (cand) => (matches(cand) && (perKey.get(`${cand.classId}#${cand.day}`) ?? 0) + 1 > max ? `${x.n.c(cand.classId)} would have more than ${max} period(s) of ${label} on ${cand.day}.` : null),
        commit: (cand) => {
          if (matches(cand)) {
            const k = `${cand.classId}#${cand.day}`;
            perKey.set(k, (perKey.get(k) ?? 0) + 1);
          }
        },
      };
    }

    case "class_max_teachers_per_day": {
      const cid = c.params.classId;
      const max = c.params.max;
      const perDay = new Map<Day, Set<Id>>();
      for (const u of x.units) if (u.classIds.includes(cid)) for (const t of u.teacherIds) (perDay.get(u.day) ?? perDay.set(u.day, new Set()).get(u.day)!).add(t);
      return {
        forbids: (cand) => {
          if (cand.classId !== cid) return null;
          const set = perDay.get(cand.day);
          if (set?.has(cand.teacherId)) return null; // already counted — no increase
          return (set?.size ?? 0) + 1 > max ? `${x.n.c(cid)} would see more than ${max} different teacher(s) on ${cand.day}.` : null;
        },
        commit: (cand) => {
          if (cand.classId === cid) (perDay.get(cand.day) ?? perDay.set(cand.day, new Set()).get(cand.day)!).add(cand.teacherId);
        },
      };
    }

    case "class_max_consecutive_same": {
      const cid = c.params.classId;
      const max = c.params.max;
      const perDay = new Map<Day, { slot: number; subjectId: Id }[]>();
      for (const u of x.units) if (u.classIds.includes(cid)) push(perDay, u.day, { slot: u.slot, subjectId: u.subjectId });
      const sameRun = (cand: CapCandidate) => {
        const sameSlots = (perDay.get(cand.day) ?? []).filter((it) => it.subjectId === cand.subjectId).map((it) => it.slot);
        return consecutiveThrough(cand.slot, [...sameSlots, cand.slot], x.teach);
      };
      return {
        forbids: (cand) => (cand.classId === cid && sameRun(cand) > max ? `${x.n.c(cid)} would have more than ${max} period(s) of ${x.n.s(cand.subjectId)} in a row on ${cand.day}.` : null),
        commit: (cand) => {
          if (cand.classId === cid) push(perDay, cand.day, { slot: cand.slot, subjectId: cand.subjectId });
        },
      };
    }

    case "class_board_protect": {
      const cid = c.params.classId;
      const core = new Set(c.params.coreSubjectIds);
      const early = new Set(x.teach.slice(0, 3));
      return {
        forbids: (cand) => (cand.classId === cid && early.has(cand.slot) && x.subjectKind.get(cand.subjectId) === "academic" && !core.has(cand.subjectId) ? `${x.n.c(cid)} keeps its first three periods for core subjects (not ${x.n.s(cand.subjectId)}).` : null),
        commit: () => {},
      };
    }

    case "subject_not_adjacent_to": {
      const cid = c.params.classId;
      const a = c.params.subjectAId;
      const b = c.params.subjectBId;
      const perDay = new Map<Day, { slot: number; subjectId: Id }[]>();
      for (const u of x.units) if (u.classIds.includes(cid) && (u.subjectId === a || u.subjectId === b)) push(perDay, u.day, { slot: u.slot, subjectId: u.subjectId });
      const conflicts = (cand: CapCandidate) => {
        if (cand.classId !== cid || (cand.subjectId !== a && cand.subjectId !== b)) return false;
        const other = cand.subjectId === a ? b : a;
        const ci = x.teach.indexOf(cand.slot);
        return (perDay.get(cand.day) ?? []).some((it) => it.subjectId === other && Math.abs(x.teach.indexOf(it.slot) - ci) === 1);
      };
      return {
        forbids: (cand) => (conflicts(cand) ? `${x.n.s(a)} and ${x.n.s(b)} can't be back-to-back for ${x.n.c(cid)}.` : null),
        commit: (cand) => {
          if (cand.classId === cid && (cand.subjectId === a || cand.subjectId === b)) push(perDay, cand.day, { slot: cand.slot, subjectId: cand.subjectId });
        },
      };
    }

    default:
      return null; // genuinely non-monotone (order/spread/compact/variety/balance) — not pre-respected
  }
}

/** Build the combined cap guard for a timetable's enabled MUST constraints, seeded from
 *  the kept placements. Returns a no-op guard when there are no pre-respectable musts. */
export function buildCapGuard(project: Project, profile: Profile, placements: Placement[]): CapGuard {
  const teach = teachingSlots(profile);
  const eventIndex = new Map(project.events.map((e) => [e.id, e]));
  const units: Unit[] = [];
  for (const p of placements) {
    const ev = eventIndex.get(p.eventId);
    if (!ev) continue;
    const slots = occupiedSlots(profile, p.slot, ev.duration);
    if (!slots) continue;
    for (const s of slots) units.push({ classIds: ev.classIds, teacherIds: ev.teacherIds, subjectId: ev.subjectId, day: p.day, slot: s });
  }

  const x: GuardCtx = {
    units,
    teach,
    totalTeaching: profile.days.length * teach.length,
    n: names(project),
    subjectKind: new Map(project.subjects.map((s) => [s.id, s.kind])),
  };

  const guards: Guard[] = [];
  for (const c of project.constraints) {
    if (!c.enabled || c.severity !== "must") continue;
    const g = makeGuard(c, x);
    if (g) guards.push(g);
  }

  return {
    forbids: (cand) => {
      for (const g of guards) {
        const r = g.forbids(cand);
        if (r) return r;
      }
      return null;
    },
    commit: (cand) => {
      for (const g of guards) g.commit(cand);
    },
  };
}
