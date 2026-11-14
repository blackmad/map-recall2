/**
 * Warren truss elevation: the chords, end posts and alternating diagonals of a storey-deep truss seen flat in its
 * wall plane (x along the truss from 0, y up from its bottom chord).
 *
 * Why (2026-11-14, Pontsteiger): the skybridge's lowest four storeys are a glazed band crossed by a white Warren truss
 * (diagonals only, no verticals), the building's most recognisable line from the IJ and the Houthavens. The kit had
 * flat bands (wrapBand, bandedCurtain) and bridge frames along a road axis, but no diagonal web in a facade. Pure
 * geometry, no three.js: builders turn each member into a beam (box rotated about the wall normal).
 */
export interface TrussOptions {
  /** Truss length and height (outer edges of chords and posts, m). */
  length: number;
  height: number;
  /** Number of diagonals (>= 1); they alternate up and down starting at the bottom-left node. */
  diagonals: number;
  /** Member width in the wall plane (m). */
  member: number;
}

/** A straight member from (x0, y0) to (x1, y1) along its centre line, `w` wide. */
export interface TrussMember {x0: number; y0: number; x1: number; y1: number; w: number; kind: 'chord' | 'post' | 'diagonal'}

export function warrenTruss(o: TrussOptions): TrussMember[] {
  const {length: L, height: H, diagonals: n, member: m} = o;
  if (!(L > 0 && H > 2 * m && n >= 1 && Number.isInteger(n) && m > 0 && L > 2 * m)) throw Error('warrenTruss: positive size, integer diagonals, members thinner than the truss');
  const out: TrussMember[] = [
    {x0: 0, y0: m / 2, x1: L, y1: m / 2, w: m, kind: 'chord'},
    {x0: 0, y0: H - m / 2, x1: L, y1: H - m / 2, w: m, kind: 'chord'},
    {x0: m / 2, y0: m, x1: m / 2, y1: H - m, w: m, kind: 'post'},
    {x0: L - m / 2, y0: m, x1: L - m / 2, y1: H - m, w: m, kind: 'post'},
  ];
  // Nodes on the chords' inner edges, between the posts' inner edges.
  const a = m, b = L - m, lo = m, hi = H - m, p = (b - a) / n;
  for (let k = 0; k < n; k++) {
    const up = k % 2 === 0;
    out.push({x0: a + k * p, y0: up ? lo : hi, x1: a + (k + 1) * p, y1: up ? hi : lo, w: m, kind: 'diagonal'});
  }
  return out;
}
