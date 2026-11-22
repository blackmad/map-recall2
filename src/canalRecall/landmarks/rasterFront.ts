/**
 * A raster front in wall-local coordinates: rows of openings (each row its own spans, so windows need not line up from
 * storey to storey), the stone or concrete piers between them, and the horizontal ledges between the rows, which may
 * stand prouder than the piers and run past the end of the raster. Optionally every pier and ledge is cut into short
 * runs and some runs take a second tone (a mottled or patterned face).
 *
 * Why (2026-11-22, landmarks round 10):
 *  - the former Spaarbank, Singel 542-548 (K.L. Sijmons 1956-61, municipal monument 200738: "Doordat ook de borstweringen
 *    verglaasd zijn, vormt de gevel een uitgesproken modernistisch raster") reads by travertine ledges that stand proud of
 *    the piers and run past the end piers, with two glazed rows per storey: the tall window and a low glazed spandrel.
 *    brickLattice.ts keeps bands at or behind the pier plane and has one opening per storey; wallGrid has no ledges;
 *  - the 2009 tower of Pakhuis Afrika, Oostelijke Handelskade, has an irregular window grid (wide and narrow lights that
 *    shift from storey to storey) in a pale frame with red-brown mottling. The kit had no per-row openings and no way to
 *    tone a frame without a texture.
 *
 * Pure geometry, no three.js. The (t, y) frame of brickLattice.ts and holedWall.ts:
 *   t   along the wall from the viewer's left end (0) to the right end (length), facing the wall from outside;
 *   y   up;
 *   out metres in front of the glass plane; each piece is the box [t0, t1] x [y0, y1] x [out, out + depth].
 * Rows and ledges never overlap in y, and piers live inside their row, so no two pieces share a front plane in (t, y);
 * a ledge and a pier are either flush (one plane) or at least 8 cm apart (geometryAudit zNearTol).
 */
export type RasterRow = {
  /** Row extent (bottom, top); the glass, piers and openings of the row live inside it. */
  y0: number;
  y1: number;
  /** Opening spans [t0, t1] in this row, inside [0, length]; the rest of the row is pier. */
  openings: [number, number][];
  /** Free tag carried onto the row's glass pieces (e.g. 'window', 'spandrel'), so a builder can tint them apart. */
  kind?: string;
};
export type RasterSpec = {
  length: number;
  rows: RasterRow[];
  /** Bottom and top of the raster: a ledge fills [bottom, first row) and (last row, top] when they differ. */
  bottom: number;
  top: number;
  /** Front of the piers and of the ledges in front of the glass plane. */
  pierDepth: number;
  ledgeDepth: number;
  /** How far the ledges run past t = 0 and t = length (default 0). */
  ledgeOverhang?: [number, number];
  /** How far pieces sink behind the glass plane (default 0.12) and the glass thickness (default 0.04). */
  sink?: number;
  glassDepth?: number;
  /** Cut piers and ledges into runs of `minRun`..`maxRun` metres along their long side; a run takes tone 1 with
   *  probability `fraction` (seeded, deterministic). Without it every piece has tone 0 and nothing is cut. */
  mottle?: {seed: number; fraction: number; minRun: number; maxRun: number};
};
export type RasterPart = 'glass' | 'pier' | 'ledge';
export type RasterPiece = {part: RasterPart; t0: number; t1: number; y0: number; y1: number; out: number; depth: number; tone: 0 | 1; kind?: string; row?: number};

const EPS = 1e-6;

/** mulberry32: a small seeded PRNG, so a mottled front is byte-identical from build to build. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Complement of `spans` in [a, b], spans clipped and merged; pieces narrower than `min` are dropped. */
export function complement(spans: [number, number][], a: number, b: number, min = EPS): [number, number][] {
  const s = spans.map(([p, q]) => [Math.max(a, Math.min(p, q)), Math.min(b, Math.max(p, q))] as [number, number]).filter(([p, q]) => q - p > EPS).sort((x, y) => x[0] - y[0]);
  const out: [number, number][] = [];
  let t = a;
  for (const [p, q] of s) { if (p - t > min) out.push([t, p]); t = Math.max(t, q); }
  if (b - t > min) out.push([t, b]);
  return out;
}

export function validateRaster(spec: RasterSpec): void {
  if (!(spec.length > 0)) throw new Error(`rasterFront: empty wall (length ${spec.length})`);
  if (!(spec.top > spec.bottom)) throw new Error('rasterFront: top must be above bottom');
  if (!(spec.pierDepth > 0) || !(spec.ledgeDepth > 0)) throw new Error('rasterFront: piers and ledges stand in front of the glass');
  const step = Math.abs(spec.ledgeDepth - spec.pierDepth);
  if (step > EPS && step < 0.08 - EPS) throw new Error('rasterFront: piers and ledges are flush or at least 8 cm apart');
  let y = spec.bottom;
  for (const [i, r] of spec.rows.entries()) {
    if (!(r.y1 > r.y0)) throw new Error(`rasterFront: row ${i} is empty`);
    if (r.y0 < y - EPS) throw new Error(`rasterFront: row ${i} overlaps the row below or starts under the bottom`);
    for (const [a, b] of r.openings) if (!(b > a) || a < -EPS || b > spec.length + EPS) throw new Error(`rasterFront: row ${i} opening [${a}, ${b}] is empty or off the wall`);
    y = r.y1;
  }
  if (y > spec.top + EPS) throw new Error('rasterFront: the rows run above the top');
  if (spec.mottle && !(spec.mottle.maxRun >= spec.mottle.minRun && spec.mottle.minRun > 0)) throw new Error('rasterFront: mottle runs must be positive and ordered');
}

/** Ledge bands (y0, y1): the gaps between the rows, under the first and over the last. */
export function rasterLedges(spec: Pick<RasterSpec, 'rows' | 'bottom' | 'top'>): [number, number][] {
  const out: [number, number][] = [];
  let y = spec.bottom;
  for (const r of spec.rows) { if (r.y0 - y > EPS) out.push([y, r.y0]); y = r.y1; }
  if (spec.top - y > EPS) out.push([y, spec.top]);
  return out;
}

/** Every glass pane, pier and ledge of the front. */
export function rasterFront(spec: RasterSpec): RasterPiece[] {
  validateRaster(spec);
  const sink = spec.sink ?? 0.12, gd = spec.glassDepth ?? 0.04;
  const [o0, o1] = spec.ledgeOverhang ?? [0, 0];
  const rnd = spec.mottle ? seeded(spec.mottle.seed) : null;
  const pieces: RasterPiece[] = [];
  // Cut [a, b] into runs and tone them; without a mottle one run of tone 0.
  const runs = (a: number, b: number): [number, number, 0 | 1][] => {
    if (!rnd || !spec.mottle) return [[a, b, 0]];
    const {minRun, maxRun, fraction} = spec.mottle;
    const out: [number, number, 0 | 1][] = [];
    let t = a;
    while (b - t > EPS) {
      let e = t + minRun + rnd() * (maxRun - minRun);
      if (b - e < minRun * 0.5) e = b;
      const tone: 0 | 1 = rnd() < fraction ? 1 : 0;
      const last = out[out.length - 1];
      if (last && last[2] === tone) last[1] = Math.min(e, b); else out.push([t, Math.min(e, b), tone]);
      t = Math.min(e, b);
    }
    return out;
  };
  for (const [i, r] of spec.rows.entries()) {
    for (const [a, b] of r.openings) pieces.push({part: 'glass', t0: Math.max(0, a), t1: Math.min(spec.length, b), y0: r.y0, y1: r.y1, out: -gd, depth: gd, tone: 0, ...(r.kind ? {kind: r.kind} : {}), row: i});
    for (const [a, b] of complement(r.openings, 0, spec.length)) {
      // piers are short and upright: cut along y when mottled
      if (!rnd) { pieces.push({part: 'pier', t0: a, t1: b, y0: r.y0, y1: r.y1, out: -sink, depth: sink + spec.pierDepth, tone: 0, row: i}); continue; }
      for (const [p, q, tone] of runs(r.y0, r.y1)) pieces.push({part: 'pier', t0: a, t1: b, y0: p, y1: q, out: -sink, depth: sink + spec.pierDepth, tone, row: i});
    }
  }
  for (const [y0, y1] of rasterLedges(spec)) {
    for (const [p, q, tone] of runs(-o0, spec.length + o1)) pieces.push({part: 'ledge', t0: p, t1: q, y0, y1, out: -sink, depth: sink + spec.ledgeDepth, tone});
  }
  return pieces;
}

/** Openings of width `w` centred on `centres`. */
export function openingsAt(centres: number[], w: number): [number, number][] {
  return centres.map(c => [c - w / 2, c + w / 2]);
}

/** An irregular row: wide windows and narrow slots in a seeded order, split by piers of seeded width (Pakhuis Afrika's tower). */
export type IrregularRowSpec = {
  length: number;
  seed: number;
  /** Solid wall kept at each end (m). */
  margin: number;
  /** Width ranges (m) of a wide window and of a narrow slot, and of the pier between two openings. */
  wide: [number, number];
  narrow: [number, number];
  pier: [number, number];
  /** Share of openings that are narrow slots, 0-1. */
  narrowShare: number;
};

/**
 * Openings of one irregular row, left to right, within [margin, length - margin]. Deterministic per seed; every opening and pier
 * width lies in its range, and the last opening is dropped rather than squeezed when it does not fit, so the right end keeps at
 * least `margin` of wall. Rows with different seeds give the staggered, never-repeating grid of the photo.
 */
export function irregularOpenings(o: IrregularRowSpec): [number, number][] {
  const rnd = seeded(o.seed), pick = ([a, b]: [number, number]) => a + (b - a) * rnd();
  const out: [number, number][] = [];
  let x = o.margin;
  for (;;) {
    const w = pick(rnd() < o.narrowShare ? o.narrow : o.wide);
    if (x + w > o.length - o.margin + EPS) break;
    out.push([x, x + w]);
    x += w + pick(o.pier);
  }
  return out;
}
