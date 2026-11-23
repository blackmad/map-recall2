/**
 * Layout of a crow-stepped gable (trapgevel): a stack of tiers, each narrower than the one below by one step on both
 * sides, with a stone coping slab on every tread and across the top.
 *
 * Why (2026-11-23, landmarks r18, old-bell-rembrandtplein): the 1891-92 office of De Eerste Nederlandsche
 * Verzekeringsmaatschappij on the corner of the Rembrandtplein and the Utrechtsestraat (rijksmonument 518404) has "een
 * hoge trapgevel met acht treden" breaking the eaves on the Utrechtsestraat and a smaller stepped crown over the corner
 * oriel; the 2018 panorama TMX7316010203-000716_pano_0001_000026 shows unequal step runs. Builders drew stepped gables
 * as hand loops of boxes with the inset and the coping guessed inline (huis-met-de-hoofden-builder.ts `steppedGable`),
 * so tread counts and coping overhangs drifted per model. This says "n steps a side, these rises and runs" once.
 * Pure layout, no three.js; nothing changes for models that do not call it.
 *
 * Coordinates: t across the gable, 0 at its centre line (negative to the viewer's left); y up.
 */
export interface SteppedGableOptions {
  /** Width of the lowest tier (m). */
  width: number;
  /** Foot of the lowest tier (m). */
  y0: number;
  /** Treads per side; the gable has stepsPerSide + 1 tiers. */
  stepsPerSide: number;
  /** Tier heights, lowest first: one value for all, or stepsPerSide + 1 values. */
  rise: number | readonly number[];
  /** Inset of each step, lowest first: one value for all, or stepsPerSide values. */
  run: number | readonly number[];
  /** Coping slab thickness (m, default 0.12) and its overhang past each tier face (m, default 0.06). */
  coping?: number;
  overhang?: number;
}

export interface GableTier {t0: number; t1: number; y0: number; y1: number}
export interface GableCoping {t0: number; t1: number; y: number; h: number}
export interface SteppedGableLayout {
  /** Tiers lowest first; each is centred on t = 0. */
  tiers: GableTier[];
  /** Coping slabs: per tread one on the left and one on the right (lowest first, left before right), then the top. */
  copings: GableCoping[];
  /** Height of the top coping's upper face. */
  top: number;
}

const list = (v: number | readonly number[], n: number, what: string): number[] => {
  const a = typeof v === 'number' ? Array<number>(n).fill(v) : [...v];
  if (a.length !== n) throw Error(`steppedGable: ${what} needs ${n} values`);
  if (!a.every(x => x > 0)) throw Error(`steppedGable: ${what} must be positive`);
  return a;
};

export function steppedGable(o: SteppedGableOptions): SteppedGableLayout {
  const n = o.stepsPerSide;
  if (!(Number.isInteger(n) && n >= 1)) throw Error('steppedGable: stepsPerSide must be a positive integer');
  if (!(o.width > 0)) throw Error('steppedGable: width must be positive');
  const rises = list(o.rise, n + 1, 'rise'), runs = list(o.run, n, 'run');
  const c = o.coping ?? 0.12, ov = o.overhang ?? 0.06;
  if (!(c > 0 && ov >= 0)) throw Error('steppedGable: coping must be positive, overhang not negative');
  const topHalf = o.width / 2 - runs.reduce((s, r) => s + r, 0);
  if (!(topHalf > 0)) throw Error('steppedGable: the steps leave no top tier');
  const tiers: GableTier[] = [], copings: GableCoping[] = [];
  let half = o.width / 2, y = o.y0;
  for (let k = 0; k <= n; k++) {
    const y1 = y + rises[k];
    tiers.push({t0: -half, t1: half, y0: y, y1});
    if (k < n) {
      const inner = half - runs[k];
      // the tread: from the next tier's face out past this tier's face; the coping sits on the tread
      copings.push({t0: -half - ov, t1: -inner, y: y1, h: c});
      copings.push({t0: inner, t1: half + ov, y: y1, h: c});
      half = inner;
    }
    y = y1;
  }
  copings.push({t0: -half - ov, t1: half + ov, y, h: c});
  return {tiers, copings, top: y + c};
}
