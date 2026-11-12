/**
 * Seeded side shuffle for the blind critic (lane F4). Each pair's game half goes left (A) or right (B) by a mulberry32
 * stream from the round's seed, so a round is reproducible from (seed, pair order) and the key can be re-derived.
 */
import type { Side } from './vocabulary.ts';

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Which half shows the game, per pair, in the given order. */
export function gameSides(pairs: string[], seed: number): Record<string, Side> {
  const rnd = mulberry32(seed);
  return Object.fromEntries(pairs.map(p => [p, rnd() < 0.5 ? 'A' : 'B']));
}

/** A shuffled presentation order (Fisher-Yates on the same stream family, seed + 1), so neighbours on a street are not adjacent. */
export function presentationOrder<T>(items: T[], seed: number): T[] {
  const rnd = mulberry32((seed + 1) >>> 0), out = [...items];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}
