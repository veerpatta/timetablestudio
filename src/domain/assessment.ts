// Assessment engine (PURE) — M25. Turns a placed timetable into structured pros/cons
// across five dimensions plus a 0–100 health score. Pure: no framework imports, no
// Math.random, no Date. Layering: domain/ only; callers in solver/ or ui/ import from here.

import { coverageGaps } from "./coverage";
import { deriveMaps, findProfile } from "./derive";
import { diffProjects } from "./diffTimetables";
import { allTeacherLoads, loadBalance } from "./insights";
import { teachingSlots } from "./profile";
import type { Id, Project, Timetable } from "./types";
import { validate } from "./validate";

// --- Public types (co-located, not in domain/types.ts — Assessment is computed, not stored) ---

export type Dimension = "teacherFairness" | "pedagogy" | "boardProtection" | "stability" | "coverage";

export interface Highlight {
  dimension: Dimension;
  polarity: "advantage" | "disadvantage";
  weight: number; // contribution to sort order and score delta
  message: string; // plain language, no constraint codes
  entityRefs: { type: string; id: string }[];
}

export type ScoreBand = "Great" | "Good" | "Fair" | "Poor";

export interface Assessment {
  score: number; // 0–100
  band: ScoreBand;
  summary: string; // one sentence
  advantages: Highlight[]; // sorted by weight desc
  disadvantages: Highlight[]; // sorted by weight desc
}

// --- Internal penalty weights (M26 will inject preset overrides via opts) ---
const W = {
  coverageGapPeriod: 8,
  hardViolation: 5,
  softViolation: 1,
  fairnessThreshold: 4, // spread ≤ this → balanced
  fairnessExcessPerPeriod: 0.5,
  diffLargeThreshold: 10, // diffs above this → disadvantage
  diffCellPenalty: 0.05,
  boardLateAcademic: 2,
} as const;

function scoreBand(score: number): ScoreBand {
  if (score >= 80) return "Great";
  if (score >= 60) return "Good";
  if (score >= 40) return "Fair";
  return "Poor";
}

// --- Main function ---

export function assessTimetable(
  project: Project,
  timetableId: Id,
  opts?: { baseline?: Timetable },
): Assessment {
  const timetable = project.timetables.find((t) => t.id === timetableId);
  if (!timetable) {
    return { score: 0, band: "Poor", summary: "Timetable not found.", advantages: [], disadvantages: [] };
  }

  const advantages: Highlight[] = [];
  const disadvantages: Highlight[] = [];
  let penalty = 0;

  // ── Coverage ────────────────────────────────────────────────────────────────
  const gaps = coverageGaps(project, timetable);
  if (gaps.length === 0) {
    advantages.push({
      dimension: "coverage",
      polarity: "advantage",
      weight: 20,
      message: "All required periods are placed — full coverage.",
      entityRefs: [],
    });
  } else {
    for (const g of gaps) {
      const w = g.short * W.coverageGapPeriod;
      penalty += w;
      disadvantages.push({
        dimension: "coverage",
        polarity: "disadvantage",
        weight: w,
        message: g.message,
        entityRefs: [
          { type: "class", id: g.classId },
          { type: "subject", id: g.subjectId },
        ],
      });
    }
  }

  // ── Teacher fairness ────────────────────────────────────────────────────────
  const loads = allTeacherLoads(project, timetable);
  const balance = loadBalance(project, timetable);
  if (loads.length > 1) {
    if (balance.spread <= W.fairnessThreshold) {
      advantages.push({
        dimension: "teacherFairness",
        polarity: "advantage",
        weight: 10,
        message: `Teacher loads are balanced — range ${balance.min}–${balance.max} periods (avg ${Math.round(balance.avg)}).`,
        entityRefs: [],
      });
    } else {
      const w = Math.round((balance.spread - W.fairnessThreshold) * W.fairnessExcessPerPeriod);
      penalty += w;
      const maxTeacher = loads.find((l) => l.used === balance.max);
      const minTeacher = loads.find((l) => l.used === balance.min);
      disadvantages.push({
        dimension: "teacherFairness",
        polarity: "disadvantage",
        weight: w,
        message: `Teacher loads are uneven — ${minTeacher?.name ?? "?"} has ${balance.min} periods but ${maxTeacher?.name ?? "?"} has ${balance.max}.`,
        entityRefs: [
          ...(maxTeacher ? [{ type: "teacher", id: maxTeacher.teacherId }] : []),
          ...(minTeacher ? [{ type: "teacher", id: minTeacher.teacherId }] : []),
        ],
      });
    }
  }

  // ── Pedagogy: soft violations from validate() ──────────────────────────────
  // Hard violations are also penalised (they represent broken strict constraints).
  const violations = validate(project, timetable);
  const hardCount = violations.filter((v) => v.severity === "hard").length;
  const softViolations = violations.filter((v) => v.severity === "soft");
  penalty += hardCount * W.hardViolation;
  penalty += softViolations.length * W.softViolation;

  if (softViolations.length === 0) {
    advantages.push({
      dimension: "pedagogy",
      polarity: "advantage",
      weight: 10,
      message: "All preference rules are satisfied.",
      entityRefs: [],
    });
  } else {
    const shown = softViolations.slice(0, 3);
    for (const v of shown) {
      disadvantages.push({
        dimension: "pedagogy",
        polarity: "disadvantage",
        weight: W.softViolation,
        message: v.message,
        entityRefs: v.slots.flatMap((s) => [
          ...(s.classId ? [{ type: "class", id: s.classId }] : []),
          ...(s.teacherId ? [{ type: "teacher", id: s.teacherId }] : []),
        ]),
      });
    }
    const remaining = softViolations.length - shown.length;
    if (remaining > 0) {
      disadvantages.push({
        dimension: "pedagogy",
        polarity: "disadvantage",
        weight: remaining * W.softViolation,
        message: `${remaining} more preference ${remaining === 1 ? "rule" : "rules"} not satisfied.`,
        entityRefs: [],
      });
    }
  }

  // ── Board protection ────────────────────────────────────────────────────────
  // Heuristic: for board classes, academic subjects in the last quarter of the day
  // are a scheduling concern (exams require focus; board prep is morning-heavy).
  const profile = findProfile(project, timetable);
  const boardClasses = project.classes.filter((c) => c.isBoardClass);
  if (boardClasses.length > 0 && profile) {
    const teach = teachingSlots(profile);
    const lateSlots = new Set(teach.slice(Math.floor((teach.length * 3) / 4)));
    const maps = deriveMaps(project, timetable);
    let boardIssueCount = 0;
    for (const bc of boardClasses) {
      const cells = maps.classCells.get(bc.id);
      if (!cells) continue;
      for (const [key, occ] of cells) {
        const slotNum = Number(key.split("#")[1]);
        if (!lateSlots.has(slotNum)) continue;
        const ev = occ[0]?.event;
        if (!ev) continue;
        const subj = project.subjects.find((s) => s.id === ev.subjectId);
        if (subj?.kind !== "academic") continue;
        penalty += W.boardLateAcademic;
        boardIssueCount++;
        disadvantages.push({
          dimension: "boardProtection",
          polarity: "disadvantage",
          weight: W.boardLateAcademic,
          message: `${bc.name} has ${subj.name} in a late period — board class academic subjects are better scheduled earlier.`,
          entityRefs: [
            { type: "class", id: bc.id },
            { type: "subject", id: ev.subjectId },
          ],
        });
      }
    }
    if (boardIssueCount === 0) {
      advantages.push({
        dimension: "boardProtection",
        polarity: "advantage",
        weight: 8,
        message: `Board ${boardClasses.length === 1 ? "class" : "classes"} (${boardClasses.map((c) => c.name).join(", ")}) have academic subjects in earlier periods.`,
        entityRefs: boardClasses.map((c) => ({ type: "class", id: c.id })),
      });
    }
  }

  // ── Stability ───────────────────────────────────────────────────────────────
  if (opts?.baseline) {
    const baseline = opts.baseline;
    // diffProjects reads activeTimetableId from each project to find the compared timetable.
    const beforeProject: Project = { ...project, activeTimetableId: baseline.id, timetables: [baseline] };
    const afterProject: Project = { ...project, activeTimetableId: timetableId };
    const diffs = diffProjects(beforeProject, afterProject);
    if (diffs.length <= W.diffLargeThreshold) {
      advantages.push({
        dimension: "stability",
        polarity: "advantage",
        weight: diffs.length === 0 ? 10 : 5,
        message:
          diffs.length === 0
            ? "This timetable matches your baseline exactly — zero disruption."
            : `Only ${diffs.length} ${diffs.length === 1 ? "cell differs" : "cells differ"} from your baseline — minimal disruption.`,
        entityRefs: [],
      });
    } else {
      const w = Math.max(1, Math.round(diffs.length * W.diffCellPenalty));
      penalty += w;
      disadvantages.push({
        dimension: "stability",
        polarity: "disadvantage",
        weight: w,
        message: `This timetable moves ${diffs.length} cells from your baseline — significant disruption.`,
        entityRefs: [],
      });
    }
  }

  // ── Final score ─────────────────────────────────────────────────────────────
  const score = Math.max(0, Math.min(100, Math.round(100 - penalty)));
  const band = scoreBand(score);
  advantages.sort((a, b) => b.weight - a.weight);
  disadvantages.sort((a, b) => b.weight - a.weight);

  const shortfall = gaps.reduce((s, g) => s + g.short, 0);
  const topDis = disadvantages[0];
  const summary =
    shortfall > 0
      ? `${band} — ${shortfall} period${shortfall === 1 ? "" : "s"} missing.`
      : topDis
        ? `${band} — ${(topDis.message.split(".")[0] ?? topDis.message)}.`
        : `${band} — timetable looks healthy.`;

  return { score, band, summary, advantages, disadvantages };
}
