import { useWeightsStore } from "../../store/weightsStore";
import type { SoftWeights } from "../../solver/score";

const LABELS: Record<keyof SoftWeights, string> = {
  S1: "S1 · No teacher gaps",
  S2: "S2 · Subject spread",
  S3: "S3 · Heavy subjects early",
  S4: "S4 · Teacher week balance",
  S5: "S5 · No triple repeat",
  S6: "S6 · Class variety",
};

export function WeightEditor() {
  const weights = useWeightsStore((s) => s.weights);
  const setWeight = useWeightsStore((s) => s.setWeight);
  const reset = useWeightsStore((s) => s.reset);
  const keys = Object.keys(LABELS) as (keyof SoftWeights)[];

  return (
    <section className="rounded border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Soft-constraint weights</h3>
        <button type="button" onClick={reset} className="text-xs text-slate-500 hover:underline">
          reset
        </button>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {keys.map((k) => (
          <label key={k} className="flex items-center justify-between gap-2 text-xs">
            <span className="text-slate-600">{LABELS[k]}</span>
            <input
              type="number"
              min={0}
              value={weights[k]}
              onChange={(e) => setWeight(k, Number(e.target.value))}
              className="w-16 rounded border border-slate-300 px-1 py-0.5 text-right"
              aria-label={LABELS[k]}
            />
          </label>
        ))}
      </div>
    </section>
  );
}
