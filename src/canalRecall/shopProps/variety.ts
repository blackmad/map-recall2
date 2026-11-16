// Per-window variety (lane shop-goods-20261116; David 2026-11-16: "we need to not repeat the exact same thing in every
// window"). Every bay of a front takes its own seed from the pand and the bay index, so the goods differ window to
// window and stay stable across world compiles. None of this changes a template's triangle count.
import { hash01 } from './kit.js';

/** The seed of bay `bay` of the pand seeded `seed`; the first bay keeps the pand's own seed (its goods as before). */
export const baySeed = (seed: string, bay: number): string => (bay === 0 ? seed : `${seed}:bay${bay}`);

/**
 * The goods cell's uv rect for tile `tile` of bay `bay`: a seeded sub-window of the cell (up to 22 % narrower, shifted
 * along it, and up to 6 % shorter, shifted up or down) and a seeded mirror, in place of the plain alternation, so two
 * tiles show different stretches of the same shelf. The window keeps the cell's aspect within 25 %.
 */
export function goodsTileRect(rect: readonly [number, number, number, number], seed: string, bay: number, tile: number): [number, number, number, number] {
  const r = (k: string) => hash01(`${baySeed(seed, bay)}:t${tile}:${k}`);
  const [u0, v0, u1, v1] = rect, du = u1 - u0, dv = v1 - v0;
  const cu = 0.22 * r('cu'), cv = 0.06 * r('cv'), su = cu * r('su'), sv = cv * r('sv');
  const a = u0 + du * su, b = u1 - du * (cu - su), c = v0 + dv * sv, d = v1 - dv * (cv - sv);
  return r('flip') < 0.5 ? [a, c, b, d] : [b, c, a, d];
}
