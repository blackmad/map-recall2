// Topology-preserving ring simplification for the roads-v1 extract (roads lane phase 2, 2026-10-16).
//
// build-bgt-roads.ts used to Douglas–Peucker every ring on its own, so the edge two touching BGT polygons share was
// simplified twice and the two copies differed by up to 30 cm: neighbouring polygons overlapped (hidden slivers and
// depth fights, `probe-junction-overlap.ts --pairs`) or left gaps. Here every ring is cut into chains at its
// topological nodes (vertices whose degree in the union edge graph is not 2: where a third polygon joins, where a
// shared edge starts or ends), and each chain is simplified once, in a canonical direction, so the two polygons on
// either side of a shared edge keep exactly the same vertices. Vertices are identified by an exact key (the raw
// 1e-7° coordinates, as the kerb matcher hashes them), never by distance.

export type Vec2 = [number, number];

/** A vertex key from raw lng/lat at the API's 1e-7° grid: exact, numeric, and unique over the Netherlands. */
export function vertexKey(lng: number, lat: number): number {
  return (Math.round(lat * 1e7) - 500_000_000) * 1e8 + (Math.round(lng * 1e7) - 30_000_000);
}

const segDist = (a: Vec2, b: Vec2, p: Vec2): number => {
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
};

/** Douglas–Peucker over an open chain: the kept indices (both ends always). Deterministic for a given order. */
export function dpIndices(pts: readonly Vec2[], tol: number): number[] {
  const n = pts.length;
  if (n <= 2) return pts.map((_, i) => i);
  const keep = new Uint8Array(n); keep[0] = keep[n - 1] = 1;
  const stack: [number, number][] = [[0, n - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    let best = -1, at = -1;
    for (let i = a + 1; i < b; i++) { const d = segDist(pts[a], pts[b], pts[i]); if (d > best) { best = d; at = i; } }
    if (best > tol) { keep[at] = 1; stack.push([a, at], [at, b]); }
  }
  const out: number[] = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(i);
  return out;
}

/** A ring without its closing repeat and without consecutive duplicate keys. */
function openRing(keys: readonly number[], pts: readonly Vec2[]): { keys: number[]; pts: Vec2[] } {
  const k: number[] = [], p: Vec2[] = [];
  for (let i = 0; i < keys.length; i++) {
    if (k.length && k[k.length - 1] === keys[i]) continue;
    k.push(keys[i]); p.push(pts[i]);
  }
  while (k.length > 1 && k[0] === k[k.length - 1]) { k.pop(); p.pop(); }
  return { keys: k, pts: p };
}

/**
 * The union edge graph of a set of rings and the shared-edge-safe simplification of any of them. Add every ring
 * that can touch the rings you will simplify (the build adds the 3×3 cell neighbourhood, and the cells any long
 * polygon reaches), then call `simplifyRing` per ring.
 */
export class TopoSimplifier {
  private readonly adj = new Map<number, number[]>();

  addRing(keys: readonly number[]): void {
    const { keys: k } = openRing(keys, keys.map(() => [0, 0] as Vec2));
    const n = k.length;
    if (n < 2) return;
    for (let i = 0; i < n; i++) this.link(k[i], k[(i + 1) % n]);
  }

  private link(a: number, b: number): void {
    if (a === b) return;
    const la = this.adj.get(a);
    if (!la) this.adj.set(a, [b]); else if (!la.includes(b)) la.push(b);
    const lb = this.adj.get(b);
    if (!lb) this.adj.set(b, [a]); else if (!lb.includes(a)) lb.push(a);
  }

  /** A vertex where chains meet: degree other than 2 in the union graph (or never added). */
  isNode(k: number): boolean { const l = this.adj.get(k); return !l || l.length !== 2; }

  /**
   * The ring simplified at `tol` metres with every chain between two nodes simplified once in its canonical
   * direction: a chain shared with another ring comes out vertex-for-vertex identical there. `keys` and `pts` are
   * parallel (closed or open). Null when fewer than three vertices survive.
   */
  simplifyRing(keys: readonly number[], pts: readonly Vec2[], tol: number): { keys: number[]; pts: Vec2[] } | null {
    const r = openRing(keys, pts);
    const n = r.keys.length;
    if (n < 3) return null;
    const nodes: number[] = [];
    for (let i = 0; i < n; i++) if (this.isNode(r.keys[i])) nodes.push(i);
    const outK: number[] = [], outP: Vec2[] = [];
    if (!nodes.length) {
      // A closed chain with no node (an island ring, or a ring another ring's hole repeats): start at the smallest
      // key, run toward its smaller neighbour, split at the farthest vertex.
      let s = 0;
      for (let i = 1; i < n; i++) if (r.keys[i] < r.keys[s]) s = i;
      const fwd = r.keys[(s + 1) % n] <= r.keys[(s - 1 + n) % n];
      const order: number[] = [];
      for (let j = 0; j < n; j++) order.push(fwd ? (s + j) % n : (s - j + n) % n);
      const p0 = r.pts[order[0]];
      let far = 1, fd = -1;
      for (let j = 1; j < n; j++) { const q = r.pts[order[j]], d = Math.hypot(q[0] - p0[0], q[1] - p0[1]); if (d > fd) { fd = d; far = j; } }
      const a = order.slice(0, far + 1), b = [...order.slice(far), order[0]];
      const ka = dpIndices(a.map(i => r.pts[i]), tol).map(j => a[j]);
      const kb = dpIndices(b.map(i => r.pts[i]), tol).map(j => b[j]);
      for (const i of [...ka.slice(0, -1), ...kb.slice(0, -1)]) { outK.push(r.keys[i]); outP.push(r.pts[i]); }
    } else {
      for (let c = 0; c < nodes.length; c++) {
        const from = nodes[c], to = nodes[(c + 1) % nodes.length];
        const idx: number[] = [];
        for (let i = from; ; i = (i + 1) % n) { idx.push(i); if (i === to && idx.length > 1) break; if (idx.length > n + 1) break; }
        // Canonical direction: the end with the smaller key first; a loop chain (same node at both ends) by its second vertex.
        const first = r.keys[idx[0]], last = r.keys[idx[idx.length - 1]];
        const rev = first !== last ? last < first : idx.length > 2 && r.keys[idx[idx.length - 2]] < r.keys[idx[1]];
        const seq = rev ? [...idx].reverse() : idx;
        let kept: number[];
        if (first === last && seq.length > 2) {
          // Loop through one node: split at the vertex farthest from it so DP has a real baseline.
          const p0 = r.pts[seq[0]];
          let far = 1, fd = -1;
          for (let j = 1; j < seq.length - 1; j++) { const q = r.pts[seq[j]], d = Math.hypot(q[0] - p0[0], q[1] - p0[1]); if (d > fd) { fd = d; far = j; } }
          const a = seq.slice(0, far + 1), b = seq.slice(far);
          kept = [...dpIndices(a.map(i => r.pts[i]), tol).map(j => a[j]), ...dpIndices(b.map(i => r.pts[i]), tol).slice(1).map(j => b[j])];
        } else kept = dpIndices(seq.map(i => r.pts[i]), tol).map(j => seq[j]);
        if (rev) kept.reverse();
        for (const i of kept.slice(0, -1)) { outK.push(r.keys[i]); outP.push(r.pts[i]); }
      }
    }
    return outK.length >= 3 ? { keys: outK, pts: outP } : null;
  }
}
