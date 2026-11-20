/**
 * Segmental relieving arches over a row of windows, each springing from a stone springer block (aanzetstuk); where two
 * windows stand on a narrow brick pier the neighbouring arches share one springer.
 *
 * Why (2026-11-20, landmark lane oostenburgergracht-15): the St. Willibrordusschool (J. Duncker, 1919; gemeentelijk monument
 * 206026) has "als enige decoratie in het metselwerk ... de zandstenen aanzetstukken van de drie licht getoogde
 * ontlastingsbogen boven de grote raamopeningen": every classroom window is split in three by two brick piers, each light
 * under its own shallow rowlock arch, and the arches meet on light sandstone blocks (panorama
 * recording_2025-06-19_07-14-50_01399 and TMX7316010203-002048_pano_0001_000860). The kit had `segBand` (one arch band)
 * and flat lintels; it could not say "a run of arches on shared springers", so a builder either drew lintels or loose
 * arches that float between the windows. The same motif is on most Amsterdam schools, warehouses and housing blocks of
 * 1880-1925 (Publieke Werken schools, the Berlage and Amsterdam School precursors).
 *
 * Pure layout, no three.js: the builder adapter is scripts/landmarks/relieving-arch-kit.ts. Coordinates are metres in a
 * wall frame: x along the wall (the same axis as the window centres), y up. Nothing changes for models that do not call it.
 */
export interface RelievingArchOptions {
  /** Window centre lines along the wall (m), any order. */
  centres: number[];
  /** Clear width of each window (m). */
  width: number;
  /** Springing height: the window head, where the arch starts (m). */
  springY: number;
  /** Rise of the arch's intrados at the crown above the springing line (m, > 0). */
  rise: number;
  /** Radial depth of the brick rowlock band (m, > 0). */
  thickness: number;
  /** Springer block: `width` across, `height` from its foot, `peak` the pointed top's extra height, `drop` how far the foot sits below the springing line. */
  springer: {width: number; height: number; peak?: number; drop?: number};
}

/** One segmental arch: chord centre, chord (intrados span), springing height, rise and band thickness. */
export interface ArchSegment {centre: number; chord: number; springY: number; rise: number; thickness: number}
/** One springer block: centre x, foot y, width, the square part's height, the pointed top's peak and its outline (x, y). */
export interface SpringerBlock {centre: number; y: number; width: number; height: number; peak: number; outline: [number, number][]}

/**
 * Lay out the arches and springers. A springer sits at each window edge, half a springer width outside it; two springers
 * whose blocks would overlap (a pier narrower than one springer) merge into one centred on the pier, as wide as the pier
 * but never narrower than `springer.width`. Each arch spans between the inner faces of its two springers.
 */
export function relievingArches(o: RelievingArchOptions): {arches: ArchSegment[]; springers: SpringerBlock[]} {
  const {width: W, rise, thickness, springer: S} = o;
  if (!(W > 0 && rise > 0 && thickness > 0 && S.width > 0 && S.height > 0)) throw Error('relievingArches: positive width, rise, thickness and springer size required');
  if (rise > W / 2) throw Error('relievingArches: a segmental arch rises at most half its span');
  const cs = [...o.centres].sort((a, b) => a - b);
  for (let i = 1; i < cs.length; i++) if (cs[i] - cs[i - 1] < W) throw Error('relievingArches: windows overlap');
  const peak = S.peak ?? 0, drop = S.drop ?? 0, y = o.springY - drop;
  // springer centres: [left of window i, right of window i] before merging
  type Raw = {x: number; w: number};
  const raw: Raw[] = [];
  for (const c of cs) raw.push({x: c - W / 2 - S.width / 2, w: S.width}, {x: c + W / 2 + S.width / 2, w: S.width});
  const merged: Raw[] = [];
  // index of the springer to each window's left and right
  const leftOf: number[] = [], rightOf: number[] = [];
  for (let i = 0; i < cs.length; i++) {
    const l = raw[2 * i], r = raw[2 * i + 1], prev = merged[merged.length - 1];
    const pierL = i > 0 ? cs[i] - W / 2 - (cs[i - 1] + W / 2) : Infinity;
    if (prev && pierL < 2 * S.width) {
      const a = cs[i - 1] + W / 2, b = cs[i] - W / 2;
      merged[merged.length - 1] = {x: (a + b) / 2, w: Math.max(S.width, b - a)};
    } else merged.push(l);
    leftOf.push(merged.length - 1);
    merged.push(r);
    rightOf.push(merged.length - 1);
  }
  const springers: SpringerBlock[] = merged.map(m => {
    const h = S.height, hw = m.w / 2;
    const outline: [number, number][] = peak > 0 ? [[-hw, 0], [hw, 0], [hw, h], [0, h + peak], [-hw, h]] : [[-hw, 0], [hw, 0], [hw, h], [-hw, h]];
    return {centre: m.x, y, width: m.w, height: h, peak, outline};
  });
  const arches: ArchSegment[] = cs.map((_, i) => {
    const a = springers[leftOf[i]], b = springers[rightOf[i]];
    const x0 = a.centre + a.width / 2, x1 = b.centre - b.width / 2;
    return {centre: (x0 + x1) / 2, chord: x1 - x0, springY: o.springY, rise, thickness};
  });
  return {arches, springers};
}

/** Intrados height of an arch at x (relative to its springing line), for checks and for fitting glazing under it. */
export function archIntradosAt(a: ArchSegment, x: number): number {
  const half = a.chord / 2, R = (half * half + a.rise * a.rise) / (2 * a.rise), u = x - a.centre;
  if (Math.abs(u) > half) return 0;
  return a.rise - R + Math.sqrt(R * R - u * u);
}
