/**
 * A brick lattice front in wall-local coordinates: brick piers and spandrel bands standing proud of a recessed glass
 * plane, so every opening has a real reveal, with a kind per bay:
 *   window   a punched window per storey (sill, head), with optional glazing bars (cross mullion, transoms);
 *   balcony  full-height balcony doors behind a projecting slab with a balustrade;
 *   loggia   an open recess: deep piers either side, a floor slab and a railing at the front, no glazing bars;
 *   shop     ground-floor shop glazing (one tall opening per bay, a band over it);
 *   blank    solid brick.
 *
 * Why: the 2016-2019 Zuidas housing towers (Xavier, K en K Architecten) read by a brick lattice with deep reveals,
 * stacks of projecting balconies and recessed loggias. The facade systems draw a flat wall with windows laid on it
 * (no reveal) or a curtain wall; gridFacade has one window kind and no balconies or loggias. Pure geometry, no three.js;
 * the same (t, y) frame as bandedCurtain.ts and holedWall.ts:
 *   t   along the wall from the viewer's left end (0) to the right end (length), facing the wall from outside;
 *   y   up;
 *   out metres in front of the glass plane (the wall plane is the glass), `depth` the piece's thickness from `out`.
 * Every piece is a box [t0, t1] x [y0, y1] x [out, out + depth]; pieces on the glass plane start behind it (`sink`). Pieces that overlap in (t, y) never share a front plane:
 * piers stand `pierDepth`, bands `bandDepth`, and the spec rejects a difference under 5 cm (z-fighting).
 */
export type LatticeBayKind = 'window' | 'balcony' | 'loggia' | 'shop' | 'blank';
export type LatticeBay = {kind: LatticeBayKind; width: number};
export type LatticeSpec = {
  length: number;
  /** Storey floor levels bottom-up; the last value is the top of the lattice (no storey starts there). */
  floors: number[];
  /** Bays left to right; widths are scaled to fill `length`. */
  bays: LatticeBay[];
  /** Window opening width inside a window bay (centred) and its sill/head above the storey floor. */
  /** Glazing bars: `through` runs each transom across the whole window over the vertical bars (one piece instead of n + 1;
   *  the overlap is the same material on one plane, which cannot show), else transoms stop at the bars. */
  window: {width: number; sill: number; head: number; bars?: {vertical: number; transoms: number; through?: boolean}};
  /** Opening width of a balcony / loggia / shop bay = bay width minus this (the piers either side). */
  bayPier: number;
  /** Head of the balcony doors / loggia opening / shop glazing above the floor. */
  doorHead: number;
  pierDepth: number;
  bandDepth: number;
  loggia?: {depth: number; railing: number};
  balcony?: {depth: number; slab: number; balustrade: number};
  /** Glazing bars of the balcony doors / shop glazing: one per this many metres. */
  doorBarPitch?: number;
  bar?: {w: number; depth: number};
  /** How far pieces that start on the glass plane sink behind it, per part (defaults 0.15 / 0.21 / 0.03 / 0.1). */
  sink?: Partial<{pier: number; band: number; bar: number; loggia: number}>;
};
export type LatticePart = 'pier' | 'band' | 'bar' | 'balconySlab' | 'balustrade' | 'loggiaSlab' | 'railing';
export type LatticePiece = {part: LatticePart; t0: number; t1: number; y0: number; y1: number; out: number; depth: number};
export type LatticeOpening = {kind: LatticeBayKind; t0: number; t1: number; y0: number; y1: number};

const EPS = 1e-6;
/** Openings lower than this are not drawn: the storey is a parapet or a sliver between slabs. */
export const MIN_OPENING_H = 0.6;

/** Bay spans [t0, t1] scaled so the widths fill `length`. */
export function latticeBays(spec: Pick<LatticeSpec, 'length' | 'bays'>): (LatticeBay & {t0: number; t1: number})[] {
  const total = spec.bays.reduce((a, b) => a + b.width, 0);
  if (!(total > 0)) throw new Error('brickLattice: no bays');
  const k = spec.length / total;
  let t = 0;
  return spec.bays.map(b => { const t0 = t; t += b.width * k; return {...b, t0, t1: t}; });
}

/** Openings (glass seen through the lattice) per storey and bay, bottom-up. */
export function latticeOpenings(spec: LatticeSpec): LatticeOpening[] {
  const out: LatticeOpening[] = [];
  const bays = latticeBays(spec);
  for (let s = 0; s + 1 < spec.floors.length; s++) {
    const f = spec.floors[s], next = spec.floors[s + 1];
    for (const b of bays) {
      if (b.kind === 'blank') continue;
      const c = (b.t0 + b.t1) / 2;
      const w = b.kind === 'window' ? Math.min(spec.window.width, b.t1 - b.t0 - 0.2) : b.t1 - b.t0 - spec.bayPier;
      const y0 = f + (b.kind === 'window' ? spec.window.sill : b.kind === 'shop' ? 0 : 0.1);
      const y1 = Math.min(next - 0.15, f + (b.kind === 'window' ? spec.window.head : spec.doorHead));
      // a storey too short for an opening (a parapet, a sliver under a slab) stays brick
      if (w > EPS && y1 - y0 >= MIN_OPENING_H) out.push({kind: b.kind, t0: c - w / 2, t1: c + w / 2, y0, y1});
    }
  }
  return out;
}

/** Every pier, band, glazing bar, balcony and loggia piece of the front. */
export function brickLattice(spec: LatticeSpec): LatticePiece[] {
  const {length: L, floors} = spec;
  if (!(L > 0)) throw new Error(`brickLattice: empty wall (length ${L})`);
  if (floors.length < 2) throw new Error('brickLattice: needs at least one storey');
  for (let i = 1; i < floors.length; i++) if (!(floors[i] > floors[i - 1])) throw new Error(`brickLattice: floors must rise (${floors[i - 1]} -> ${floors[i]})`);
  // Piers and bands either share one brick plane (flush; same material, so the overlap cannot show) or stand clear of the
  // near-coplanar band (faces 2-8 cm apart z-fight from the map camera, geometryAudit zNearTol).
  const step = spec.pierDepth - spec.bandDepth;
  if (step < -EPS || (step > EPS && step < 0.08 - EPS)) throw new Error('brickLattice: piers and bands are flush or at least 8 cm apart');
  const bays = latticeBays(spec), openings = latticeOpenings(spec);
  const y0 = floors[0], yTop = floors[floors.length - 1];
  const pieces: LatticePiece[] = [];
  const loggiaD = spec.loggia?.depth ?? 0.9;
  // Pieces that start on the glass plane sink behind it, each part by its own depth so no two hidden back faces coincide.
  const sink = {pier: 0.15, band: 0.21, bar: 0.03, loggia: 0.1, ...spec.sink};
  // Piers: the complement of every opening's t-span across the whole lattice height (a column of openings shares its piers).
  const spans = [...new Map(openings.map(o => [`${o.t0.toFixed(4)}:${o.t1.toFixed(4)}`, o])).values()].sort((a, b) => a.t0 - b.t0);
  const merged: [number, number][] = [];
  for (const o of spans) {
    const last = merged[merged.length - 1];
    if (last && o.t0 <= last[1] + EPS) last[1] = Math.max(last[1], o.t1); else merged.push([o.t0, o.t1]);
  }
  const loggiaEdge = (x: number) => openings.some(o => o.kind === 'loggia' && (Math.abs(o.t0 - x) < EPS || Math.abs(o.t1 - x) < EPS));
  let t = 0;
  for (const [a, b] of [...merged, [L, L] as [number, number]]) {
    // a pier beside a loggia is as deep as the loggia, so the recess reads from the side
    if (a - t > EPS) pieces.push({part: 'pier', t0: t, t1: a, y0, y1: yTop, out: -sink.pier, depth: sink.pier + ((loggiaEdge(t) || loggiaEdge(a)) ? Math.max(spec.pierDepth, loggiaD) : spec.pierDepth)});
    t = Math.max(t, b);
  }
  // Bands: brick between the openings of one bay, merged along runs of bays with the same opening heights.
  type Gap = {t0: number; t1: number; y0: number; y1: number};
  const gaps: Gap[] = [];
  for (const bay of bays) {
    const col = openings.filter(o => o.t0 >= bay.t0 - EPS && o.t1 <= bay.t1 + EPS).sort((a, b) => a.y0 - b.y0);
    let y = y0;
    for (const o of col) { if (o.y0 - y > EPS) gaps.push({t0: bay.t0, t1: bay.t1, y0: y, y1: o.y0}); y = o.y1; }
    if (yTop - y > EPS) gaps.push({t0: bay.t0, t1: bay.t1, y0: y, y1: yTop});
  }
  // A band lying wholly inside a pier (a storey with no opening in its bay) is dropped: it would only double the pier's front.
  // Elsewhere a band runs the whole bay and overlaps the piers flush (one brick plane, same material), which keeps a storey's
  // spandrel one piece instead of one per opening.
  const clipped = gaps.filter(g => merged.some(([a, b]) => Math.min(g.t1, b) - Math.max(g.t0, a) > EPS));
  clipped.sort((a, b) => a.y0 - b.y0 || a.y1 - b.y1 || a.t0 - b.t0);
  for (const g of clipped) {
    const last = pieces[pieces.length - 1];
    if (last && last.part === 'band' && Math.abs(last.y0 - g.y0) < EPS && Math.abs(last.y1 - g.y1) < EPS && Math.abs(last.t1 - g.t0) < EPS) last.t1 = g.t1;
    else pieces.push({part: 'band', t0: g.t0, t1: g.t1, y0: g.y0, y1: g.y1, out: -sink.band, depth: sink.band + spec.bandDepth});
  }
  // Glazing bars, balconies and loggias.
  // bars stand 10 cm proud of the glass: nearer than 8 cm the glass and the bar front z-fight from the map camera (geometryAudit zNearTol)
  const bar = spec.bar ?? {w: 0.07, depth: 0.1};
  for (const o of openings) {
    const w = o.t1 - o.t0, h = o.y1 - o.y0, c = (o.t0 + o.t1) / 2;
    if (o.kind === 'window' && spec.window.bars) {
      const nv = spec.window.bars.vertical, nh = spec.window.bars.transoms;
      for (let i = 1; i <= nv; i++) { const x = o.t0 + w * i / (nv + 1); pieces.push({part: 'bar', t0: x - bar.w / 2, t1: x + bar.w / 2, y0: o.y0, y1: o.y1, out: -sink.bar, depth: sink.bar + bar.depth}); }
      // transoms run between the vertical bars, never across them (two bar fronts on one spot would z-fight)
      const xs = [o.t0, ...Array.from({length: nv}, (_, i) => o.t0 + w * (i + 1) / (nv + 1)), o.t1];
      for (let i = 1; i <= nh; i++) {
        const y = o.y0 + h * i / (nh + 1);
        const runs = spec.window.bars.through ? 1 : xs.length - 1;
        for (let k = 0; k < runs; k++) {
          const a = spec.window.bars.through ? o.t0 : xs[k] + (k ? bar.w / 2 : 0);
          const e = spec.window.bars.through ? o.t1 : xs[k + 1] - (k + 2 < xs.length ? bar.w / 2 : 0);
          if (e - a > EPS) pieces.push({part: 'bar', t0: a, t1: e, y0: y - bar.w / 2, y1: y + bar.w / 2, out: -sink.bar, depth: sink.bar + bar.depth});
        }
      }
    }
    if ((o.kind === 'balcony' || o.kind === 'shop') && spec.doorBarPitch) {
      const n = Math.max(1, Math.round(w / spec.doorBarPitch));
      for (let i = 1; i < n; i++) { const x = o.t0 + w * i / n; pieces.push({part: 'bar', t0: x - bar.w / 2, t1: x + bar.w / 2, y0: o.y0, y1: o.y1, out: -sink.bar, depth: sink.bar + bar.depth}); }
    }
    if (o.kind === 'balcony' && spec.balcony) {
      const B = spec.balcony, f = o.y0 - 0.1;
      pieces.push({part: 'balconySlab', t0: c - (w + spec.bayPier * 0.6) / 2, t1: c + (w + spec.bayPier * 0.6) / 2, y0: f - B.slab, y1: f, out: spec.bandDepth - 0.1, depth: B.depth + 0.1});
      pieces.push({part: 'balustrade', t0: c - (w + spec.bayPier * 0.6) / 2 + 0.03, t1: c + (w + spec.bayPier * 0.6) / 2 - 0.03, y0: f, y1: f + B.balustrade, out: spec.bandDepth + B.depth - 0.12, depth: 0.04});
    }
    if (o.kind === 'loggia') {
      const f = o.y0 - 0.1, rail = spec.loggia?.railing ?? 1.1;
      pieces.push({part: 'loggiaSlab', t0: o.t0, t1: o.t1, y0: f - 0.15, y1: f + 0.12, out: -sink.loggia, depth: sink.loggia + loggiaD - 0.12});
      pieces.push({part: 'railing', t0: o.t0, t1: o.t1, y0: f + 0.1, y1: f + 0.1 + rail, out: loggiaD - 0.25, depth: 0.04});
    }
  }
  return pieces;
}
