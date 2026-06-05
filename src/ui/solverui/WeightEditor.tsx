import { useWeightsStore } from "../../store/weightsStore";
import { useUiStore } from "../../store/uiStore";
import type { SoftWeights } from "../../solver/score";

// Plain-language sentences for everyday users; the S-code is shown only in
// Advanced mode (rule 8: no constraint codes in the default UI).
const LABELS: Record<keyof SoftWeights, { sentence: string; code: string }> = {
  S1: { sentence: "Keep each teacher's day compact (no gaps)", code: "S1" },
  S2: { sentence: "Spread a subject across the week", code: "S2" },
  S3: { sentence: "Put heavy subjects earlier in the day", code: "S3" },
  S4: { sentence: "Balance each teacher's load across days", code: "S4" },
  S5: { sentence: "Avoid the same subject three periods in a row", code: "S5" },
  S6: { sentence: "Avoid the same teacher three periods in a row", code: "S6" },
};

export function WeightEditor() {
  const weights = useWeightsStore((s) => s.weights);
  const setWeight = useWeightsStore((s) => s.setWeight);
  const reset = useWeightsStore((s) => s.reset);
  const advanced = useUiStore((s) => s.advanced);
  const keys = Object.keys(LABELS) as (keyof SoftWeights)[];

  return (
    <section className="rounded border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">What matters most</h3>
        <button type="button" onClick={reset} className="text-xs text-slate-500 hover:underline">
          reset
        </button>
      </div>
      <p className="mb-2 text-xs text-slate-400">Higher = more important when creating timetables.</p>
      <div className="grid grid-cols-1 gap-2">
        {keys.map((k) => (
          <label key={k} className="flex items-center justify-between gap-2 text-xs">
            <span className="text-slate-600">
              {advanced && <span className="mr-1 font-mono text-[10px] text-slate-400">{LABELS[k].code}</span>}
              {LABELS[k].sentence}
            </span>
            <input
              type="number"
              min={0}
              value={weights[k]}
              onChange={(e) => setWeight(k, Number(e.target.value))}
              className="w-16 rounded border border-slate-300 px-1 py-0.5 text-right"
              aria-label={LABELS[k].sentence}
            />
          </label>
        ))}
      </div>
    </section>
  );
}
