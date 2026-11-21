/**
 * Curved plan fronts (lane postwar-kit-r2-20261121, item 3). BAG traces a curved front as a chain of short edges that
 * each turn a little the same way. The mesher already joins them into one wall run (threeBuildingMesh.ts wallRuns, turns
 * under RUN_TURN_DEG), so the bay cells flow round the curve; what does not follow it are the facet-wise parts.
 */
export type Pt = readonly [number, number];
export const CURVE = { maxEdgeM: 8, minTurnDeg: 2, maxTurnDeg: 25, minEdges: 3, minTotalDeg: 20 } as const;
export type CurvedChain = { start: number; edges: number; turnDeg: number; lenM: number; radiusM: number };

/** Turning angle (deg, signed, left positive) from edge a->b to b->c. */
function turn(a: Pt, b: Pt, c: Pt): number {
  const u = [b[0] - a[0], b[1] - a[1]], v = [c[0] - b[0], c[1] - b[1]];
  return Math.atan2(u[0] * v[1] - u[1] * v[0], u[0] * v[0] + u[1] * v[1]) * 180 / Math.PI;
}

/** The curved chains of a closed ring (metres; the closing vertex may repeat the first). */
export function curvedChains(ring: readonly Pt[]): CurvedChain[] {
  const pts = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] ? ring.slice(0, -1) : ring;
  const n = pts.length;
  if (n < 4) return [];
  const len = (i: number) => Math.hypot(pts[(i + 1) % n][0] - pts[i][0], pts[(i + 1) % n][1] - pts[i][1]);
  // t[i]: the turn at vertex i+1, between edge i and edge i+1.
  const t = pts.map((_, i) => turn(pts[i], pts[(i + 1) % n], pts[(i + 2) % n]));
  const ok = (i: number, sign: number) => len(i) <= CURVE.maxEdgeM && Math.abs(t[i]) >= CURVE.minTurnDeg && Math.abs(t[i]) <= CURVE.maxTurnDeg && Math.sign(t[i]) === sign;
  const out: CurvedChain[] = [];
  const used = new Set<number>();
  for (let i = 0; i < n; i++) {
    if (used.has(i) || !ok(i, Math.sign(t[i])) || ok((i - 1 + n) % n, Math.sign(t[i]))) continue;
    const sign = Math.sign(t[i]);
    let j = i, total = 0, L = 0;
    // Edges i..j each turn into the next by the same sign; the chain is edges i..j+1.
    while (ok(j % n, sign) && j - i < n) { used.add(j % n); total += t[j % n]; L += len(j % n); j++; }
    L += len(j % n);
    const edges = j - i + 1;
    if (edges >= CURVE.minEdges && Math.abs(total) >= CURVE.minTotalDeg) out.push({ start: i, edges, turnDeg: total, lenM: L, radiusM: L / (Math.abs(total) * Math.PI / 180) });
  }
  return out;
}

/**
 * Which edges of one wall run (consecutive edges, end to end) lie on a curved chain: a stretch of CURVE.minEdges or more
 * edges, each at most CURVE.maxEdgeM, turning CURVE.minTurnDeg-maxTurnDeg the same way at every joint, CURVE.minTotalDeg
 * in all. The mesher gives the kit's continuous parts (band, arcade) to every such facet, short ones included, and runs
 * them through the joints.
 */
export function curvedRunEdges(run: ReadonlyArray<{ x0: number; y0: number; x1: number; y1: number; len: number }>): boolean[] {
  const n = run.length, out = new Array<boolean>(n).fill(false);
  if (n < CURVE.minEdges) return out;
  const t = run.slice(0, -1).map((e, i) => turn([e.x0, e.y0], [e.x1, e.y1], [run[i + 1].x1, run[i + 1].y1]));
  const ok = (i: number, sign: number) => run[i].len <= CURVE.maxEdgeM && run[i + 1].len <= CURVE.maxEdgeM && Math.abs(t[i]) >= CURVE.minTurnDeg && Math.abs(t[i]) <= CURVE.maxTurnDeg && Math.sign(t[i]) === sign;
  for (let i = 0; i < n - 1;) {
    const sign = Math.sign(t[i]);
    if (!ok(i, sign)) { i++; continue; }
    let j = i, total = 0;
    while (j < n - 1 && ok(j, sign)) total += t[j++];
    // Joints i..j-1 turn alike: edges i..j form the chain.
    if (j - i + 1 >= CURVE.minEdges && Math.abs(total) >= CURVE.minTotalDeg) for (let k = i; k <= j; k++) out[k] = true;
    i = j;
  }
  return out;
}
/** The only extras a short facet (< 2.5 m) of a curved run draws: the kit's continuous parts. */
export const CURVE_EXTRAS: readonly string[] = ['postwar-balcony-band', 'postwar-arcade'];
