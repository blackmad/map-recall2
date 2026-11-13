/**
 * Hard gates on an installed per-house recipe GLB, measured where the game draws it (lane BA, belt audit, 2026-11-13).
 *
 * The belt batch (`belt-20261113`, 175 houses) passed every compile gate and was still rejected in the street: houses
 * offset from their footprint, butting into neighbours, gaps, dropped gables. The compile gates never measured the
 * shipped mesh against the plot: `footprint-vs-bag` (gates.ts) compares the recipe's *declared* plan with BAG, and the
 * catalogue's `recipe.footprintIoU` is the mesh-sharing IoU (this house's BAG footprint against the BAG footprint of the
 * house whose mesh it reuses, 1 for a house that is its own master), so neither looks at the GLB.
 *
 * This module looks at the GLB. Inputs are the decoded GLB triangles in their frontage frame (x along the front, y up,
 * z outward), the catalogue placement (anchor, +X bearing, mirror) taken to RD metres, and BAG polygons in RD. Gates:
 *
 *   outside      plan area beyond `TOL_M` outside the pand polygon, not counting forward parts the intent states
 *                (stoop, awning, bay, balcony, hoist, cornice: see `allowances`; trim slots get TRIM_DEPTH_M)  fail > OUTSIDE_MAX_M2
 *   intrusion    deepest plan cell inside a neighbouring pand polygon, measured past the pand's own outline
 *                (cells BAG gives to both are skipped; BAG neighbours overlap the pand by up to 0.4 m)           fail > TOL_M
 *   frontage     length of each street front not covered laterally by the upper-storey wall band              fail > TOL_M
 *   protrusion   deepest point in front of a street front that no stated part explains                         fail > TOL_M
 *
 * plus `meshIoU` (mesh plan against the pand polygon, the number `footprintIoU` was mistaken for) and the placement
 * error against the facts' own front frame. Pure: no file access; the CLI is scripts/building-recipes/install-audit.ts.
 */

export type XY = [number, number];
export type Ring = XY[];
/** Frame-local triangle: vertices [x, y, z] (x along the front, y up, z outward), and its material name. */
export interface FrameTri { a: number[]; b: number[]; c: number[]; material: string }
export interface Placement { anchorRD: XY; uRD: XY; mirror: boolean }
export interface StreetFront { street?: string; chainRD: XY[]; outwardNormalRD: XY }

export const TOL_M = 0.2;
export const OUTSIDE_MAX_M2 = 0.5;
export const CELL_M = 0.1;
/** Frames, sills, surrounds, glazing and doors stand up to 0.17 m proud of the recipe's wall (the kit's frame depth): they get that on top of TOL_M. */
export const TRIM_DEPTH_M = 0.17;
/** Material slot (the name after the colour, `e6e2d8_frame` -> frame) of the kit's trim parts. */
export const isTrim = (material: string): boolean => /_(frame|stone|stone_measured|glass|door|sill|trim)$/.test(material);

/** Frame-local (x, y, z) -> [X, Y, h] in RD. +Z is +X turned 90 degrees clockwise seen from above (three.js: +X east, +Z south). */
export function placeVertex(p: Placement, v: number[]): [number, number, number] {
  const [ux, uy] = p.uRD, nx = uy, ny = -ux, x = p.mirror ? -v[0] : v[0];
  return [p.anchorRD[0] + x * ux + v[2] * nx, p.anchorRD[1] + x * uy + v[2] * ny, v[1]];
}

/**
 * The RD direction of the mesh's +X from a catalogue placement. Inverts `instances.ts placementFor`, which measured the
 * bearing between two projected points with 111320 m per degree on both axes: walk 10 m along bearing 90 + offset with
 * the same constants and project both points back.
 */
export function placementU(anchor: XY, northOffsetDegrees: number, lngLatToRd: (lng: number, lat: number) => XY): XY {
  const b = ((90 + northOffsetDegrees) * Math.PI) / 180, k = 111320 * Math.cos((anchor[1] * Math.PI) / 180);
  const ahead: XY = [anchor[0] + (10 * Math.sin(b)) / k, anchor[1] + (10 * Math.cos(b)) / 111320];
  const p = lngLatToRd(anchor[0], anchor[1]), q = lngLatToRd(ahead[0], ahead[1]);
  const l = Math.hypot(q[0] - p[0], q[1] - p[1]);
  return [(q[0] - p[0]) / l, (q[1] - p[1]) / l];
}

export function pointInRing(p: XY, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
const inRings = (p: XY, rings: Ring[]) => rings.reduce((s, r) => s + (pointInRing(p, r) ? 1 : 0), 0) % 2 === 1;
function segDist(p: XY, a: XY, b: XY): number {
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}
export function boundaryDistance(p: XY, rings: Ring[]): number {
  let d = Infinity;
  for (const r of rings) for (let i = 0, j = r.length - 1; i < r.length; j = i++) d = Math.min(d, segDist(p, r[j], r[i]));
  return d;
}

/** Occupancy raster of a plan (cell centres), filled from projected triangles; vertical triangles stamp their edges. */
export class PlanGrid {
  readonly W: number; readonly H: number; readonly data: Uint8Array;
  constructor(readonly x0: number, readonly y0: number, x1: number, y1: number, readonly cell = CELL_M) {
    this.W = Math.ceil((x1 - x0) / cell) + 1; this.H = Math.ceil((y1 - y0) / cell) + 1; this.data = new Uint8Array(this.W * this.H);
  }
  centre(i: number, j: number): XY { return [this.x0 + (i + 0.5) * this.cell, this.y0 + (j + 0.5) * this.cell]; }
  private mark(x: number, y: number) {
    const i = Math.floor((x - this.x0) / this.cell), j = Math.floor((y - this.y0) / this.cell);
    if (i >= 0 && j >= 0 && i < this.W && j < this.H) this.data[j * this.W + i] = 1;
  }
  addTriangle(a: XY, b: XY, c: XY) {
    const den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
    if (Math.abs(den) > 1e-6) {
      const i0 = Math.floor((Math.min(a[0], b[0], c[0]) - this.x0) / this.cell), i1 = Math.floor((Math.max(a[0], b[0], c[0]) - this.x0) / this.cell);
      const j0 = Math.floor((Math.min(a[1], b[1], c[1]) - this.y0) / this.cell), j1 = Math.floor((Math.max(a[1], b[1], c[1]) - this.y0) / this.cell);
      for (let j = Math.max(0, j0); j <= Math.min(this.H - 1, j1); j++) for (let i = Math.max(0, i0); i <= Math.min(this.W - 1, i1); i++) {
        const [px, py] = this.centre(i, j);
        const l1 = ((b[1] - c[1]) * (px - c[0]) + (c[0] - b[0]) * (py - c[1])) / den, l2 = ((c[1] - a[1]) * (px - c[0]) + (a[0] - c[0]) * (py - c[1])) / den;
        if (l1 >= -1e-6 && l2 >= -1e-6 && 1 - l1 - l2 >= -1e-6) this.data[j * this.W + i] = 1;
      }
    }
    for (const [p, q] of [[a, b], [b, c], [c, a]] as [XY, XY][]) {
      const steps = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / (this.cell / 2)));
      for (let k = 0; k <= steps; k++) this.mark(p[0] + ((q[0] - p[0]) * k) / steps, p[1] + ((q[1] - p[1]) * k) / steps);
    }
  }
  *occupied(): Generator<[number, number, XY]> {
    for (let j = 0; j < this.H; j++) for (let i = 0; i < this.W; i++) if (this.data[j * this.W + i]) yield [i, j, this.centre(i, j)];
  }
}

/** What the intent says may stand in front of the street wall: a depth allowance per height band, with the part named. */
export interface Allowance { part: string; fromM: number; toM: number; depthM: number }
export interface StatedParts {
  storeyHeights: number[]; eavesM: number;
  stoop?: boolean; awning?: boolean; groundCanopy?: boolean; shopfront?: boolean; hoist?: boolean; cornice?: boolean;
  bayStoreys?: number[]; balconyStoreys?: number[]; eavesOverhang?: boolean;
}
/** Height bands (metres above the pand's ground) and depths the stated parts may take in front of the front line. */
export function allowances(s: StatedParts): Allowance[] {
  const tops = s.storeyHeights.reduce<number[]>((acc, h) => [...acc, (acc.at(-1) ?? 0) + h], []);
  const storey = (k: number): [number, number] => [k ? tops[k - 1] : 0, tops[k] ?? s.eavesM];
  const ground = tops[0] ?? 3.5, out: Allowance[] = [];
  if (s.stoop) out.push({part: 'stoop', fromM: -0.5, toM: 2.0, depthM: 3.0});
  if (s.awning || s.groundCanopy) out.push({part: 'awning', fromM: 0, toM: ground + 0.5, depthM: 2.5});
  if (s.shopfront) out.push({part: 'shopfront', fromM: 0, toM: ground + 0.3, depthM: 0.4});
  if (s.hoist) out.push({part: 'hoist', fromM: ground, toM: Infinity, depthM: 1.5});
  if (s.cornice) out.push({part: 'cornice', fromM: s.eavesM - 1.6, toM: Infinity, depthM: 0.7});
  if (s.eavesOverhang) out.push({part: 'eaves', fromM: s.eavesM - 0.6, toM: Infinity, depthM: 1.0});
  for (const k of s.bayStoreys ?? []) { const [a, b] = storey(k); out.push({part: 'bay', fromM: a - 0.3, toM: b + 0.3, depthM: 1.5}); }
  for (const k of s.balconyStoreys ?? []) { const [a, b] = storey(k); out.push({part: 'balcony', fromM: a - 0.3, toM: b + 0.6, depthM: 1.6}); }
  return out;
}

/** Signed distance of a plan point in front of a street front (along its outward normal), when it lies within the front's span. */
function frontOffset(p: XY, f: StreetFront, extendM = 0.5, own?: Ring[]): {d: number; s: number; len: number} | null {
  let best: {d: number; s: number; len: number} | null = null, run = 0;
  const total = f.chainRD.slice(1).reduce((acc, q, i) => acc + Math.hypot(q[0] - f.chainRD[i][0], q[1] - f.chainRD[i][1]), 0);
  for (let i = 1; i < f.chainRD.length; i++) {
    const a = f.chainRD[i - 1], b = f.chainRD[i], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 1e-6) continue;
    const u: XY = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
    // The segment's own normal, oriented like the front's outward normal.
    let n: XY = [u[1], -u[0]];
    // Outward = the side of the segment's midpoint that leaves the pand (a kinked front's short piece can sit almost
    // square to the front's mean normal, so the mean normal cannot orient it); without the pand, the mean normal.
    const mid: XY = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const flip = own ? inRings([mid[0] + n[0] * 0.3, mid[1] + n[1] * 0.3], own) : n[0] * f.outwardNormalRD[0] + n[1] * f.outwardNormalRD[1] < 0;
    if (flip) n = [-n[0], -n[1]];
    const t = (p[0] - a[0]) * u[0] + (p[1] - a[1]) * u[1], d = (p[0] - a[0]) * n[0] + (p[1] - a[1]) * n[1];
    const lo = i === 1 ? -extendM : 0, hi = i === f.chainRD.length - 1 ? len + extendM : len;
    if (t >= lo && t <= hi && (!best || Math.abs(d) < Math.abs(best.d))) best = {d, s: run + t, len: total};
    run += len;
  }
  return best;
}

export interface GateResult { id: 'outside' | 'intrusion' | 'frontage' | 'protrusion'; pass: boolean; valueM: number; unit: 'm2' | 'm'; detail?: string }
export interface InstallAudit {
  meshIoU: number;
  placement: {anchorErrorM: number | null; rotationErrorDeg: number | null};
  gates: GateResult[];
  outsideAllM2: number;
  intrusions: {pand: string; depthM: number; areaM2: number}[];
  frontage: {street?: string; widthM: number; uncoveredM: number; runs: [number, number][]}[];
  protrusions: {depthM: number; fromM: number; toM: number; material: string; explainedBy?: string}[];
  /** Plan bounds of the placed mesh in RD (for overlays). */
  meshBoundsRD: [number, number, number, number];
  /** With `keepPlan`: the mesh plan raster (every triangle) and the band raster, for overlays. */
  plan?: {all: PlanGrid; band: PlanGrid};
}

export interface AuditInput {
  tris: FrameTri[];
  placement: Placement;
  own: Ring[];
  neighbours: {id: string; rings: Ring[]}[];
  fronts: StreetFront[];
  stated: StatedParts;
  /** The front frame the recipe was compiled in (facts.fronts[0]): the placement should land its origin on midRD and +X on uRD. */
  frame?: {midRD: XY; uRD: XY};
  /** The upper-storey band whose lateral cover decides `frontage` (default: top of the ground storey + 0.3 to eaves - 0.5). */
  wallBand?: [number, number];
  keepPlan?: boolean;
}

export function auditInstall(input: AuditInput): InstallAudit {
  const {tris, placement, own, neighbours, fronts, stated} = input;
  const placed = tris.map(t => ({t, p: [placeVertex(placement, t.a), placeVertex(placement, t.b), placeVertex(placement, t.c)]}));
  const allowed = allowances(stated);

  // Protrusion: every vertex in front of a street front (beyond TOL_M) must sit in a stated part's band and depth.
  const protrusions: InstallAudit['protrusions'] = [];
  const explained = new Set<number>();
  placed.forEach(({t, p}, k) => {
    let worst: {d: number; h: number} | null = null;
    const hs = p.map(v => v[2]);
    for (const v of p) for (const f of fronts) {
      // Only what stands outside the pand can protrude.
      if (inRings([v[0], v[1]], own)) continue;
      const o = frontOffset([v[0], v[1]], f, 0.5, own);
      if (o && o.d > TOL_M && (!worst || o.d > worst.d)) worst = {d: o.d, h: v[2]};
    }
    if (!worst) return;
    const lo = Math.min(...hs), hi = Math.max(...hs);
    const by = allowed.find(a => lo >= a.fromM - 0.05 && hi <= a.toM + 0.05 && worst!.d <= a.depthM + 0.05)
      ?? (isTrim(t.material) && worst.d <= TOL_M + TRIM_DEPTH_M ? {part: 'trim'} : undefined);
    protrusions.push({depthM: worst.d, fromM: lo, toM: hi, material: t.material, ...(by ? {explainedBy: by.part} : {})});
    if (by) explained.add(k);
  });

  // Plan rasters over the mesh, the pand and its neighbours.
  const xs: number[] = [], ys: number[] = [];
  for (const {p} of placed) for (const v of p) { xs.push(v[0]); ys.push(v[1]); }
  const meshBoundsRD: InstallAudit['meshBoundsRD'] = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  for (const r of own) for (const v of r) { xs.push(v[0]); ys.push(v[1]); }
  const x0 = Math.min(...xs) - 1, y0 = Math.min(...ys) - 1, x1 = Math.max(...xs) + 1, y1 = Math.max(...ys) + 1;
  const all = new PlanGrid(x0, y0, x1, y1), body = new PlanGrid(x0, y0, x1, y1);
  const [bandLo, bandHi] = input.wallBand ?? wallBand(stated);
  const band = new PlanGrid(x0, y0, x1, y1);
  placed.forEach(({p}, k) => {
    const a: XY = [p[0][0], p[0][1]], b: XY = [p[1][0], p[1][1]], c: XY = [p[2][0], p[2][1]];
    all.addTriangle(a, b, c);
    // `body`: every triangle except the forward parts a stated part explains (gate 4 judged those).
    if (!explained.has(k)) body.addTriangle(a, b, c);
    const lo = Math.min(p[0][2], p[1][2], p[2][2]), hi = Math.max(p[0][2], p[1][2], p[2][2]);
    if (hi >= bandLo && lo <= bandHi) band.addTriangle(a, b, c);
  });
  const area = CELL_M * CELL_M;

  let inter = 0, union = 0, outsideAll = 0, outsideBody = 0;
  const ownMask = new Uint8Array(all.W * all.H);
  for (let j = 0; j < all.H; j++) for (let i = 0; i < all.W; i++) {
    const c = all.centre(i, j), inOwn = inRings(c, own), occ = all.data[j * all.W + i] === 1;
    ownMask[j * all.W + i] = inOwn ? 1 : 0;
    if (inOwn && occ) inter++;
    if (inOwn || occ) union++;
    if (!inOwn && (occ || body.data[j * all.W + i]) && boundaryDistance(c, own) > TOL_M) {
      if (occ) outsideAll++;
      if (body.data[j * all.W + i]) outsideBody++;
    }
  }

  const intrusions: InstallAudit['intrusions'] = [];
  for (const nb of neighbours) {
    let depth = 0, cells = 0;
    for (const [i, j, c] of all.occupied()) {
      if (ownMask[j * all.W + i] || !inRings(c, nb.rings)) continue;
      // Depth past the pand's own outline: BAG neighbours often overlap the pand by 0.3-0.4 m, and a mesh on the
      // pand's own outline is right there, so the neighbour's boundary is not the reference.
      cells++; depth = Math.max(depth, Math.min(boundaryDistance(c, own), boundaryDistance(c, nb.rings)));
    }
    if (cells) intrusions.push({pand: nb.id, depthM: +depth.toFixed(2), areaM2: +(cells * area).toFixed(2)});
  }
  intrusions.sort((a, b) => b.depthM - a.depthM);

  // Frontage: lateral cover of each street front by the wall band, from the triangles themselves (no raster
  // quantisation): a band triangle within 1.5 m behind / 0.5 m in front of the front's chord covers the span of its
  // vertices along the chord.
  const frontage: InstallAudit['frontage'] = fronts.map(f => {
    const a = f.chainRD[0], b = f.chainRD[f.chainRD.length - 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const u: XY = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
    let n: XY = [u[1], -u[0]];
    if (inRings([(a[0] + b[0]) / 2 + n[0] * 0.3, (a[1] + b[1]) / 2 + n[1] * 0.3], own)) n = [-n[0], -n[1]];
    const cover: [number, number][] = [];
    for (const {p} of placed) {
      const lo = Math.min(p[0][2], p[1][2], p[2][2]), hi = Math.max(p[0][2], p[1][2], p[2][2]);
      if (hi < bandLo || lo > bandHi) continue;
      const sd = p.map(v => [(v[0] - a[0]) * u[0] + (v[1] - a[1]) * u[1], (v[0] - a[0]) * n[0] + (v[1] - a[1]) * n[1]]);
      if (Math.max(...sd.map(q => q[1])) < -1.5 || Math.min(...sd.map(q => q[1])) > 0.5) continue;
      cover.push([Math.min(...sd.map(q => q[0])), Math.max(...sd.map(q => q[0]))]);
    }
    cover.sort((x, y) => x[0] - y[0]);
    const runs: [number, number][] = [];
    let at = 0;
    for (const [s0, s1] of cover) { if (s0 > at + 0.01) runs.push([+at.toFixed(2), +Math.min(s0, len).toFixed(2)]); at = Math.max(at, s1); if (at >= len) break; }
    if (at < len - 0.01) runs.push([+at.toFixed(2), +len.toFixed(2)]);
    const real = runs.filter(([r0, r1]) => r1 > r0);
    const uncovered = real.reduce((acc, [r0, r1]) => acc + r1 - r0, 0);
    return {street: f.street, widthM: +len.toFixed(2), uncoveredM: +uncovered.toFixed(2), runs: real};
  });

  const worstProtrusion = protrusions.filter(p => !p.explainedBy).reduce((m, p) => Math.max(m, p.depthM), 0);
  const worstIntrusion = intrusions[0]?.depthM ?? 0, worstFront = Math.max(0, ...frontage.map(f => f.uncoveredM));
  const gates: GateResult[] = [
    {id: 'outside', pass: outsideBody * area <= OUTSIDE_MAX_M2, valueM: +(outsideBody * area).toFixed(2), unit: 'm2'},
    {id: 'intrusion', pass: worstIntrusion <= TOL_M, valueM: worstIntrusion, unit: 'm', ...(intrusions[0] ? {detail: intrusions[0].pand} : {})},
    {id: 'frontage', pass: worstFront <= TOL_M, valueM: +worstFront.toFixed(2), unit: 'm'},
    {id: 'protrusion', pass: worstProtrusion <= TOL_M, valueM: +worstProtrusion.toFixed(2), unit: 'm',
      ...(worstProtrusion > TOL_M ? {detail: [...new Set(protrusions.filter(p => !p.explainedBy && p.depthM > TOL_M).map(p => p.material))].join(',')} : {})},
  ];

  let anchorErrorM: number | null = null, rotationErrorDeg: number | null = null;
  if (input.frame) {
    anchorErrorM = +Math.hypot(placement.anchorRD[0] - input.frame.midRD[0], placement.anchorRD[1] - input.frame.midRD[1]).toFixed(3);
    const dot = placement.uRD[0] * input.frame.uRD[0] + placement.uRD[1] * input.frame.uRD[1], cross = placement.uRD[0] * input.frame.uRD[1] - placement.uRD[1] * input.frame.uRD[0];
    rotationErrorDeg = +((Math.atan2(cross, dot) * 180) / Math.PI).toFixed(3);
  }
  return {
    meshIoU: union ? +(inter / union).toFixed(3) : 0, placement: {anchorErrorM, rotationErrorDeg}, gates,
    outsideAllM2: +(outsideAll * area).toFixed(2), intrusions, frontage,
    protrusions: mergeProtrusions(protrusions), meshBoundsRD: meshBoundsRD.map(v => +v.toFixed(2)) as InstallAudit['meshBoundsRD'],
    ...(input.keepPlan ? {plan: {all, band}} : {}),
  };
}

export function wallBand(s: StatedParts): [number, number] {
  const ground = s.storeyHeights[0] ?? 3.5;
  return ground + 0.3 < s.eavesM - 0.5 ? [ground + 0.3, s.eavesM - 0.5] : [1, Math.max(1.5, s.eavesM - 0.3)];
}

/** One row per (part, material): the deepest forward point and the height span. */
function mergeProtrusions(rows: InstallAudit['protrusions']): InstallAudit['protrusions'] {
  const by = new Map<string, InstallAudit['protrusions'][number]>();
  for (const r of rows) {
    const key = `${r.explainedBy ?? 'UNSTATED'}|${r.material}`, prior = by.get(key);
    if (!prior) by.set(key, {...r});
    else { prior.depthM = Math.max(prior.depthM, r.depthM); prior.fromM = Math.min(prior.fromM, r.fromM); prior.toM = Math.max(prior.toM, r.toM); }
  }
  return [...by.values()].map(r => ({...r, depthM: +r.depthM.toFixed(2), fromM: +r.fromM.toFixed(2), toM: +r.toM.toFixed(2)})).sort((a, b) => b.depthM - a.depthM);
}

// ---- crown survival -----------------------------------------------------------------------------------------------

export const FLAT_CROWNS: ReadonlySet<string> = new Set(['cornice', 'flat']);
export const RAISED_CROWN_MIN_RISE_M = 1.0;

/** The front silhouette: max height per 10 cm of frontage (empty bins dropped), of geometry within `depthM` of the front plane (frame z = 0). */
export const isRoof = (material: string): boolean => /_(roofTile|roof|slate|bitumen|zinc|lead|copper|thatch)$/i.test(material);
/** `which`: the front wall's own silhouette (default; roof slots left out), or the roof's where it reaches the front plane. */
export function frontProfile(tris: FrameTri[], depthM = 0.6, bin = CELL_M, which: 'wall' | 'roof' = 'wall'): {x0: number; bin: number; top: number[]} {
  const near = tris.filter(t => isRoof(t.material) === (which === 'roof') && [t.a, t.b, t.c].every(v => Math.abs(v[2]) <= depthM));
  if (!near.length) return {x0: 0, bin, top: []};
  const x0 = Math.min(...near.flatMap(t => [t.a[0], t.b[0], t.c[0]])), x1 = Math.max(...near.flatMap(t => [t.a[0], t.b[0], t.c[0]]));
  const top = new Array<number>(Math.max(1, Math.ceil((x1 - x0) / bin))).fill(-Infinity);
  for (const t of near) for (const [p, q] of [[t.a, t.b], [t.b, t.c], [t.c, t.a]]) {
    const steps = Math.max(1, Math.ceil(Math.abs(q[0] - p[0]) / (bin / 4)));
    for (let k = 0; k <= steps; k++) {
      const x = p[0] + ((q[0] - p[0]) * k) / steps, y = p[1] + ((q[1] - p[1]) * k) / steps, i = Math.min(top.length - 1, Math.floor((x - x0) / bin));
      if (y > top[i]) top[i] = y;
    }
  }
  return {x0, bin, top: top.filter(v => Number.isFinite(v))};
}

export interface CrownReading { family: 'flat' | 'raised'; riseM: number; shoulderM: number; topM: number; levelsPerSide: number; halfRiseWidthShare: number; kind: 'flat' | 'step' | 'triangle' | 'neck' }
/** Classify a front silhouette: flat top or raised crown; for a raised one, stepped (>= 3 distinct levels a side), triangular or necked. */
export function readCrown(profile: {bin: number; top: number[]}): CrownReading {
  const t = profile.top, n = t.length, edge = Math.max(1, Math.round(n * 0.12));
  const med = (a: number[]) => { const s = [...a].sort((p, q) => p - q); return s[Math.floor(s.length / 2)] ?? 0; };
  const shoulder = Math.min(med(t.slice(0, edge)), med(t.slice(n - edge)));
  // The crown's top is the level held over at least 0.6 m of frontage: a chimney, finial or hoist spike is not a crown.
  const sorted = [...t].sort((p, q) => q - p), top = sorted[Math.min(n - 1, Math.ceil(0.6 / profile.bin) - 1)], rise = Math.max(0, top - shoulder);
  const halfShare = t.filter(v => v >= shoulder + rise / 2).length / n;
  // Plateaus on the left half: runs of >= 0.25 m within 5 cm, at levels > 0.3 m apart.
  const levels: number[] = [];
  for (let i = 0; i < Math.ceil(n / 2);) {
    let j = i; while (j + 1 < n && Math.abs(t[j + 1] - t[i]) < 0.05) j++;
    if ((j - i + 1) * profile.bin >= 0.25 && !levels.some(l => Math.abs(l - t[i]) < 0.3)) levels.push(t[i]);
    i = j + 1;
  }
  const family = rise >= RAISED_CROWN_MIN_RISE_M ? 'raised' : 'flat';
  const kind = family === 'flat' ? 'flat' : levels.length >= 3 ? 'step' : halfShare >= 0.35 ? 'triangle' : 'neck';
  return {family, riseM: +rise.toFixed(2), shoulderM: +shoulder.toFixed(2), topM: +top.toFixed(2), levelsPerSide: levels.length, halfRiseWidthShare: +halfShare.toFixed(2), kind};
}

export interface CrownSurvival { spec: string | null; intent: string | null; drawn: CrownReading; pass: boolean; why?: string }
/**
 * What a flat (cornice/flat) front may still raise above its cornice, from the intent: a crown cap or a gablet crest at
 * its stated rise, a dormer standing on the cornice (narrower than 60 % of the front). Null = nothing stated.
 */
export interface FlatCrownAllowance { riseM: number; part: string; narrow?: boolean }
export function flatCrownAllowance(front: {crownCap?: string; crownRise?: number; crownCapRise?: unknown; gableOrnament?: {gabletSize?: {rise?: number}} | null; dormers?: number; atticWindows?: unknown}): FlatCrownAllowance | null {
  const crest = front.gableOrnament?.gabletSize?.rise;
  if (typeof crest === 'number') return {riseM: crest + 0.3, part: 'gablet crest'};
  if (front.crownCap) return {riseM: (typeof front.crownRise === 'number' ? front.crownRise : 1.2) + 0.5, part: `crown cap ${front.crownCap}`};
  if ((front.dormers ?? 0) > 0) return {riseM: 2.5, part: 'dormer', narrow: true};
  return null;
}

/** Spec crown -> intent crown -> drawn silhouette. A dropped or changed crown fails. */
export function crownSurvival(spec: string | null | undefined, intent: string | null | undefined, drawn: CrownReading, flatAllowance: FlatCrownAllowance | null = null): CrownSurvival {
  const s = spec ?? null, i = intent ?? null, base = {spec: s, intent: i, drawn};
  if (s !== i) return {...base, pass: false, why: `spec ${s} -> intent ${i}`};
  if (!s) return {...base, pass: true};
  const want = FLAT_CROWNS.has(s) ? 'flat' : 'raised';
  if (want === 'flat' && drawn.family === 'raised' && flatAllowance && drawn.riseM <= flatAllowance.riseM && (!flatAllowance.narrow || drawn.halfRiseWidthShare < 0.6)) return {...base, pass: true, why: `${flatAllowance.part} ${drawn.riseM} m`};
  if (want !== drawn.family) return {...base, pass: false, why: want === 'raised' ? `${s} crown dropped: drawn rise ${drawn.riseM} m` : `${s} front drawn with a ${drawn.riseM} m crown`};
  if (s === 'step' && drawn.kind !== 'step') return {...base, pass: false, why: `step gable drawn as ${drawn.kind} (${drawn.levelsPerSide} levels a side)`};
  if (s !== 'step' && drawn.kind === 'step') return {...base, pass: false, why: `${s} gable drawn stepped (${drawn.levelsPerSide} levels a side)`};
  return {...base, pass: true};
}
