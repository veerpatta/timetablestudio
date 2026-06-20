// The app's top-level sections (OVERHAUL C). Kept in one place so the shell, dashboard, and
// step links agree on the route names.

export type Section = "home" | "timetable" | "generate" | "setup" | "insights" | "reports" | "tools";

export const SECTIONS: { id: Section; label: string; group: "main" | "more" }[] = [
  { id: "home", label: "Home", group: "main" },
  { id: "setup", label: "Setup", group: "main" },
  { id: "generate", label: "Generate", group: "main" },
  { id: "timetable", label: "Timetable", group: "main" },
  { id: "insights", label: "Insights", group: "more" },
  { id: "reports", label: "Reports", group: "more" },
  { id: "tools", label: "Tools", group: "more" },
];
