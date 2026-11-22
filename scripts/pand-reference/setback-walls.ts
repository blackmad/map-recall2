/**
 * Upper-storey fronts set back behind a building's BAG footprint, read off its 3DBAG LoD2.2 shell (lane hand-blocks-c-20261122).
 *
 * The crop tooling (landmark-brief.ts, hand-block-walls.ts) rectifies panoramas onto the exposed edges of the BAG footprint.
 * When the street storeys are a podium and the housing above stands several metres back (Tweede Hugo de Grootstraat 43-97:
 * a supermarket podium, the brick block behind it), the footprint edge is the podium's front and no crop lies on the upper
 * front's plane, so its windows come out sheared and clipped. `setbackWalls` finds the shell's vertical walls whose foot
 * stands on a lower roof (>= `minFootM`) and whose plane lies at least `minSetbackM` behind the footprint edge it looks over,
 * merges coplanar pieces into one wall per plane, and returns them as native-frame lines the crop tools can rectify onto.
 *
 * Frame: native east/south metres (x east, z south, y up from the 3DBAG ground), as in scripts/landmarks/<id>-footprints.json.
 * `a` is the viewer's left end seen from outside, `n` the outward unit normal (x, z).
 */
export type Surface = {type: string; rings: number[][][]};
export type P2 = [number, number];
export type SetbackWall = {a: P2; b: P2; n: P2; len: number; footM: number; topM: number; setbackM: number};
export type SetbackOpts = {minLen?: number; minSetbackM?: number; minFootM?: number};

/** Highest roof over (x, z), or null. */
export function roofAt(surfaces: Surface[], x: number, z: number): number | null {
  let best: number | null = null;
  for (const s of surfaces) {
    if (s.type !== 'RoofSurface') continue;
    const r = s.rings[0];
    let inside = false;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const a = r[i], c = r[j];
      if ((a[2] > z) !== (c[2] > z) && x < (c[0] - a[0]) * (z - a[2]) / (c[2] - a[2]) + a[0]) inside = !inside;
    }
    if (!inside) continue;
    let nx = 0, ny = 0, nz = 0;
    for (let i = 0; i < r.length; i++) { const a = r[i], c = r[(i + 1) % r.length]; nx += (a[1] - c[1]) * (a[2] + c[2]); ny += (a[2] - c[2]) * (a[0] + c[0]); nz += (a[0] - c[0]) * (a[1] + c[1]); }
    if (Math.abs(ny) < 1e-6) continue;
    const y = r[0][1] - (nx * (x - r[0][0]) + nz * (z - r[0][2])) / ny;
    if (best === null || y > best) best = y;
  }
  return best;
}

/** Distance from p along direction d to the first crossing of the closed ring (2D, x/z), or Infinity. */
export function rayToRing(p: P2, d: P2, ring: number[][]): number {
  let best = Infinity;
  for (let k = 0; k < ring.length; k++) {
    const a = ring[k], b = ring[(k + 1) % ring.length], ex = b[0] - a[0], ez = b[1] - a[1];
    const den = d[0] * ez - d[1] * ex;
    if (Math.abs(den) < 1e-12) continue;
    const t = ((a[0] - p[0]) * ez - (a[1] - p[1]) * ex) / den, u = ((a[0] - p[0]) * d[1] - (a[1] - p[1]) * d[0]) / den;
    if (t > 1e-6 && u >= -1e-9 && u <= 1 + 1e-9) best = Math.min(best, t);
  }
  return best;
}

/** Point in a closed 2D ring (x/z). */
export function inRing(p: P2, ring: number[][]): boolean {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}

type Piece = {n: P2; off: number; t0: number; t1: number; yb: number; yt: number};

/** Vertical wall pieces with an outward normal checked against the roofs (lower in front than behind). */
function pieces(surfaces: Surface[]): Piece[] {
  const out: Piece[] = [];
  for (const s of surfaces) {
    if (s.type !== 'WallSurface') continue;
    const r = s.rings[0];
    let nx = 0, ny = 0, nz = 0;
    for (let k = 0; k < r.length; k++) { const a = r[k], c = r[(k + 1) % r.length]; nx += (a[1] - c[1]) * (a[2] + c[2]); ny += (a[2] - c[2]) * (a[0] + c[0]); nz += (a[0] - c[0]) * (a[1] + c[1]); }
    const l = Math.hypot(nx, ny, nz), h = Math.hypot(nx, nz);
    if (l < 1e-9 || h / l < 0.995) continue;
    let n: P2 = [nx / h, nz / h];
    const ys = r.map(p => p[1]), yb = Math.min(...ys), yt = Math.max(...ys);
    const cx = r.reduce((q, p) => q + p[0], 0) / r.length, cz = r.reduce((q, p) => q + p[2], 0) / r.length;
    const front = roofAt(surfaces, cx + n[0] * 0.5, cz + n[1] * 0.5) ?? -1, back = roofAt(surfaces, cx - n[0] * 0.5, cz - n[1] * 0.5) ?? -1;
    if (front > back) n = [-n[0], -n[1]];
    const u: P2 = [-n[1], n[0]];
    const ts = r.map(p => p[0] * u[0] + p[2] * u[1]);
    out.push({n, off: cx * n[0] + cz * n[1], t0: Math.min(...ts), t1: Math.max(...ts), yb, yt});
  }
  return out;
}

/**
 * Set-back fronts: shell walls with foot >= minFootM (default 2.5 m) standing >= minSetbackM (default 2 m) behind the
 * footprint ring along their normal, coplanar pieces (normal within ~5 deg, plane within 0.3 m, gap under 0.6 m) merged,
 * merged length >= minLen (default 4 m). Longest first.
 */
export function setbackWalls(surfaces: Surface[], ring: number[][], opts: SetbackOpts = {}): SetbackWall[] {
  const minLen = opts.minLen ?? 4, minSet = opts.minSetbackM ?? 2, minFoot = opts.minFootM ?? 2.5;
  const ps = pieces(surfaces).filter(p => p.yb >= minFoot).sort((p, q) => p.t0 - q.t0);
  const groups: Piece[] = [];
  for (const p of ps) {
    const g = groups.find(q => q.n[0] * p.n[0] + q.n[1] * p.n[1] > 0.996 && Math.abs(q.off - p.off) < 0.3 && p.t0 < q.t1 + 0.6 && q.t0 < p.t1 + 0.6);
    if (g) { g.t0 = Math.min(g.t0, p.t0); g.t1 = Math.max(g.t1, p.t1); g.yb = Math.min(g.yb, p.yb); g.yt = Math.max(g.yt, p.yt); } else groups.push({...p});
  }
  const out: SetbackWall[] = [];
  for (const g of groups) {
    const len = g.t1 - g.t0;
    if (len < minLen) continue;
    const u: P2 = [-g.n[1], g.n[0]];
    const pt = (t: number): P2 => [u[0] * t + g.n[0] * g.off, u[1] * t + g.n[1] * g.off];
    // a wall on the footprint edge (an upper storey flush with the front) has open air right in front of it
    if (![0.25, 0.5, 0.75].every(f => { const q = pt(g.t0 + len * f); return inRing([q[0] + g.n[0] * 0.5, q[1] + g.n[1] * 0.5], ring); })) continue;
    // setback: the nearest footprint crossing in front, over the middle half of the wall
    const setback = Math.min(...[0.25, 0.5, 0.75].map(f => rayToRing(pt(g.t0 + len * f), g.n, ring)));
    if (!(setback >= minSet) || !Number.isFinite(setback)) continue;
    // u points to the left of a viewer outside facing -n, so the viewer's left end is at t1
    const a = pt(g.t1), b = pt(g.t0);
    out.push({a, b, n: g.n, len, footM: g.yb, topM: g.yt, setbackM: setback});
  }
  return out.sort((p, q) => q.len - p.len);
}

/** A set-back front as a crop-tool `Wall` in RD (x east, y north), with its native line kept for the builder. */
export type RdSetbackWall = {a: {x: number; y: number}; b: {x: number; y: number}; len: number; nx: number; ny: number; mid: {x: number; y: number}; roadDistM: number; facing: number; native: SetbackWall};

/** Native walls to RD crop walls; `anchor` is the RD point the native frame is measured from. */
export function toRdWalls(walls: SetbackWall[], anchor: [number, number]): RdSetbackWall[] {
  const rd = (p: P2) => ({x: anchor[0] + p[0], y: anchor[1] - p[1]});
  return walls.map(w => {
    const a = rd(w.a), b = rd(w.b);
    return {a, b, len: w.len, nx: w.n[0], ny: -w.n[1], mid: {x: (a.x + b.x) / 2, y: (a.y + b.y) / 2}, roadDistM: Infinity, facing: 0, native: w};
  });
}

/**
 * The set-back fronts of a BAG pand from its 3DBAG LoD2.2 shell (all parts; 3DBAG CC BY 4.0, cached), in RD. `ringRD` is
 * the footprint used for the setback distance (the BAG outline the crop walls come from).
 */
export async function setbackWallsForPand(pand: string, ringRD: {x: number; y: number}[], opts: SetbackOpts = {}): Promise<RdSetbackWall[]> {
  const {cachedJson} = await import('./core.ts');
  const {nativeVertices, shellSurfaces} = await import('../landmarks/bag-shell-parts.ts');
  const bag = pand.replace('NL.IMBAG.Pand.', '');
  const d = await cachedJson(`https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.${bag}`);
  const ground = d.feature.CityObjects[`NL.IMBAG.Pand.${bag}`].attributes.b3_h_maaiveld as number;
  const anchor: [number, number] = [ringRD.reduce((s, p) => s + p.x, 0) / ringRD.length, ringRD.reduce((s, p) => s + p.y, 0) / ringRD.length];
  const surfaces = shellSurfaces(d.feature, bag, nativeVertices(d.feature, d.metadata.transform, anchor, ground));
  const ring = ringRD.map(p => [p.x - anchor[0], -(p.y - anchor[1])]);
  return toRdWalls(setbackWalls(surfaces, ring, opts), anchor);
}
