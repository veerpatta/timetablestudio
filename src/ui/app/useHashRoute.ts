import { useEffect, useState } from "react";

/** The hash-routed views (M13). Hash routing works under the GitHub Pages
 * sub-path with no server rewrites and survives refresh — react-router would
 * need an AGENTS §1 justification we don't need for ~20 lines. */
export const VIEWS = [
  "timetable",
  "teachers",
  "classes",
  "quotas",
  "blocks",
  "rules",
  "substitutions",
  "settings",
] as const;

export type View = (typeof VIEWS)[number];

function parseHash(): View {
  const h = window.location.hash.replace(/^#\/?/, "");
  return (VIEWS as readonly string[]).includes(h) ? (h as View) : "timetable";
}

export function useHashRoute(): [View, (v: View) => void] {
  const [view, setView] = useState<View>(parseHash);
  useEffect(() => {
    const onChange = () => setView(parseHash());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  const navigate = (v: View) => {
    window.location.hash = `#/${v}`;
    setView(v);
  };
  return [view, navigate];
}
