/**
 * Dissolve the coplanar 3DBAG wall surfaces of one panel into whole faces, so a large-tier opening that straddles two
 * surfaces (3DBAG splits walls into vertical strips at every roof-part boundary) can still be cut into the wall.
 *
 * In the panel's (u, v) frame: every ring is oriented (outer CCW, holes CW), edges are split at T-junction vertices,
 * edges shared by two surfaces in opposite directions cancel, and the rest is chained into rings (at a vertex with several
 * exits, the sharpest left turn). Every output vertex is an original 3DBAG vertex, so the face outlines still meet the
 * roofs and neighbouring walls exactly. Returns null (callers keep the separate surfaces) when the result does not
 * have the same area as the inputs.
 */
import type { V3 } from './mesh.ts';
import { pointInRing, type Poly2 } from './panels.ts';

type P2 = [number, number];
export interface DissolveInput { rings: V3[][]; poly: Poly2 }
export interface DissolvedFace { rings: V3[][]; poly: Poly2 }

const area2 = (r: P2[]) => { let a = 0; for (let i = 0; i < r.length; i++) { const p = r[i], q = r[(i + 1) % r.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };

export function dissolveFaces(members: DissolveInput[], to2: (p: V3) => P2): DissolvedFace[] | null {
  const key = (p: P2) => `${Math.round(p[0] * 1000)},${Math.round(p[1] * 1000)}`;
  const verts = new Map<string, { uv: P2; xyz: V3 }>();
  const edges: [string, string][] = [];
  let inputArea = 0;
  for (const m of members) {
    m.rings.forEach((ring3, ri) => {
      const pts = ring3.map(p => ({ uv: to2(p), xyz: p }));
      const ring = pts.filter((p, i) => key(p.uv) !== key(pts[(i + 1) % pts.length].uv));
      if (ring.length < 3) return;
      const a = area2(ring.map(p => p.uv)), wantCCW = ri === 0;
      if (Math.abs(a) < 1e-6) return;
      inputArea += ri === 0 ? Math.abs(a) : -Math.abs(a);
      const ordered = (a > 0) === wantCCW ? ring : [...ring].reverse();
      for (const p of ordered) if (!verts.has(key(p.uv))) verts.set(key(p.uv), p);
      ordered.forEach((p, i) => edges.push([key(p.uv), key(ordered[(i + 1) % ordered.length].uv)]));
    });
  }
  // Split edges at T-junctions: any vertex lying on an edge's interior (within 2 mm).
  const all = [...verts.values()], split: [string, string][] = [];
  for (const [a, b] of edges) {
    const A = verts.get(a)!.uv, B = verts.get(b)!.uv, dx = B[0] - A[0], dy = B[1] - A[1], len2 = dx * dx + dy * dy;
    const on: { t: number; k: string }[] = [];
    for (const v of all) {
      const t = ((v.uv[0] - A[0]) * dx + (v.uv[1] - A[1]) * dy) / len2;
      if (t <= 1e-6 || t >= 1 - 1e-6) continue;
      if (Math.hypot(A[0] + t * dx - v.uv[0], A[1] + t * dy - v.uv[1]) < 0.002) on.push({ t, k: key(v.uv) });
    }
    on.sort((x, y) => x.t - y.t);
    let prev = a;
    for (const o of on) { if (o.k !== prev) split.push([prev, o.k]); prev = o.k; }
    if (prev !== b) split.push([prev, b]);
  }
  // Cancel opposite pairs.
  const count = new Map<string, number>();
  for (const [a, b] of split) count.set(`${a}>${b}`, (count.get(`${a}>${b}`) ?? 0) + 1);
  const left: [string, string][] = [];
  for (const [a, b] of split) {
    const f = `${a}>${b}`, r = `${b}>${a}`;
    if ((count.get(r) ?? 0) > 0 && (count.get(f) ?? 0) > 0) { count.set(r, count.get(r)! - 1); count.set(f, count.get(f)! - 1); continue; }
    if ((count.get(f) ?? 0) > 0) { count.set(f, count.get(f)! - 1); left.push([a, b]); }
  }
  // Chain.
  const out = new Map<string, number[]>();
  left.forEach(([a], i) => { const l = out.get(a); if (l) l.push(i); else out.set(a, [i]); });
  const used = new Set<number>(), rings: string[][] = [];
  for (let s = 0; s < left.length; s++) {
    if (used.has(s)) continue;
    const ring: string[] = [];
    let e = s;
    for (let guard = 0; guard < left.length + 1; guard++) {
      used.add(e); ring.push(left[e][0]);
      const [a, b] = left[e];
      if (b === left[s][0]) break;
      const cands = (out.get(b) ?? []).filter(i => !used.has(i));
      if (!cands.length) return null;
      const A = verts.get(a)!.uv, B = verts.get(b)!.uv, din = Math.atan2(B[1] - A[1], B[0] - A[0]);
      // Sharpest left turn keeps faces separate where two rings touch at a vertex.
      e = cands.map(i => { const C = verts.get(left[i][1])!.uv; let turn = Math.atan2(C[1] - B[1], C[0] - B[0]) - din; while (turn <= -Math.PI) turn += 2 * Math.PI; while (turn > Math.PI) turn -= 2 * Math.PI; return { i, turn }; }).sort((x, y) => y.turn - x.turn)[0].i;
    }
    if (ring.length >= 3) rings.push(ring);
  }
  const outers = rings.filter(r => area2(r.map(k => verts.get(k)!.uv)) > 1e-6), holes = rings.filter(r => area2(r.map(k => verts.get(k)!.uv)) < -1e-6);
  const net = outers.reduce((s, r) => s + area2(r.map(k => verts.get(k)!.uv)), 0) + holes.reduce((s, r) => s + area2(r.map(k => verts.get(k)!.uv)), 0);
  if (!outers.length || Math.abs(net - inputArea) > Math.max(0.01, 0.005 * inputArea)) return null;
  const faces: DissolvedFace[] = outers.map(r => ({ rings: [r.map(k => verts.get(k)!.xyz)], poly: { outer: r.map(k => verts.get(k)!.uv), holes: [] } }));
  for (const h of holes) {
    const probe = verts.get(h[0])!.uv, f = faces.find(face => pointInRing(probe, face.poly.outer)) ?? null;
    if (!f) return null;
    f.rings.push(h.map(k => verts.get(k)!.xyz)); f.poly.holes.push(h.map(k => verts.get(k)!.uv));
  }
  return faces;
}
