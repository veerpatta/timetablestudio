// Shared primitives for the legacy viewer's rawData text format. PURE.
// Keeping format (export) and parse (import) in one module guarantees the
// round-trip stays symmetric (DATA_MODEL.md § Legacy export).

import type { Day } from "./types";

export const DAY_TO_LONG: Record<Day, string> = {
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
};

export const LONG_TO_DAY: Record<string, Day> = Object.fromEntries(
  Object.entries(DAY_TO_LONG).map(([short, long]) => [long, short as Day]),
) as Record<string, Day>;

export const FREE = "Free";
export const TEACHER_SEP = " / ";

/** `Subject (T1 / T2)`, or just `Subject` when there are no teachers. */
export function formatCell(subject: string, teachers: string[]): string {
  if (teachers.length === 0) return subject;
  return `${subject} (${teachers.join(TEACHER_SEP)})`;
}

export interface ParsedCell {
  free: boolean;
  subject: string;
  teachers: string[];
}

/** Parse one cell: `Free`, `Subject`, or `Subject (T1 / T2)`. */
export function parseCell(text: string): ParsedCell {
  const trimmed = text.trim();
  if (trimmed === "" || trimmed === FREE) {
    return { free: true, subject: "", teachers: [] };
  }
  const open = trimmed.indexOf("(");
  if (open === -1) {
    return { free: false, subject: trimmed, teachers: [] };
  }
  const subject = trimmed.slice(0, open).trim();
  const close = trimmed.lastIndexOf(")");
  const inside = trimmed.slice(open + 1, close === -1 ? undefined : close);
  const teachers = inside
    .split("/")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  return { free: false, subject, teachers };
}
