import { useState } from "react";
import { useUiStore } from "../../store/uiStore";
import { Modal } from "../common/Modal";

const STEPS = [
  {
    title: "Welcome — here's the grid",
    body: "Each row is a class and each column a period. Click any cell to change the lesson there. Use the sidebar to switch between the timetable, teachers, classes, subjects and more.",
  },
  {
    title: "Conflicts show up in red",
    body: "If a teacher is double-booked or a rule is broken, the cell turns red and the bar at the top tells you how many clashes there are. Fix those before you share the timetable.",
  },
  {
    title: "Let the app fill the gaps",
    body: "“Fill the gaps” completes empty periods for you, keeping anything you've pinned (like ELGA). “Create timetables” builds whole options to compare — after a quick pre-flight check.",
  },
  {
    title: "Print what you need",
    body: "The Print button prints whatever you're viewing — the whole school, one class's week, one teacher's week, or a substitution day sheet. You can replay this tour anytime from Settings.",
  },
];

/** First-run guided tour (M14): a simple step-through, dismissible and
 * replayable from Settings. Element-anchored coach marks were intentionally
 * avoided (brittle); the steps describe where to look. */
export function Tour() {
  const tourOpen = useUiStore((s) => s.tourOpen);
  const endTour = useUiStore((s) => s.endTour);
  const [step, setStep] = useState(0);

  if (!tourOpen) return null;
  const s = STEPS[step]!;
  const last = step === STEPS.length - 1;

  return (
    <Modal onClose={endTour} maxWidth="max-w-md" label="Guided tour">
      <div className="p-5">
        <p className="text-xs font-medium text-indigo-600">
          Step {step + 1} of {STEPS.length}
        </p>
        <h2 className="mt-1 text-lg font-semibold">{s.title}</h2>
        <p className="mt-2 text-sm text-slate-600">{s.body}</p>
        <div className="mt-5 flex items-center justify-between">
          <button type="button" onClick={endTour} className="text-sm text-slate-400 hover:text-slate-600">
            Skip
          </button>
          <div className="flex gap-2">
            {step > 0 && (
              <button type="button" onClick={() => setStep((n) => n - 1)} className="rounded border border-slate-300 px-3 py-1 text-sm">
                Back
              </button>
            )}
            <button
              type="button"
              onClick={() => (last ? endTour() : setStep((n) => n + 1))}
              className="rounded bg-indigo-600 px-4 py-1 text-sm font-medium text-white hover:bg-indigo-700"
            >
              {last ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
