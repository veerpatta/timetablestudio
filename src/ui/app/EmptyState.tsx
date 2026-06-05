interface Props {
  onSetup: () => void;
  onImport: () => void;
  onDemo: () => void;
}

const cards = [
  {
    key: "setup",
    title: "Set up my school",
    body: "Enter your days, classes, teachers and weekly subject quotas with a short guided setup.",
    cta: "Start setup",
    accent: "bg-indigo-600 hover:bg-indigo-700",
  },
  {
    key: "import",
    title: "Import existing timetable",
    body: "Load a saved project file, or paste in the rawData your current viewer already uses.",
    cta: "Import…",
    accent: "bg-slate-800 hover:bg-slate-900",
  },
  {
    key: "demo",
    title: "Explore the demo",
    body: "Open a ready-made example school (all six days, no clashes) to look around first.",
    cta: "Open demo",
    accent: "bg-emerald-600 hover:bg-emerald-700",
  },
] as const;

export function EmptyState({ onSetup, onImport, onDemo }: Props) {
  const handlers: Record<string, () => void> = { setup: onSetup, import: onImport, demo: onDemo };
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 py-12">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-semibold text-slate-900">Welcome to Timetable Studio</h1>
        <p className="mt-2 max-w-xl text-sm text-slate-500">
          Build, check and share your school timetable — entirely in your browser. Choose how
          you'd like to begin.
        </p>
      </div>
      <div className="grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <div
            key={c.key}
            className="flex flex-col rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
          >
            <h2 className="text-base font-semibold text-slate-900">{c.title}</h2>
            <p className="mt-2 flex-1 text-sm text-slate-500">{c.body}</p>
            <button
              type="button"
              onClick={handlers[c.key]}
              className={`mt-4 rounded px-3 py-2 text-sm font-medium text-white ${c.accent}`}
            >
              {c.cta}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
