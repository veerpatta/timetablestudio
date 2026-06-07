// Seeded PRNG (PURE) — the determinism contract for the solver. NEVER use Math.random
// in solver/ (it would break reproducibility per AGENTS §1). mulberry32 is a tiny, fast,
// well-distributed 32-bit generator; the same seed always yields the same sequence.

export type Rng = () => number; // float in [0, 1)

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
