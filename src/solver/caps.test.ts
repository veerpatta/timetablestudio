// C6 — the generator HONOURS every enabled MUST it can pre-respect, and explains in plain
// language what it can't. These tests assert the one-oracle property (fill never produces a
// hard cap violation it claims to honour) generically across templates, the canonical
// infeasible case (cap below a teacher's forced load → blocker names the teacher + cap, 0
// hard), the generous case (a slack cap changes nothing), and that electives stay legal.

import { describe, expect, it } from "vitest";
import { findProfile } from "../domain/derive";
import { teachingSlots } from "../domain/profile";
import { validate } from "../domain/validate";
import { seedArtsElectives } from "../domain/electives";
import { buildBundledProject } from "../fixtures/bundled";
import type { Constraint, Id, Project } from "../domain/types";
import { fill } from "./fill";

const ttId = (p: Project) => p.activeTimetableId!;
const tableOf = (p: Project) => p.timetables.find((t) => t.id === ttId(p))!;
const hardOf = (p: Project, template?: string) =>
  validate(p, tableOf(p)).filter((v) => v.severity === "hard" && (!template || v.constraintId === template)).length;

const must = (template: Constraint["template"], params: unknown): Constraint =>
  ({ id: `test:${template}`, scope: "teacher", severity: "must", weight: 1, enabled: true, template, params } as Constraint);

const withConstraint = (p: Project, c: Constraint): Project => ({ ...p, constraints: [...p.constraints, c] });

/** Clear every non-pinned NORMAL whole-class lesson (leaves electives/study/joint/team/pinned). */
function clearNormals(base: Project): Project {
  const ids = new Set(base.events.filter((e) => e.type === "normal" && !e.studentGroupIds).map((e) => e.id));
  return {
    ...base,
    timetables: base.timetables.map((t) =>
      t.id === ttId(base) ? { ...t, placements: t.placements.filter((pl) => pl.pinned || !ids.has(pl.eventId)) } : t,
    ),
  };
}

/** Drop a single teacher's normal lessons (the "clear their class" of the AC). */
function clearTeacherNormals(base: Project, teacherId: Id): Project {
  const ids = new Set(base.events.filter((e) => e.type === "normal" && e.teacherIds.includes(teacherId)).map((e) => e.id));
  return {
    ...base,
    timetables: base.timetables.map((t) =>
      t.id === ttId(base) ? { ...t, placements: t.placements.filter((pl) => !ids.has(pl.eventId)) } : t,
    ),
  };
}

/** Teachers who appear in a pinned / joint_class / team_block event — excluded from the
 *  forced-load pick so the cleared input starts at zero of the teacher's lessons. */
function lockedTeachers(p: Project): Set<Id> {
  const lockedEv = new Set(p.events.filter((e) => e.type === "joint_class" || e.type === "team_block").map((e) => e.id));
  for (const pl of tableOf(p).placements) if (pl.pinned) lockedEv.add(pl.eventId);
  const out = new Set<Id>();
  for (const e of p.events) if (lockedEv.has(e.id)) for (const t of e.teacherIds) out.add(t);
  return out;
}

/** Forced weekly load = periods a teacher MUST carry because they're the sole schedulable
 *  qualified teacher for a (class, subject) requirement. A cap below this is truly infeasible.
 *  Electives are excluded: their option-line slots interact with self-study shadows, so a
 *  cleared elective reads as "class full" not "teacher capped" — the wrong shape for this AC. */
function forcedLoads(p: Project): Map<Id, number> {
  const schedulable = new Set(p.teachers.filter((t) => t.schedulable).map((t) => t.id));
  const electiveSubjects = new Set(p.events.filter((e) => e.studentGroupIds).map((e) => e.subjectId));
  const byCS = new Map<string, Id[]>();
  for (const q of p.qualifications) {
    if (!schedulable.has(q.teacherId)) continue;
    const k = `${q.classId}|${q.subjectId}`;
    (byCS.get(k) ?? byCS.set(k, []).get(k)!).push(q.teacherId);
  }
  const forced = new Map<Id, number>();
  for (const r of p.requirements) {
    if (electiveSubjects.has(r.subjectId)) continue;
    const ts = byCS.get(`${r.classId}|${r.subjectId}`);
    if (ts && ts.length === 1) forced.set(ts[0]!, (forced.get(ts[0]!) ?? 0) + r.periodsPerWeek);
  }
  return forced;
}

function pickForcedTeacher(base: Project): { teacherId: Id; forced: number } {
  const locked = lockedTeachers(base);
  const [teacherId, forced] = [...forcedLoads(base).entries()]
    .filter(([t]) => !locked.has(t))
    .sort((a, b) => b[1] - a[1])[0]!;
  return { teacherId, forced };
}

describe("C6 — cap-musts are pre-respected (one-oracle: fill never breaks a must it can honour)", () => {
  const base = buildBundledProject();
  const profile = findProfile(base, tableOf(base))!;
  const total = profile.days.length * teachingSlots(profile).length;
  const { teacherId } = pickForcedTeacher(base);
  // a class with several distinct academic subjects, for the class/subject templates
  const klass = base.classes.find((c) => base.requirements.filter((r) => r.classId === c.id).length >= 3)!;
  const academics = base.requirements
    .filter((r) => r.classId === klass.id && base.subjects.find((s) => s.id === r.subjectId)?.kind === "academic")
    .map((r) => r.subjectId);
  const [subjA, subjB] = [academics[0]!, academics[1]!];

  const TIGHT: Constraint[] = [
    must("teacher_max_per_week", { teacherId, max: 1 }),
    must("teacher_max_per_day", { teacherId, max: 1 }),
    must("teacher_max_days_per_week", { teacherId, max: 1 }),
    must("teacher_max_consecutive", { teacherId, max: 1 }),
    must("teacher_min_free_per_week", { teacherId, min: total - 1 }),
    must("subject_max_per_day", { classIds: [klass.id], subjectIds: [subjA], max: 0 }),
    must("class_max_teachers_per_day", { classId: klass.id, max: 1 }),
    must("class_max_consecutive_same", { classId: klass.id, max: 1 }),
    must("class_board_protect", { classId: klass.id, coreSubjectIds: [subjA] }),
    must("subject_not_adjacent_to", { classId: klass.id, subjectAId: subjA, subjectBId: subjB }),
  ];

  for (const c of TIGHT) {
    it(`fill introduces no hard violation of a tight must "${c.template}"`, () => {
      const cleared = withConstraint(clearNormals(base), c);
      const before = hardOf(cleared, c.template);
      const res = fill(cleared, ttId(base), { seed: 5 });
      const after = hardOf(res.project, c.template);
      expect(after).toBeLessThanOrEqual(before); // fill never makes a pre-respected must worse
    });
  }
});

describe("C6 — infeasible cap produces a plain-language blocker, never an illegal grid", () => {
  it("teacher cap below the forced load → blocker names the teacher + limit, 0 hard, gaps left", () => {
    const base = buildBundledProject();
    const { teacherId, forced } = pickForcedTeacher(base);
    expect(forced).toBeGreaterThanOrEqual(2); // the data really does force a specialist

    const cleared = clearTeacherNormals(base, teacherId);
    const cap = must("teacher_max_per_week", { teacherId, max: forced - 1 });
    const res = fill(withConstraint(cleared, cap), ttId(base), { seed: 7 });

    expect(hardOf(res.project, "teacher_max_per_week")).toBe(0); // honoured the cap
    expect(res.remainingShortfall).toBeGreaterThan(0); // infeasible → honest gaps
    const name = base.teachers.find((t) => t.id === teacherId)!.name;
    expect(res.blockers.some((b) => b.includes(name) && b.includes(String(forced - 1)))).toBe(true);
  });

  it("a generous cap is non-binding — changes neither the fill nor the shortfall", () => {
    const base = buildBundledProject();
    const { teacherId, forced } = pickForcedTeacher(base);
    const cleared = clearTeacherNormals(base, teacherId);

    const baseline = fill(cleared, ttId(base), { seed: 7 });
    const generous = fill(withConstraint(cleared, must("teacher_max_per_week", { teacherId, max: forced + 50 })), ttId(base), { seed: 7 });

    expect(hardOf(generous.project, "teacher_max_per_week")).toBe(0);
    expect(generous.remainingShortfall).toBe(baseline.remainingShortfall);
    expect(generous.added.length).toBe(baseline.added.length);
  });
});

describe("C6 — electives stay legal when a class is regenerated", () => {
  it("clearing + refilling Class 11 Arts keeps 0 hard and never puts a whole-class lesson in an option-line slot", () => {
    const base = seedArtsElectives(buildBundledProject()); // exercise the optional elective model
    const arts = "Class 11 Arts";
    // option-line slots = where a group-scoped (elective) event runs for the class
    const electiveEv = new Set(base.events.filter((e) => e.studentGroupIds && e.classIds.includes(arts)).map((e) => e.id));
    const optionSlots = new Set(tableOf(base).placements.filter((p) => electiveEv.has(p.eventId)).map((p) => `${p.day}#${p.slot}`));
    expect(optionSlots.size).toBeGreaterThan(0);

    // clear the class's ordinary (non-elective) lessons, then regenerate
    const ids = new Set(base.events.filter((e) => e.type === "normal" && !e.studentGroupIds && e.classIds.includes(arts)).map((e) => e.id));
    const cleared: Project = {
      ...base,
      timetables: base.timetables.map((t) => (t.id === ttId(base) ? { ...t, placements: t.placements.filter((pl) => pl.pinned || !ids.has(pl.eventId)) } : t)),
    };
    const res = fill(cleared, ttId(base), { seed: 11 });

    expect(hardOf(res.project)).toBe(0);
    expect(res.added.some((a) => a.classId === arts && optionSlots.has(`${a.day}#${a.slot}`))).toBe(false);
  });
});
