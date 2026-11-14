/**
 * Staggered punched openings: a wall whose openings change width and position from storey to storey on one module,
 * the "pixelated" brick fronts of 2010s Amsterdam housing towers.
 *
 * Why (2026-11-14, Pontsteiger, feedback a4013653 / 10ada6d9): the kit's window grids (`grid()`, `paneGrid`, the
 * bay kits) repeat one opening per bay up a whole face. The Pontsteiger (Arons en Gelauff, 2019) is the opposite: on
 * a light glazed-brick skin every storey has its own run of openings of two to seven modules, the piers between them
 * one or two modules, the run shifted against the storey below, and some openings are recessed loggias. A uniform
 * 3.7 m grid read as an office block. This lays such a wall out deterministically (seeded), snapped to the module so
 * piers never fall under a minimum, and keeps a clear margin at both ends. Pure layout, no three.js.
 */
export interface StaggerOptions {
  /** Wall length along the face (m). */
  length: number;
  /** Planning module (m); every opening edge and pier is a whole number of modules. */
  module: number;
  /** Opening widths to choose from, in modules. */
  widths: number[];
  /** Pier widths between openings to choose from, in modules. */
  piers: number[];
  /** Solid margin kept at each end of the wall, in modules. */
  edge: number;
  /** Number of storeys. */
  storeys: number;
  /** Seed; the same seed always gives the same wall. */
  seed: number;
  /** Share of openings that are loggias (recessed, balustraded) rather than windows; default 0. */
  loggia?: number;
  /** Per-storey override of `widths` (e.g. the wider penthouse openings of a top storey). */
  widthsFor?: (storey: number) => number[] | undefined;
}

export interface Opening {storey: number; u0: number; u1: number; kind: 'window' | 'loggia'}

/** mulberry32: small, fast, reproducible. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function staggeredOpenings(o: StaggerOptions): Opening[] {
  const {length, module: m, piers, edge, storeys} = o;
  if (!(length > 0 && m > 0 && storeys >= 0 && o.widths.length && piers.length)) throw Error('staggeredOpenings: positive length/module and non-empty widths/piers required');
  if ([...o.widths, ...piers].some(k => !(Number.isInteger(k) && k >= 1))) throw Error('staggeredOpenings: widths and piers are whole modules >= 1');
  const slots = Math.floor(length / m + 1e-9), lead = (length - slots * m) / 2; // centre the module grid on the wall
  const out: Opening[] = [];
  for (let s = 0; s < storeys; s++) {
    const r = rng(o.seed * 7919 + s * 104729 + 1), widths = o.widthsFor?.(s) ?? o.widths;
    const pick = (list: number[]) => list[Math.floor(r() * list.length)];
    // Stagger: each storey starts a different number of modules in, so openings never stack into columns.
    let k = edge + Math.floor(r() * (Math.max(...piers) + 1));
    for (;;) {
      const fits = widths.filter(n => k + n <= slots - edge);
      if (!fits.length) break;
      const n = pick(fits);
      out.push({storey: s, u0: lead + k * m, u1: lead + (k + n) * m, kind: r() < (o.loggia ?? 0) ? 'loggia' : 'window'});
      k += n + pick(piers);
    }
  }
  return out;
}
