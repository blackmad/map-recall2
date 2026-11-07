/**
 * Floor-slab bands in plan: the horizontal slab edge that runs round a tower at every floor, following rounded corners,
 * and on some floors stops short of a corner with a rounded tip, so the glass corner shows behind it for a few storeys.
 *
 * Why (2026-11-06, zuidas lane #237): the Atrium Zuidtoren (2018) and the Atrium north-east block on Strawinskylaan read
 * by their bronze floor slabs, which sweep round quarter-circle corners and pull back from alternate corners like
 * drawers; the north tower's thinner pale slabs do the same at two storeys. The kit had elevation outlines
 * (`roundedBand.ts`) and per-wall curtain bands (`bandedCurtain.ts`), but nothing that follows a plan round a corner
 * or ends in a plan-rounded tip; builders drew such fronts as a flat tinted box or as straight slabs that miss the
 * corners. Pure geometry, no three.js; plan coordinates (x, z) in metres, any orientation.
 */
export type PlanPt = [number, number];

/** Signed area of a closed ring (positive when it runs counter-clockwise with x right and z up). */
export function ringArea(r: PlanPt[]): number {
  let a = 0;
  for (let i = 0; i < r.length; i++) { const p = r[i], q = r[(i + 1) % r.length]; a += p[0] * q[1] - q[0] * p[1]; }
  return a / 2;
}

/** Axis-aligned rectangle with quarter-circle corners of radius `r` (clamped to half the shorter side), `steps` per corner. */
export function roundedRectPlan(x0: number, x1: number, z0: number, z1: number, r: number, steps = 8): PlanPt[] {
  if (!(x1 > x0 && z1 > z0)) throw new Error('roundedRectPlan: empty rectangle');
  const rr = Math.max(0, Math.min(r, (x1 - x0) / 2, (z1 - z0) / 2));
  if (rr === 0) return [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  const out: PlanPt[] = [];
  const arc = (cx: number, cz: number, a0: number) => {
    for (let i = 0; i <= steps; i++) { const a = a0 + (i / steps) * Math.PI / 2; out.push([cx + rr * Math.cos(a), cz + rr * Math.sin(a)]); }
  };
  arc(x1 - rr, z0 + rr, -Math.PI / 2);
  arc(x1 - rr, z1 - rr, 0);
  arc(x0 + rr, z1 - rr, Math.PI / 2);
  arc(x0 + rr, z0 + rr, Math.PI);
  return out;
}

/** Cumulative arclength at each vertex (0 at vertex 0) and the closed perimeter. */
export function perimeter(r: PlanPt[]): {at: number[]; total: number} {
  const at = [0];
  for (let i = 1; i <= r.length; i++) at.push(at[i - 1] + Math.hypot(r[i % r.length][0] - r[i - 1][0], r[i % r.length][1] - r[i - 1][1]));
  return {at: at.slice(0, r.length), total: at[r.length]};
}

/** Point and outward unit normal at arclength `s` (wrapped) along the ring; at a vertex the normal is the bisector. */
export function pointAt(r: PlanPt[], s: number): {p: PlanPt; n: PlanPt; edge: number} {
  const {at, total} = perimeter(r);
  const ss = ((s % total) + total) % total;
  let i = 0;
  while (i + 1 < r.length && at[i + 1] <= ss) i++;
  const a = r[i], b = r[(i + 1) % r.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-12, u = (ss - at[i]) / L;
  return {p: [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u], n: edgeNormal(r, i), edge: i};
}

function edgeNormal(r: PlanPt[], i: number): PlanPt {
  const s = ringArea(r) > 0 ? 1 : -1, a = r[i], b = r[(i + 1) % r.length];
  const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1e-12;
  return [s * dz / L, -s * dx / L];
}
/** Mitred outward normal at vertex i, scaled so an offset of d moves both adjacent edges by d (capped on sharp corners). */
function vertexOffset(r: PlanPt[], i: number): PlanPt {
  const n = r.length, a = edgeNormal(r, (i - 1 + n) % n), c = edgeNormal(r, i);
  const k = 1 / Math.max(0.35, 1 + a[0] * c[0] + a[1] * c[1]);
  return [(a[0] + c[0]) * k, (a[1] + c[1]) * k];
}

export type SlabBand = {
  /** Metres the slab edge stands proud of the ring (the visible projection). */
  out: number;
  /** Metres the slab reaches back inside the ring (hidden in the floor), so it never leaves a gap at the glass. */
  inset: number;
  /** Arclength range along the ring (from vertex 0, in the ring's own direction) for a partial band; omitted = the full ring. */
  from?: number; to?: number;
  /** Segments in each rounded tip of a partial band. */
  tipSteps?: number;
};
export type SlabOutline = {outer: PlanPt[]; hole?: PlanPt[]};

/**
 * Plan outline of one floor's slab band. A full band is the ring offset outward by `out` with the ring offset inward by
 * `inset` as its hole; a partial band runs from `from` to `to` along the ring (wrapping past vertex 0 when to < from or
 * to > perimeter) and ends in plan-rounded tips (half circles across the slab depth). Outer runs the same way as `ring`.
 */
export function slabBandOutline(ring: PlanPt[], band: SlabBand): SlabOutline {
  if (!(band.out > 0) || !(band.inset >= 0)) throw new Error('slabBandOutline: out must be > 0 and inset >= 0');
  const n = ring.length;
  if (band.from === undefined || band.to === undefined) {
    const off = (d: number) => ring.map((p, i) => { const v = vertexOffset(ring, i); return [p[0] + v[0] * d, p[1] + v[1] * d] as PlanPt; });
    return band.inset > 0 ? {outer: off(band.out), hole: off(-band.inset)} : {outer: off(band.out), hole: ring.map(p => [p[0], p[1]] as PlanPt)};
  }
  const {at, total} = perimeter(ring);
  let s0 = band.from, s1 = band.to;
  while (s1 <= s0) s1 += total;
  if (s1 - s0 >= total - 1e-6) return slabBandOutline(ring, {out: band.out, inset: band.inset});
  // samples: the two ends plus every vertex strictly between them (walking forward, wrapping)
  const samples: {p: PlanPt; v: PlanPt}[] = [];
  const end = (s: number) => { const q = pointAt(ring, s); return {p: q.p, v: q.n}; };
  samples.push(end(s0));
  for (let lap = 0; lap < 2; lap++) for (let i = 0; i < n; i++) {
    const s = at[i] + lap * total;
    if (s > s0 + 1e-6 && s < s1 - 1e-6) samples.push({p: ring[i], v: vertexOffset(ring, i)});
  }
  samples.push(end(s1));
  const outer = samples.map(({p, v}) => [p[0] + v[0] * band.out, p[1] + v[1] * band.out] as PlanPt);
  const inner = samples.map(({p, v}) => [p[0] - v[0] * band.inset, p[1] - v[1] * band.inset] as PlanPt);
  const steps = band.tipSteps ?? 6, half = (band.out + band.inset) / 2;
  // a tip: half circle from the outer end to the inner end, bulging along the band's direction (`dir` = +1 at the end)
  const tip = (o: PlanPt, i: PlanPt, along: PlanPt): PlanPt[] => {
    const c: PlanPt = [(o[0] + i[0]) / 2, (o[1] + i[1]) / 2], ux = (o[0] - c[0]) / half, uz = (o[1] - c[1]) / half;
    const pts: PlanPt[] = [];
    for (let k = 1; k < steps; k++) {
      const a = (k / steps) * Math.PI, ca = Math.cos(a), sa = Math.sin(a);
      pts.push([c[0] + half * (ux * ca + along[0] * sa), c[1] + half * (uz * ca + along[1] * sa)]);
    }
    return pts;
  };
  const dirEnd = tangentAt(ring, s1), dirStart = tangentAt(ring, s0);
  return {outer: [
    ...outer,
    ...tip(outer[outer.length - 1], inner[inner.length - 1], dirEnd),
    ...inner.reverse(),
    ...tip(inner[inner.length - 1], outer[0], [-dirStart[0], -dirStart[1]]),
  ]};
}

function tangentAt(r: PlanPt[], s: number): PlanPt {
  const {edge} = pointAt(r, s), a = r[edge], b = r[(edge + 1) % r.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-12;
  return [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
}

/**
 * Mullion stations along the straight edges of a ring (edges at least `minEdge` long), `module` metres apart, centred on
 * each edge and kept `margin` from its ends; each with its outward normal. Curved corners (short edges) get none.
 */
export function mullionStations(ring: PlanPt[], module: number, minEdge = 2, margin = 0.3): {p: PlanPt; n: PlanPt; edge: number}[] {
  if (!(module > 0)) throw new Error('mullionStations: module must be > 0');
  const out: {p: PlanPt; n: PlanPt; edge: number}[] = [];
  ring.forEach((a, i) => {
    const b = ring[(i + 1) % ring.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < minEdge) return;
    const usable = L - 2 * margin, k = Math.max(0, Math.floor(usable / module + 1e-9)), first = margin + (usable - k * module) / 2;
    const nrm = edgeNormal(ring, i);
    for (let j = 0; j <= k; j++) { const u = (first + j * module) / L; out.push({p: [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u], n: nrm, edge: i}); }
  });
  return out;
}

/** Arclength along `ring` of the point nearest to `q` (for choosing where a partial band starts and ends). */
export function arclengthNear(ring: PlanPt[], q: PlanPt): number {
  const {at} = perimeter(ring);
  let best = Infinity, bs = 0;
  ring.forEach((a, i) => {
    const b = ring[(i + 1) % ring.length], dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1e-12;
    const u = Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dz) / L2));
    const d = Math.hypot(a[0] + dx * u - q[0], a[1] + dz * u - q[1]);
    if (d < best) { best = d; bs = at[i] + u * Math.sqrt(L2); }
  });
  return bs;
}
