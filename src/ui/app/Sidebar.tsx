import { VIEWS, type View } from "./useHashRoute";

const META: Record<View, { label: string; icon: string }> = {
  timetable: { label: "Timetable", icon: "🗓" },
  teachers: { label: "Teachers", icon: "🧑‍🏫" },
  classes: { label: "Classes", icon: "🏫" },
  quotas: { label: "Subjects & Quotas", icon: "📚" },
  blocks: { label: "Blocks", icon: "🧩" },
  rules: { label: "Rules", icon: "📏" },
  substitutions: { label: "Substitutions", icon: "🔁" },
  settings: { label: "Settings", icon: "⚙️" },
};

/** Persistent navigation. Vertical sidebar on desktop; a horizontally
 * scrollable bar on phones so every view is reachable at 390px (M13 AC). */
export function Sidebar({
  view,
  onNavigate,
}: {
  view: View;
  onNavigate: (v: View) => void;
}) {
  return (
    <nav
      aria-label="Sections"
      className="no-print flex gap-1 overflow-x-auto border-b border-slate-200 bg-white p-2 sm:w-52 sm:shrink-0 sm:flex-col sm:overflow-visible sm:border-b-0 sm:border-r"
    >
      {VIEWS.map((v) => {
        const active = v === view;
        return (
          <button
            key={v}
            type="button"
            onClick={() => onNavigate(v)}
            aria-current={active ? "page" : undefined}
            className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded px-3 py-2 text-sm sm:w-full ${
              active ? "bg-indigo-600 text-white" : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            <span aria-hidden>{META[v].icon}</span>
            {META[v].label}
          </button>
        );
      })}
    </nav>
  );
}
