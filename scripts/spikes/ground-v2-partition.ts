// G2-design feasibility spike (lane G2-design #370, 2026-11-10). NOT production code; nothing imports it.
//
// For a few real cells it builds the ground-v2 planar partition from today's extracts (roads-v1, parks-v1,
// courtyards-v1, open-ground-v1, OSM areas, water) by precedence, in integer millimetres of the cell-local game frame,
// with polygon-clipping (installed) and clipper2-js (G2_DEPS, a scratch npm prefix), then a constrained Delaunay
// triangulation (cdt2d or @kninnug/constrainautor + delaunator) with adaptive Steiner points from the relief
// (quadtree: split while bilinear error > 5 cm, 2 m floor). It prints times, vertex/triangle counts, the baked
// byte estimate, and today's buildCell numbers for the same cell.
//
//   G2_DEPS=/path/to/scratch/node_modules npx tsx scripts/spikes/ground-v2-partition.ts [key …]
import { readFileSync, existsSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { GroundStore, toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { buildCell } from '../../src/canalRecall/ownGround/groundCell.ts';
import { decodeLine } from '../../src/canalRecall/ownGround/parks.ts';
import { MeshoptEncoder } from 'meshoptimizer';

const DEPS = process.env.G2_DEPS ?? join(process.cwd(), 'node_modules');
const req = createRequire(join(DEPS, 'x.js'));
const has = (m: string) => { try { req.resolve(m); return true; } catch { return false; } };

const ROOT = 'public/data/extracts/amsterdam';
const readExtract = async (p: string) => { const f = join(ROOT, p); if (!existsSync(f)) throw new Error(`${p}: missing`); const b = readFileSync(f); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); };
const store = new GroundStore(readExtract, { roads: true });

type Ring = [number, number][]; type Poly = Ring[]; type MPoly = Poly[];
const CLASSES = ['water', 'carriage', 'cycle', 'foot', 'rail', 'parking', 'courtyard', 'park', 'open', 'osm', 'land'] as const;
type Cls = typeof CLASSES[number];

async function inputs(key: string) {
  const input = await store.cellInput(key, 0);
  const [x0, y0, x1, y1] = input.rect;
  const mm = (p: readonly number[]): [number, number] => [Math.round((p[0] - x0) * 1000), Math.round((p[1] - y0) * 1000)];
  const by: Record<Cls, MPoly> = Object.fromEntries(CLASSES.map(c => [c, []])) as any;
  let decks = 0;
  const own = (rs: Ring[]) => rs.length && rs[0].length >= 3;
  for (const s of input.roads?.surfaces ?? []) {
    if (s.h !== 0) { decks++; continue; }
    const rings = s.r.map(e => decodeLine(e).map(mm));
    if (!own(rings)) continue;
    const c: Cls = s.k === 'cycle' || s.c === 'cycle' ? 'cycle' : s.c === 'carriage' ? 'carriage' : s.c === 'parking' ? 'parking' : s.k === 'grass' || s.c === 'verge' ? 'park' : 'foot';
    by[c].push(rings);
  }
  for (const s of input.parks?.surfaces ?? []) { const rings = s.r.map(e => decodeLine(e).map(mm)); if (own(rings)) by.park.push(rings); }
  for (const a of input.courtyards?.areas ?? []) { const rings = a.r.map(e => decodeLine(e).map(mm)); if (own(rings)) by.courtyard.push(rings); }
  for (const a of input.openGround?.areas ?? []) { const rings = a.r.map(e => decodeLine(e).map(mm)); if (own(rings)) by.open.push(rings); }
  for (const a of input.osm?.areas ?? []) { const rings = a.rings.map(r => r.map(p => mm(input.project(p)))); if (own(rings)) by.osm.push(rings); }
  for (const poly of input.water?.polygons ?? []) by.water.push(poly.map(r => r.map(mm)));
  const rect: Ring = [[0, 0], [(x1 - x0) * 1000, 0], [(x1 - x0) * 1000, (y1 - y0) * 1000], [0, (y1 - y0) * 1000], [0, 0]];
  return { input, by, decks, rect };
}

const close = (r: Ring): Ring => (r.length && (r[0][0] !== r[r.length - 1][0] || r[0][1] !== r[r.length - 1][1]) ? [...r, r[0]] : r);
const verts = (m: MPoly) => m.reduce((s, p) => s + p.reduce((t, r) => t + r.length, 0), 0);
const areaRing = (r: Ring) => { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]); return a / 2; };
const areaM2 = (m: MPoly) => m.reduce((s, p) => s + Math.abs(areaRing(p[0])) - p.slice(1).reduce((t, r) => t + Math.abs(areaRing(r)), 0), 0) / 1e6;

/** Precedence partition: piece(c) = (∪ c ∩ rect) − taken; taken ∪= ∪ c; land = rect − taken. */
function partitionPC(by: Record<Cls, MPoly>, rect: Ring) {
  const pc = req('polygon-clipping');
  const out: Partial<Record<Cls, MPoly>> = {}; let taken: MPoly = []; const errors: string[] = [];
  for (const c of CLASSES) {
    try {
      let mine: MPoly = c === 'land' ? [[rect]] : by[c].length ? pc.intersection([[rect]], pc.union(...by[c].map(p => p.map(close)))) : [];
      if (c !== 'land' && !by[c].length) mine = [];
      const piece = taken.length && mine.length ? pc.difference(mine, taken) : mine;
      out[c] = piece; if (mine.length) taken = taken.length ? pc.union(taken, mine) : mine;
    } catch (e) { errors.push(`${c}: ${String(e).slice(0, 80)}`); out[c] = []; }
  }
  return { out, errors };
}

function partitionClipper(by: Record<Cls, MPoly>, rect: Ring) {
  const C = req('clipper2-js');
  const { Clipper64, Paths64, Path64, Point64, ClipType, FillRule, PolyTree64 } = C;
  const paths = (polys: MPoly) => { const ps = new Paths64(); for (const p of polys) for (const r of p) { const q = new Path64(); for (const [x, y] of r) q.push(new Point64(x, y)); ps.push(q); } return ps; };
  // Clipper64.execute(ct, fr, sol) returned true with an empty solution in clipper2-js 1.2.4 (spike probe); the static helpers work.
  const run = (ct: any, subj: any, clip: any) => ct === ClipType.Union ? C.Clipper.Union(subj, clip, FillRule.NonZero) : ct === ClipType.Difference ? C.Clipper.Difference(subj, clip, FillRule.NonZero) : C.Clipper.Intersect(subj, clip, FillRule.NonZero);
  const rp = paths([[rect]]);
  const out: Partial<Record<Cls, any>> = {}; let taken = new Paths64(); const errors: string[] = [];
  for (const c of CLASSES) {
    try {
      // NonZero over the class's rings: holes are reversed rings in BGT? Not guaranteed: union each polygon with EvenOdd first.
      let mine: any;
      if (c === 'land') mine = rp; else {
        const u = new Paths64();
        for (const p of by[c]) for (const q of C.Clipper.Union(paths([p]), new Paths64(), FillRule.EvenOdd)) u.push(q);
        mine = run(ClipType.Intersection, u, rp);
      }
      const piece = taken.length ? run(ClipType.Difference, mine, taken) : mine;
      out[c] = piece; taken = run(ClipType.Union, taken, mine);
    } catch (e) { errors.push(`${c}: ${String(e).slice(0, 80)}`); }
  }
  const toM = (ps: any): MPoly => { // signed rings → outer+holes is not needed for counts; area via signed sum
    return [...ps].map((p: any) => [[...p].map((q: any) => [Number(q.x), Number(q.y)] as [number, number])]);
  };
  const conv: Partial<Record<Cls, MPoly>> = {}; for (const c of CLASSES) conv[c] = out[c] ? toM(out[c]) : [];
  return { out: conv, errors, signedArea: (m: MPoly) => m.reduce((s, p) => s + areaRing(p[0]), 0) / 1e6 };
}

/** Adaptive Steiner points: quadtree over the cell, split while the relief departs > tol from the bilinear patch. */
function steiner(input: any, tol = 0.05, minM = 2, maxM = 32) {
  const [x0, y0, x1] = input.rect; const size = x1 - x0; const g = (x: number, y: number) => input.surface.ground(x0 + x, y0 + y);
  const pts = new Map<string, [number, number]>();
  const leaf = (x: number, y: number, s: number) => { for (const [a, b] of [[x, y], [x + s, y], [x, y + s], [x + s, y + s]]) pts.set(`${a},${b}`, [a, b]); };
  const rec = (x: number, y: number, s: number) => {
    if (s > maxM) { const h = s / 2; rec(x, y, h); rec(x + h, y, h); rec(x, y + h, h); rec(x + h, y + h, h); return; }
    if (s <= minM) { leaf(x, y, s); return; }
    const z00 = g(x, y), z10 = g(x + s, y), z01 = g(x, y + s), z11 = g(x + s, y + s); let worst = 0;
    const n = Math.max(2, Math.round(s / minM));
    for (let i = 0; i <= n && worst <= tol; i++) for (let j = 0; j <= n; j++) {
      const u = i / n, v = j / n, z = g(x + u * s, y + v * s), b = (1 - u) * (1 - v) * z00 + u * (1 - v) * z10 + (1 - u) * v * z01 + u * v * z11;
      const e = Math.abs(z - b); if (e === e && e > worst) worst = e; if (worst > tol) break;
    }
    if (worst > tol) { const h = s / 2; rec(x, y, h); rec(x + h, y, h); rec(x, y + h, h); rec(x + h, y + h, h); } else leaf(x, y, s);
  };
  rec(0, 0, 1024 > size ? 1024 : size); // power-of-two root covering the cell
  return [...pts.values()].filter(([x, y]) => x <= size && y <= size);
}

/** Class of each triangle by its centroid (even-odd per class over 1 m strips of partition edges): -1 = none (a crack). */
function classify(parts: Partial<Record<Cls, MPoly>>, P: [number, number][], tris: ArrayLike<number>) {
  const STRIP = 1000; const strips = new Map<number, { x0: number; y0: number; x1: number; y1: number; c: number }[]>();
  CLASSES.forEach((c, ci) => { for (const p of parts[c] ?? []) for (const r of p) for (let i = 0; i < r.length; i++) {
    const a = r[i], b = r[(i + 1) % r.length]; if (a[1] === b[1]) continue;
    for (let k = Math.floor(Math.min(a[1], b[1]) / STRIP); k <= Math.floor(Math.max(a[1], b[1]) / STRIP); k++) { let l = strips.get(k); if (!l) strips.set(k, l = []); l.push({ x0: a[0], y0: a[1], x1: b[0], y1: b[1], c: ci }); }
  } });
  const area = new Float64Array(CLASSES.length + 1); let none = 0, multi = 0; const per = new Int8Array(tris.length / 3);
  for (let t = 0; t < tris.length; t += 3) {
    const A = P[tris[t]], B = P[tris[t + 1]], Cc = P[tris[t + 2]]; const cx = (A[0] + B[0] + Cc[0]) / 3, cy = (A[1] + B[1] + Cc[1]) / 3;
    const ar = Math.abs((B[0] - A[0]) * (Cc[1] - A[1]) - (Cc[0] - A[0]) * (B[1] - A[1])) / 2 / 1e6;
    const par = new Uint8Array(CLASSES.length);
    for (const e of strips.get(Math.floor(cy / STRIP)) ?? []) if ((e.y0 > cy) !== (e.y1 > cy) && cx < e.x0 + (cy - e.y0) * (e.x1 - e.x0) / (e.y1 - e.y0)) par[e.c] ^= 1;
    let n = 0, cls = -1; for (let i = 0; i < par.length; i++) if (par[i]) { n++; cls = i; }
    per[t / 3] = cls; if (n === 0) { none++; area[CLASSES.length] += ar; } else { if (n > 1) multi++; area[cls] += ar; }
  }
  return { per, none, multi, uncoveredM2: +area[CLASSES.length].toFixed(1), m2: Object.fromEntries(CLASSES.map((c, i) => [c, Math.round(area[i])])) };
}

function triangulate(parts: Partial<Record<Cls, MPoly>>, extra: [number, number][], heightMm?: (x: number, y: number) => number) {
  const partsRef = parts;
  // Points (mm) + constraint edges from every partition ring, deduplicated by exact coordinate (shared vertices).
  const id = new Map<string, number>(); const P: [number, number][] = []; const E: [number, number][] = [];
  const at = (x: number, y: number) => { const k = `${x},${y}`; let i = id.get(k); if (i === undefined) { i = P.length; id.set(k, i); P.push([x, y]); } return i; };
  const edgeSeen = new Set<string>();
  for (const c of CLASSES) for (const p of parts[c] ?? []) for (const r of p) for (let i = 0; i + 1 < r.length; i++) {
    const a = at(r[i][0], r[i][1]), b = at(r[i + 1][0], r[i + 1][1]); if (a === b) continue; const k = a < b ? `${a}-${b}` : `${b}-${a}`; if (!edgeSeen.has(k)) { edgeSeen.add(k); E.push([a, b]); }
  }
  const constrained = P.length;
  // Noding (the shared-edge snap): a partition vertex within NODE_MM of another edge's interior splits that edge, so
  // no constraint passes through a point (T-junctions between pieces of different classes become shared vertices).
  const NODE_MM = 2, B = 1000; const grid = new Map<string, number[]>();
  P.forEach(([x, y], i) => { const k = `${Math.floor(x / B)},${Math.floor(y / B)}`; let l = grid.get(k); if (!l) grid.set(k, l = []); l.push(i); });
  let splits = 0; const noded: [number, number][] = [];
  for (const [a0, b0] of E) {
    const [ax, ay] = P[a0], [bx, by] = P[b0], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy; const on: [number, number][] = [];
    for (let gx = Math.floor((Math.min(ax, bx) - NODE_MM) / B); gx <= Math.floor((Math.max(ax, bx) + NODE_MM) / B); gx++) for (let gy = Math.floor((Math.min(ay, by) - NODE_MM) / B); gy <= Math.floor((Math.max(ay, by) + NODE_MM) / B); gy++)
      for (const i of grid.get(`${gx},${gy}`) ?? []) { if (i === a0 || i === b0) continue; const t = ((P[i][0] - ax) * dx + (P[i][1] - ay) * dy) / L2; if (t <= 0 || t >= 1) continue; const ex = ax + t * dx - P[i][0], ey = ay + t * dy - P[i][1]; if (ex * ex + ey * ey <= NODE_MM * NODE_MM) on.push([t, i]); }
    if (!on.length) { noded.push([a0, b0]); continue; }
    on.sort((u, v) => u[0] - v[0]); splits += on.length; let prev = a0; for (const [, i] of on) { if (i !== prev) noded.push([prev, i]); prev = i; } if (prev !== b0) noded.push([prev, b0]);
  }
  E.length = 0; const seen2 = new Set<string>(); for (const [a, b] of noded) { const k = a < b ? `${a}-${b}` : `${b}-${a}`; if (!seen2.has(k)) { seen2.add(k); E.push([a, b]); } }
  // Edge densification: split a constraint at its midpoint while the relief there departs > 5 cm from the chord
  // (down to 1 m), so a long kerb or boundary follows the ground (G2 needs it; the quadtree alone leaves 100 m chords).
  let densified = 0;
  if (heightMm) {
    const out: [number, number][] = [];
    const rec = (a: number, b: number, depth: number) => {
      const [ax, ay] = P[a], [bx, by] = P[b], L = Math.hypot(bx - ax, by - ay);
      if (L > 1000 && depth < 12) { const mx = Math.round((ax + bx) / 2), my = Math.round((ay + by) / 2); const e = Math.abs(heightMm(mx, my) - (heightMm(ax, ay) + heightMm(bx, by)) / 2);
        if (e > 50 || L > 64000) { const m = at(mx, my); densified++; rec(a, m, depth + 1); rec(m, b, depth + 1); return; } }
      out.push([a, b]);
    };
    for (const [a, b] of E) rec(a, b, 0);
    E.length = 0; E.push(...out);
  }
  // Steiner points off the constraints: none within CLEAR_MM of an edge (a point on a constraint fails it).
  const CLEAR_MM = 300, EB = 2000; const egrid = new Map<string, number[]>();
  E.forEach(([a, b], ei) => { for (let gx = Math.floor((Math.min(P[a][0], P[b][0]) - CLEAR_MM) / EB); gx <= Math.floor((Math.max(P[a][0], P[b][0]) + CLEAR_MM) / EB); gx++) for (let gy = Math.floor((Math.min(P[a][1], P[b][1]) - CLEAR_MM) / EB); gy <= Math.floor((Math.max(P[a][1], P[b][1]) + CLEAR_MM) / EB); gy++) { const k = `${gx},${gy}`; let l = egrid.get(k); if (!l) egrid.set(k, l = []); l.push(ei); } });
  let dropped = 0;
  for (const [sx, sy] of extra) {
    const x = Math.round(sx * 1000), y = Math.round(sy * 1000); let near = false;
    for (const ei of egrid.get(`${Math.floor(x / EB)},${Math.floor(y / EB)}`) ?? []) { const [a, b] = E[ei], [ax, ay] = P[a], [bx, by] = P[b], dx = bx - ax, dy = by - ay; const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy))); const ex = ax + t * dx - x, ey = ay + t * dy - y; if (ex * ex + ey * ey < CLEAR_MM * CLEAR_MM) { near = true; break; } }
    if (near) dropped++; else at(x, y);
  }
  const res: Record<string, any> = { points: P.length, partitionPoints: constrained, edges: E.length, nodeSplits: splits, steinerDropped: dropped, densified };
  if (has('@kninnug/constrainautor') && has('delaunator')) {
    const D = req('delaunator'); const Delaunator = D.default ?? D; const CA = req('@kninnug/constrainautor'); const Constrainautor = CA.default ?? CA.Constrainautor ?? CA;
    // Delaunay refinement against the relief: a triangle (not water) whose centroid departs > 5 cm gets its centroid as a
    // Steiner point (unless within 100 mm of a constraint), re-triangulated, up to G2_REFINE rounds.
    const ROUNDS = Number(process.env.G2_REFINE ?? 3); const rounds: Record<string, number>[] = []; const t = performance.now();
    const zc = new Map<number, number>(); const Z = (i: number) => { let z = zc.get(i); if (z === undefined) { z = heightMm!(P[i][0], P[i][1]); zc.set(i, z); } return z; };
    const nearEdge = (x: number, y: number, clear: number) => { for (const ei of egrid.get(`${Math.floor(x / EB)},${Math.floor(y / EB)}`) ?? []) { const [a, b] = E[ei], [ax, ay] = P[a], [bx, by] = P[b], dx = bx - ax, dy = by - ay; const u = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy))); const ex = ax + u * dx - x, ey = ay + u * dy - y; if (ex * ex + ey * ey < clear * clear) return true; } return false; };
    for (let round = 0; ; round++) {
      const flat = new Float64Array(P.length * 2); P.forEach(([x, y], i) => { flat[2 * i] = x; flat[2 * i + 1] = y; });
      const del = new Delaunator(flat); const con = new Constrainautor(del); let failed = 0; for (const [a, b] of E) { try { con.constrainOne(a, b); } catch { failed++; } }
      const cls = classify(partsRef, P, del.triangles); const T3 = del.triangles; const errs: number[] = []; let bad = 0, badA = 0, added = 0; const adds: [number, number][] = [];
      for (let k = 0; k < T3.length; k += 3) {
        if (cls.per[k / 3] === 0) continue; // water: not draped
        const [a, b, c] = [T3[k], T3[k + 1], T3[k + 2]]; const cx = (P[a][0] + P[b][0] + P[c][0]) / 3, cy = (P[a][1] + P[b][1] + P[c][1]) / 3; const h = heightMm!(cx, cy); if (h !== h) continue;
        const e = Math.abs(h - (Z(a) + Z(b) + Z(c)) / 3); errs.push(e);
        if (e > 50) { bad++; badA += Math.abs((P[b][0] - P[a][0]) * (P[c][1] - P[a][1]) - (P[c][0] - P[a][0]) * (P[b][1] - P[a][1])) / 2e6; if (round < ROUNDS && !nearEdge(Math.round(cx), Math.round(cy), 100)) adds.push([Math.round(cx), Math.round(cy)]); }
      }
      errs.sort((u, v) => u - v);
      rounds.push({ points: P.length, triangles: T3.length / 3, failedEdges: failed, p50: Math.round(errs[errs.length >> 1]), p99: Math.round(errs[Math.floor(errs.length * 0.99)]), p999: Math.round(errs[Math.floor(errs.length * 0.999)]), max: Math.round(errs[errs.length - 1]), over5cm: bad, over5cmM2: Math.round(badA) });
      if (!adds.length || round >= ROUNDS) { res.constrainautor = { ms: Math.round(performance.now() - t), triangles: T3.length / 3, failedEdges: failed }; res.tris = T3; res.P = P; res.rounds = rounds; const { per, ...rest } = cls; res.classify = rest; break; }
      for (const [x, y] of adds) { at(x, y); added++; }
    }
  }
  if (has('cdt2d') && process.env.G2_CDT2D) {
    const cdt2d = req('cdt2d'); const t = performance.now();
    try { const tris = cdt2d(P, E, { exterior: true }); res.cdt2d = { ms: Math.round(performance.now() - t), triangles: tris.length }; } catch (e) { res.cdt2d = { error: String(e).slice(0, 120) }; }
  }
  return res;
}

const KEYS = process.argv.slice(2).length ? process.argv.slice(2) : null;
await store.init();
const named: [string, number, number][] = [['Overschiestraat / Kranenbergpad (G0 cell)', 4.841, 52.34335], ['Schinkel / Jachthavenweg (G0 cell)', 4.85369, 52.33664], ['Westerkerk (belt)', 4.8839, 52.3745], ['Piet Kranenbergpad (Zuid)', 4.8575, 52.3386], ['Vlaardingenlaan (flat, west)', 4.8295, 52.3544], ['Cornelis Lelylaan', 4.8337, 52.3620]];
const keys = KEYS ?? named.map(([n, lng, lat]) => { const [x, y] = toLocal(lng, lat); const k = store.cellAt(x, y); console.error(`${n} → ${k}`); return k; });
for (const key of keys) {
  const t0 = performance.now(); const { input, by, decks, rect } = await inputs(key); const tIn = performance.now() - t0;
  const t1 = performance.now(); const today = buildCell(input); const tToday = performance.now() - t1;
  const inVerts = Object.fromEntries(CLASSES.map(c => [c, `${by[c].length}p/${verts(by[c])}v`]));
  const t2 = performance.now(); const pc = partitionPC(by, rect); const tPC = performance.now() - t2;
  let cl: any = null, tCL = NaN; if (has('clipper2-js') && process.env.G2_CLIPPER) { const t3 = performance.now(); cl = partitionClipper(by, rect); tCL = performance.now() - t3; }
  const pcArea = Object.fromEntries(CLASSES.map(c => [c, +areaM2(pc.out[c] ?? []).toFixed(0)]));
  const clArea = cl ? Object.fromEntries(CLASSES.map(c => [c, +cl.signedArea(cl.out[c] ?? []).toFixed(0)])) : null;
  const sumPC = Object.values(pcArea).reduce((a, b) => a + b, 0), sumCL = clArea ? Object.values(clArea).reduce((a: number, b: any) => a + b, 0) : NaN;
  const t4 = performance.now(); const st = steiner(input, Number(process.env.G2_TOL ?? 0.05)); const tSt = performance.now() - t4;
  const hmm = (x: number, y: number) => 1000 * input.surface.ground(input.rect[0] + x / 1000, input.rect[1] + y / 1000);
  const tri = triangulate(pc.out, st, hmm);
  const T = (tri.constrainautor as any)?.triangles ?? (tri.cdt2d as any)?.triangles ?? 0;
  // Baked estimate: positions uint16 x,y (1.6 cm over 1 km … see doc) + uint16 z, oct normal 2 B → 8 B/vertex; uint16/uint32 indices.
  const V = (tri.P ? tri.P.length : tri.points) as number, idxB = (V > 65535 ? 4 : 2) * 3 * T; const raw = 8 * V + idxB;
  let gzMB = NaN, meshoptGzMB = NaN;
  if (tri.tris) { // real buffer: x,y uint16 (cell + 0..1000 m at 1000/65535 m), z uint16 mm, no normals (derived), indices
    const P = tri.P as [number, number][], b = Buffer.alloc(6 * P.length + idxB);
    P.forEach(([x, y], i) => { b.writeUInt16LE(Math.max(0, Math.min(65535, Math.round(x / 1e6 * 65535))), 6 * i); b.writeUInt16LE(Math.max(0, Math.min(65535, Math.round(y / 1e6 * 65535))), 6 * i + 2); const z = input.surface.ground(input.rect[0] + x / 1000, input.rect[1] + y / 1000); b.writeUInt16LE(Math.max(0, Math.min(65535, Math.round(((z === z ? z : 0) + 10) * 1000))), 6 * i + 4); });
    const t = tri.tris as Uint32Array; for (let i = 0; i < t.length; i++) V > 65535 ? b.writeUInt32LE(t[i], 6 * P.length + 4 * i) : b.writeUInt16LE(t[i], 6 * P.length + 2 * i);
    gzMB = +(gzipSync(b, { level: 9 }).length / 1048576).toFixed(2);
    // meshopt (installed; three ships the decoder): vertex stream 8 B (x, y, z uint16 + layer/pad), optimised index order.
    await MeshoptEncoder.ready; const vb = new Uint8Array(8 * P.length);
    for (let i = 0; i < P.length; i++) for (let k = 0; k < 6; k++) vb[8 * i + k] = b[6 * i + k];
    const ib = Uint32Array.from(t); const enc = MeshoptEncoder.encodeIndexBuffer(new Uint8Array(ib.buffer), ib.length, 4); const venc = MeshoptEncoder.encodeVertexBuffer(vb, P.length, 8);
    meshoptGzMB = +(gzipSync(Buffer.concat([Buffer.from(venc), Buffer.from(enc)]), { level: 9 }).length / 1048576).toFixed(2);
  }
  delete (tri as any).tris; delete (tri as any).P;
  console.log(JSON.stringify({ key, decksSkipped: decks, inputMs: Math.round(tIn),
    today: { ms: Math.round(tToday), triangles: today.stats.triangles, MB: +(today.stats.bytes / 1048576).toFixed(1), layers: Object.keys(today.layers).length },
    inputs: inVerts,
    polygonClipping: { ms: Math.round(tPC), errors: pc.errors, outVerts: Object.fromEntries(CLASSES.map(c => [c, verts(pc.out[c] ?? [])])), areaSumM2: Math.round(sumPC) },
    clipper2: cl ? { ms: Math.round(tCL), errors: cl.errors, outVerts: Object.fromEntries(CLASSES.map(c => [c, verts(cl.out[c] ?? [])])), areaSumM2: Math.round(sumCL) } : 'not installed',
    areaByClass: pcArea, areaByClassClipper: clArea,
    steiner: { ms: Math.round(tSt), points: st.length }, cdt: tri, bakedRawMB: +(raw / 1048576).toFixed(2), bakedGzMB: gzMB, meshoptGzMB }, null, 0));
}
