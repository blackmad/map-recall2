/**
 * Profiled (trapezoidal) metal sheet cladding as vertical ribs in wall-local coordinates, cut round openings.
 *
 * Why: the halls of Amsterdam's harbour and Westpoort estates (The Other Side at Rigakade 10, Toekomstmuziek at
 * Danzigerbocht 29, 2026-11-13) are clad in profiled steel sheet. In every panorama the cladding reads as a field of
 * vertical shadow lines at about a 0.3-0.4 m pitch above a block plinth; a plain flat wall in the same colour reads as
 * concrete. No material slot carries a texture, so the profile is drawn as proud ribs. pressedMetalGrid draws a
 * two-way grid (dimpled panels) and needs horizontal rows; profiled sheet has none, and its ribs must stop at ribbon
 * windows, doors and banners and leave a clear end margin at the corners where the sheets are trimmed.
 *
 * Pure geometry, no three.js; the (t, y) frame of holedWall.ts and pressedMetalGrid.ts: t from the viewer's left
 * end along the wall, y up.
 */
export type RibOpening = {t0: number; t1: number; y0: number; y1: number};
export type Rib = {t0: number; t1: number; y0: number; y1: number};
export type RibSpec = {
  /** Field length along t (metres). */
  length: number;
  /** Bottom and top of the clad field (metres above ground). */
  y0: number; y1: number;
  /** Rib spacing along t (metres). */
  pitch: number;
  /** Rib width along t (metres), below the pitch. */
  rib: number;
  /** Openings, signs or panels the ribs stop at. */
  openings?: RibOpening[];
  /** Clear gap kept between a rib and an opening edge (default 0.05 m). */
  margin?: number;
  /** Clear band at both ends of the field, where the sheets meet the corner trim (default 0.1 m). */
  endMargin?: number;
  /** Rib pieces shorter than this are dropped (default 0.15 m). */
  minHeight?: number;
};

const EPS = 1e-6;

/** Ribs left to right; each column is split round the openings that cross it. */
export function profiledRibs(spec: RibSpec): Rib[] {
  const {length: L, y0, y1, pitch, rib} = spec;
  if (!(L > 0) || !(y1 > y0)) throw new Error(`profiledRibs: empty field (length ${L}, y ${y0}..${y1})`);
  if (!(pitch > 0) || !(rib > 0 && rib < pitch)) throw new Error('profiledRibs: rib width must be positive and below the pitch');
  const m = spec.margin ?? 0.05, end = spec.endMargin ?? 0.1, minH = spec.minHeight ?? 0.15, ops = spec.openings ?? [];
  const usable = L - 2 * end;
  if (usable < rib) return [];
  // as many whole pitches as fit inside the end margins, the remainder split at both ends
  const n = Math.floor(usable / pitch + EPS), off = end + (usable - n * pitch) / 2;
  const out: Rib[] = [];
  for (let k = 0; k < n; k++) {
    const tc = off + (k + 0.5) * pitch, t0 = tc - rib / 2, t1 = tc + rib / 2;
    let pieces: [number, number][] = [[y0, y1]];
    for (const o of ops) {
      if (!(t1 > o.t0 - m && t0 < o.t1 + m)) continue;
      const c = o.y0 - m, d = o.y1 + m, next: [number, number][] = [];
      for (const [p, q] of pieces) {
        if (d <= p || c >= q) { next.push([p, q]); continue; }
        if (c > p) next.push([p, c]);
        if (d < q) next.push([d, q]);
      }
      pieces = next;
    }
    for (const [p, q] of pieces) if (q - p >= minH) out.push({t0, t1, y0: p, y1: q});
  }
  return out;
}
