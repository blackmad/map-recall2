/**
 * Floor-edge bands for terraced modern blocks: where, at a given height, the outline of a stepped massing is exposed.
 *
 * Why: the Vijzelbank (Duintjer, 1973) and similar post-war offices read by their projecting floor edges, which run round
 * every terrace of a stepped mass ("vertrappende en terrasvormige terugspringende gevels", municipal monument 200979). The
 * massing comes as many 3DBAG roof pieces of different heights; a band belongs on a piece's edge only where, at that height,
 * nothing else stands just outside the edge (no higher piece of the same building, no neighbouring building). A closed band
 * ring per piece would run through neighbouring pieces and z-fight with their rings; this module instead returns the exposed
 * runs, so a builder lays one slab per run.
 *
 * Pure plan geometry, no three.js. Plan coordinates are [x, z] in metres (native east/south). A piece is a simple polygon
 * (either winding) with the height range [base, top] it occupies.
 */
export type Pt = [number, number];
export type Piece = {ring: Pt[]; holes?: Pt[][]; base: number; top: number};
/** An exposed stretch of a piece edge: from a to b, `n` the unit outward normal (away from the piece). */
export type Run = {a: Pt; b: Pt; n: Pt; piece: number};

export function inRing(ring: Pt[], x: number, z: number): boolean {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i], [xj, zj] = ring[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c;
  }
  return c;
}
export const inPiece = (p: Piece, x: number, z: number) => inRing(p.ring, x, z) && !(p.holes ?? []).some(h => inRing(h, x, z));
export const signedArea = (r: Pt[]) => r.reduce((a, p, i) => { const q = r[(i + 1) % r.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;

/**
 * Exposed runs of every piece edge at height `y`. A piece takes part when base <= y <= top. A sample point `probe` metres
 * outside the edge is exposed unless another taking part piece contains it or `blocked(x, z, y)` says so (a neighbour).
 * Edges are sampled every `step` metres; consecutive exposed samples merge into one run. Edges shorter than `minLen` are
 * ignored, and so are runs shorter than `minLen`.
 */
export function exposedRuns(pieces: Piece[], y: number, o: {probe?: number; step?: number; minLen?: number; blocked?: (x: number, z: number, y: number) => boolean} = {}): Run[] {
  const probe = o.probe ?? 0.3, step = o.step ?? 0.5, minLen = o.minLen ?? 0.6;
  const live = pieces.map((p, i) => ({p, i})).filter(({p}) => p.base <= y && p.top >= y);
  const runs: Run[] = [];
  for (const {p, i} of live) {
    const rings = [p.ring, ...(p.holes ?? [])];
    rings.forEach((r, ri) => {
      // outward normal: for the outer ring away from the interior, for a hole into the hole
      const s = Math.sign(signedArea(r)) * (ri === 0 ? 1 : -1) || 1;
      for (let k = 0; k < r.length; k++) {
        const a = r[k], b = r[(k + 1) % r.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (len < minLen) continue;
        const tx = (b[0] - a[0]) / len, tz = (b[1] - a[1]) / len;
        const n: Pt = [s * tz, -s * tx];
        const cells = Math.max(1, Math.round(len / step)), du = len / cells;
        let start = -1;
        const close = (end: number) => {
          if (start < 0) return;
          const u0 = start * du, u1 = end * du;
          if (u1 - u0 >= minLen) runs.push({a: [a[0] + tx * u0, a[1] + tz * u0], b: [a[0] + tx * u1, a[1] + tz * u1], n, piece: i});
          start = -1;
        };
        for (let c = 0; c < cells; c++) {
          const u = (c + 0.5) * du, x = a[0] + tx * u + n[0] * probe, z = a[1] + tz * u + n[1] * probe;
          const covered = live.some(q => q.i !== i && inPiece(q.p, x, z)) || inPiece(p, x, z) || (o.blocked?.(x, z, y) ?? false);
          if (!covered && start < 0) start = c;
          if (covered) close(c);
        }
        close(cells);
      }
    });
  }
  return runs;
}

/** Convex corners where two runs of the same piece meet end to start (within `tol`): the gap a band leaves outside the corner. */
export function convexCorners(runs: Run[], tol = 0.05): {p: Pt; n1: Pt; n2: Pt}[] {
  const out: {p: Pt; n1: Pt; n2: Pt}[] = [];
  for (const r of runs) for (const q of runs) {
    if (q === r || q.piece !== r.piece || Math.hypot(q.a[0] - r.b[0], q.a[1] - r.b[1]) > tol) continue;
    // convex when the next run turns away from r's normal side (its direction points along -r.n is concave)
    const d: Pt = [q.b[0] - q.a[0], q.b[1] - q.a[1]];
    if (d[0] * r.n[0] + d[1] * r.n[1] < -1e-6) out.push({p: r.b, n1: r.n, n2: q.n});
  }
  return out;
}
