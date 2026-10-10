/**
 * Party walls. Two neighbouring panden share a footprint edge; each house's
 * shell stands a wall on it, so the pair has two coincident, back-to-back faces
 * that nobody can see. Per contact this module measures the wall of the
 * neighbour on the shared plane (its height profile, from its own triangles)
 * and removes the part of a house's wall that the neighbour covers. Where the
 * neighbour is lower, the wall above it stays: that is the exposed party wall.
 * Everything is computed in the chunk frame, on pristine copies, so both
 * sides of a contact are trimmed consistently.
 */
import type {Bucket, BucketMap, P2, PartyContactReport} from './types.ts';

/** A footprint edge of house `a` shared with house `b`: the plane (origin, unit direction) and the overlap [s0, s1] along it. */
export interface Contact { a: number; b: number; ox: number; oz: number; dx: number; dz: number; s0: number; s1: number }

/** Shared edges between rings (frame coordinates x, z). `rings[i]` = outer rings of house i. */
export function findContacts(rings: P2[][][], tolM = 0.05, minOverlapM = 0.3): Contact[] {
  const out: Contact[] = [];
  const edges = (ring: P2[]) => ring.map((p, i) => [p, ring[(i + 1) % ring.length]] as const);
  for (let a = 0; a < rings.length; a++) for (let b = 0; b < rings.length; b++) {
    if (a === b) continue;
    for (const ringA of rings[a]) for (const [p0, p1] of edges(ringA)) {
      const la = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
      if (la < minOverlapM) continue;
      const dx = (p1[0] - p0[0]) / la, dz = (p1[1] - p0[1]) / la;
      for (const ringB of rings[b]) for (const [q0, q1] of edges(ringB)) {
        const lb = Math.hypot(q1[0] - q0[0], q1[1] - q0[1]);
        if (lb < minOverlapM) continue;
        // Antiparallel and on the same line.
        if (((q1[0] - q0[0]) * dx + (q1[1] - q0[1]) * dz) / lb > -0.999) continue;
        const dist = (q: P2) => Math.abs((q[0] - p0[0]) * -dz + (q[1] - p0[1]) * dx);
        if (dist(q0) > tolM || dist(q1) > tolM) continue;
        const t = (q: P2) => (q[0] - p0[0]) * dx + (q[1] - p0[1]) * dz;
        const s0 = Math.max(0, Math.min(t(q0), t(q1))), s1 = Math.min(la, Math.max(t(q0), t(q1)));
        if (s1 - s0 >= minOverlapM) out.push({a, b, ox: p0[0], oz: p0[1], dx, dz, s0, s1});
      }
    }
  }
  return out;
}

type Tri2 = [P2, P2, P2];

const sOf = (c: Contact, x: number, z: number) => (x - c.ox) * c.dx + (z - c.oz) * c.dz;
const dOf = (c: Contact, x: number, z: number) => Math.abs((x - c.ox) * -c.dz + (z - c.oz) * c.dx);
const area2 = (p: P2[]) => { let a = 0; for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; a += p[i][0] * q[1] - q[0] * p[i][1]; } return Math.abs(a) / 2; };

/** Is triangle `t` of the bucket a vertical wall face lying on the contact plane? Returns its (s, y) coordinates. */
function onPlane(c: Contact, b: Bucket, t: number, tolM: number): Tri2 | null {
  if (b.slot !== 'brick' || b.surface !== 'wall') return null;
  const tri: P2[] = [];
  for (let k = 0; k < 3; k++) {
    const i = t * 9 + k * 3, x = b.positions[i], y = b.positions[i + 1], z = b.positions[i + 2];
    if (dOf(c, x, z) > tolM) return null;
    tri.push([sOf(c, x, z), y]);
  }
  return area2(tri) > 1e-7 ? tri as Tri2 : null;
}

/** Wall triangles of a house on the contact plane, in plane (s, y) coordinates. */
export function planeTriangles(buckets: BucketMap, c: Contact, tolM: number): Tri2[] {
  const out: Tri2[] = [];
  for (const b of buckets.values()) for (let t = 0; t < b.positions.length / 9; t++) { const tri = onPlane(c, b, t, tolM); if (tri) out.push(tri); }
  return out;
}

/** Vertical extent [bottom, top] of a triangle set at s, or null. */
function extentAt(tris: Tri2[], s: number): [number, number] | null {
  let lo = Infinity, hi = -Infinity;
  for (const tri of tris) {
    for (let k = 0; k < 3; k++) {
      const p = tri[k], q = tri[(k + 1) % 3];
      if (s < Math.min(p[0], q[0]) - 1e-9 || s > Math.max(p[0], q[0]) + 1e-9) continue;
      if (Math.abs(p[0] - q[0]) < 1e-9) { lo = Math.min(lo, p[1], q[1]); hi = Math.max(hi, p[1], q[1]); continue; }
      const y = p[1] + (q[1] - p[1]) * (s - p[0]) / (q[0] - p[0]);
      lo = Math.min(lo, y); hi = Math.max(hi, y);
    }
  }
  return hi > -Infinity ? [lo, hi] : null;
}

/** Top of a house's wall at s, when it stands on the ground there (otherwise the wall is not treated as covering). */
export function wallTopAt(tris: Tri2[], s: number): number {
  const e = extentAt(tris, s);
  return e && e[0] < 0.15 ? e[1] : -1;
}

function clipHalf(poly: P2[], f: (p: P2) => number): P2[] {
  const out: P2[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], fa = f(a), fb = f(b);
    if (fa >= 0) out.push(a);
    if ((fa >= 0) !== (fb >= 0)) { const t = fa / (fa - fb); out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]); }
  }
  return out;
}

/**
 * Parts of `tri` (plane coordinates) that stay once `cover` removes everything
 * under its wall top inside [s0, s1]. `breaks` are the covering wall's vertex
 * positions: between two of them its top is linear (checked, and split when not).
 */
export function remainder(tri: Tri2, cover: Tri2[], s0: number, s1: number, breaks: number[], marginM = 0.003): P2[][] {
  const minS = Math.min(tri[0][0], tri[1][0], tri[2][0]), maxS = Math.max(tri[0][0], tri[1][0], tri[2][0]);
  const cuts = [...new Set([minS, ...[s0, s1, ...breaks].filter(v => v > minS + 1e-6 && v < maxS - 1e-6), maxS])].sort((p, q) => p - q);
  const out: P2[][] = [];
  const emit = (x0: number, x1: number, inside: boolean, depth = 0) => {
    let piece = clipHalf(tri, p => p[0] - x0); piece = clipHalf(piece, p => x1 - p[0]);
    if (piece.length < 3 || area2(piece) < 1e-8) return;
    if (!inside) { out.push(piece); return; }
    const e = 1e-5 * Math.min(1, x1 - x0), y0 = wallTopAt(cover, x0 + e), y1 = wallTopAt(cover, x1 - e), mid = (x0 + x1) / 2;
    if (depth < 4 && x1 - x0 > 0.04 && Math.abs(wallTopAt(cover, mid) - (y0 + y1) / 2) > 0.01) { emit(x0, mid, inside, depth + 1); emit(mid, x1, inside, depth + 1); return; }
    const line = (p: P2) => p[1] - (y0 + (y1 - y0) * (p[0] - x0) / (x1 - x0)) - marginM;
    const above = clipHalf(piece, line);
    if (above.length >= 3 && area2(above) > 1e-8) out.push(above);
  };
  for (let k = 0; k + 1 < cuts.length; k++) {
    const m = (cuts[k] + cuts[k + 1]) / 2;
    emit(cuts[k], cuts[k + 1], m > s0 && m < s1);
  }
  return out;
}

/** Rebuild 3D triangles for plane-coordinate polygons cut out of the original triangle `t` of `b`. */
function rebuild(b: Bucket, t: number, tri: Tri2, polys: P2[][], into: {positions: number[]; normals: number[]; uvs: number[]}) {
  const [a, bb, c] = tri, det = (bb[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (bb[1] - a[1]);
  const at = (q: P2) => {
    const l1 = ((q[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (q[1] - a[1])) / det, l2 = ((bb[0] - a[0]) * (q[1] - a[1]) - (q[0] - a[0]) * (bb[1] - a[1])) / det, l0 = 1 - l1 - l2;
    const mix = (src: number[], base: number, size: number) => Array.from({length: size}, (_, k) => l0 * src[base + k] + l1 * src[base + size + k] + l2 * src[base + 2 * size + k]);
    return {p: mix(b.positions, t * 9, 3), n: mix(b.normals, t * 9, 3), uv: mix(b.uvs, t * 6, 2)};
  };
  for (const poly of polys) for (let i = 1; i + 1 < poly.length; i++) for (const q of [poly[0], poly[i], poly[i + 1]]) {
    const v = at(q); into.positions.push(...v.p); into.normals.push(...v.n); into.uvs.push(...v.uv);
  }
}

export interface PartyHouse { id: string; buckets: BucketMap }

/**
 * Trim every house's party-wall faces against its neighbours' walls. Mutates
 * the house buckets; returns one report row per ordered contact.
 */
export function trimPartyWalls(houses: PartyHouse[], contacts: Contact[], tolM = 0.05): PartyContactReport[] {
  // Coverage is read from pristine copies: both sides of a contact see the other's original wall.
  const cover = contacts.map(c => planeTriangles(houses[c.b].buckets, c, tolM));
  const reports: PartyContactReport[] = [];
  contacts.forEach((c, ci) => {
    const covering = cover[ci];
    if (!covering.length) return;
    const breaks = [...new Set(covering.flatMap(t => t.map(p => p[0])))].filter(s => s > c.s0 && s < c.s1);
    let removed = 0, exposed = 0, topA = 0, topB = 0, kept = 0;
    for (const bucket of houses[c.a].buckets.values()) {
      if (bucket.slot !== 'brick' || bucket.surface !== 'wall') continue;
      const next = {positions: [] as number[], normals: [] as number[], uvs: [] as number[]};
      for (let t = 0; t < bucket.positions.length / 9; t++) {
        const tri = onPlane(c, bucket, t, tolM);
        const keepWhole = () => { next.positions.push(...bucket.positions.slice(t * 9, t * 9 + 9)); next.normals.push(...bucket.normals.slice(t * 9, t * 9 + 9)); next.uvs.push(...bucket.uvs.slice(t * 6, t * 6 + 6)); };
        if (!tri || Math.max(tri[0][0], tri[1][0], tri[2][0]) <= c.s0 + 1e-6 || Math.min(tri[0][0], tri[1][0], tri[2][0]) >= c.s1 - 1e-6) { keepWhole(); continue; }
        const clipped = remainder(tri, covering, c.s0, c.s1, breaks);
        const within = (poly: P2[]) => { const q = clipHalf(clipHalf(poly, p => p[0] - c.s0), p => c.s1 - p[0]); return q.length >= 3 ? area2(q) : 0; };
        const before = within(tri);
        // Never add triangles: a partly covered face is cut only when the remainder is a single triangle
        // (or nothing); otherwise it stays whole. The covered part lies inside the neighbour, out of sight.
        const pieces = clipped.reduce((n, poly) => n + poly.length - 2, 0);
        const polys = pieces <= 1 ? clipped : [tri];
        const after = clipped.reduce((sum, p) => sum + within(p), 0);
        removed += before - after; exposed += after;
        topA = Math.max(topA, ...tri.map(p => p[1]));
        if (pieces <= 1) rebuild(bucket, t, tri, polys, next); else keepWhole();
        if (pieces > 1) kept++;
      }
      bucket.positions = next.positions; bucket.normals = next.normals; bucket.uvs = next.uvs;
    }
    for (const tri of covering) topB = Math.max(topB, ...tri.map(p => p[1]));
    reports.push({a: houses[c.a].id, b: houses[c.b].id, lengthM: +(c.s1 - c.s0).toFixed(2), removedAreaA: +removed.toFixed(2), exposedAreaA: +exposed.toFixed(2), topA: +topA.toFixed(2), topB: +topB.toFixed(2), keptWhole: kept});
  });
  return reports;
}
