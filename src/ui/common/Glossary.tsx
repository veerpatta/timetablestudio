import { useState } from "react";

/** Plain-language definitions of the few terms a non-technical user meets (M14). */
export const TERMS = {
  quota: "How many periods a week a class gets of a subject — its weekly target.",
  block: "A lesson several classes attend together (like ELGA). It keeps its teachers busy for the whole time and moves as one piece.",
  draft: "A version of the timetable. You can keep several drafts and switch between them without losing your work.",
  pin: "A locked lesson. Filling the gaps and creating timetables will never move a pinned lesson.",
  rule: "A plain-language constraint your timetable should follow — e.g. ‘Maths only in periods 1–3’. ‘Must’ rules are strict; ‘Prefer’ rules are gentle nudges.",
} as const;

export type Term = keyof typeof TERMS;

/** A small "?" that reveals a one-line definition. Click to toggle (works on
 * touch); the popover is a tooltip for screen readers. */
export function Glossary({ term }: { term: Term }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-block align-middle">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setOpen(false)}
        aria-label={`What does "${term}" mean?`}
        className="ml-1 h-4 w-4 rounded-full border border-slate-300 text-[10px] leading-none text-slate-500 hover:bg-slate-100"
      >
        ?
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute left-0 top-5 z-30 w-56 rounded border border-slate-200 bg-white p-2 text-xs font-normal text-slate-600 shadow-lg"
        >
          <span className="font-semibold capitalize">{term}: </span>
          {TERMS[term]}
        </span>
      )}
    </span>
  );
}
