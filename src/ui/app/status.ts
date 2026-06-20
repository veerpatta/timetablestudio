// The app's single health signal (UI projection of the two oracles). validate() answers "is
// it legal?" (clashes); coverage answers "is it complete?" (compulsory periods per week). The
// timetable is only "Ready" when BOTH are clean — this is what replaced the misleading green
// "All clear" that ignored empty required cells.

import { totalShortfall } from "../../domain/coverage";
import { validate } from "../../domain/validate";
import type { Project, Timetable } from "../../domain/types";

export type HealthState = "ready" | "clashes" | "incomplete";

export interface Health {
  state: HealthState;
  clashes: number; // hard violations (teacher/class double-booking, unqualified, etc.)
  gaps: number; // total unmet required periods across all classes
  soft: number; // soft (preference) violations — "could be better"
  label: string; // short plain-language summary
  tone: "good" | "warn" | "bad";
}

export function projectHealth(project: Project, timetable: Timetable): Health {
  const v = validate(project, timetable);
  const clashes = v.filter((x) => x.severity === "hard").length;
  const soft = v.filter((x) => x.severity === "soft").length;
  const gaps = totalShortfall(project, timetable);
  if (clashes > 0) {
    return { state: "clashes", clashes, gaps, soft, tone: "bad", label: `${clashes} ${clashes === 1 ? "clash" : "clashes"} to fix` };
  }
  if (gaps > 0) {
    return { state: "incomplete", clashes, gaps, soft, tone: "warn", label: `${gaps} required ${gaps === 1 ? "period" : "periods"} missing` };
  }
  return { state: "ready", clashes, gaps, soft, tone: "good", label: soft > 0 ? "Ready · a few preferences unmet" : "Ready to publish" };
}
