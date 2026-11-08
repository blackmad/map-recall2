// Tunnel wall edge roughness in the own ground (engine round 5, lane R5-C2, issue #263; user shot U3 at Rapenburg:
// pale shards hanging over the IJ-tunnel ramp walls).
//
//   npx tsx scripts/own-ground/probe-portal-edges.ts [lng lat radiusM=120] [--roads=0] [--portalClip=0]
//
// Builds the LOD 0 cells around the point as the game does (roads-v1 on unless --roads=0) and, for every walled
// station of every cut within the radius, looks at the ground triangles (every layer except the cut's own walls and
// floor, kerbs, paint) within WALL_BAND_M of the wall line:
//   straddle  a triangle with vertices on both sides of the wall line (inside the strip and outside it) whose height
//             spans more than 0.3 m: it slopes from the rim down to the floor across the wall: a shard;
//   offLevel  a vertex within the band whose height is more than 0.3 m off the level the cut says (the floor inside
//             the strip, the ground outside): mean and p95 deviation, metres.
// Counted per layer. The wall-line deviation is the distance of a straddling triangle's farthest vertex from the wall
// line (how far a shard reaches over or into the trench).
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { GroundStore, toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { buildCell, CUT_CHANNEL, maskChannelAt, type BuiltCell, type GroundLayer } from '../../src/canalRecall/ownGround/groundCell.ts';
import { insideCut, locateCut, type Cut } from '../../src/canalRecall/ownGround/tunnels.ts';

/** Vertices nearer the wall line than ON_LINE_M are on it (a clipped piece's edge vertex belongs to both sides). */
const WALL_BAND_M = 3, SPAN_M = 0.3, ON_LINE_M = 0.1;
const pos = process.argv.slice(2).filter(a => !a.startsWith('--'));
const flag = (k: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.split('=')[1];
const [lng, lat, radius] = [Number(pos[0] ?? 4.91165), Number(pos[1] ?? 52.37250), Number(pos[2] ?? 120)];
const ROOT = 'public/data/extracts/amsterdam';
const bytes = async (p: string) => { const b = readFileSync(join(ROOT, p)); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); };
const portalClip = flag('portalClip') !== '0';
const store = new GroundStore(bytes, { roads: flag('roads') !== '0', ...(portalClip ? {} : { portalClip: false }) } as never);
await store.init();
const [x, y] = toLocal(lng, lat), key = store.cellAt(x, y);
const keys = new Set<string>([key]);
for (const dx of [-radius, radius]) for (const dy of [-radius, radius]) keys.add(store.cellAt(x + dx, y + dy));
const cells: BuiltCell[] = [];
// Every cut placed first (a cell's input carries the cuts placed so far; the probe reads the surface's full set).
for (const k of keys) if (store.covers(k)) for (const n of GroundStore.neighbours(k)) if (store.covers(n)) await store.prepareCell(n);
for (const k of keys) if (store.covers(k)) cells.push(buildCell(await store.cellInput(k, 0)));
const s = store.surface;
const cuts = s.cuts.filter((c: Cut) => c.x.some((cx, i) => Math.hypot(cx - x, c.y[i] - y) < radius));

/** Signed distance from the nearest walled edge (+ outside the strip), or NaN when no walled edge is within the band. */
const wallSide = (px: number, py: number): { d: number; inside: boolean; floor: number } | null => {
  let best: { d: number; inside: boolean; floor: number } | null = null;
  for (const c of cuts) {
    const h = locateCut(c, px, py);
    if (!h || h.s < 0 || h.s > c.s[c.s.length - 1]) continue;
    for (const [edge, wall, sg] of [[h.left, h.wallL, 1], [h.right, h.wallR, -1]] as const) {
      if (wall < 0.5) continue;
      const d = sg * h.lateral - edge; // + outside
      if (Math.abs(d) <= WALL_BAND_M && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, inside: insideCut(c, h), floor: h.floor };
    }
  }
  return best;
};

const SKIP = new Set<GroundLayer>(['kerb', 'paint', 'deckBody', 'bollard', 'furniture', 'hedge', 'track', 'ballast', 'water']);
const rows: Record<string, { tris: number; straddle: number; straddleM2: number; reachMax: number; off: number; devs: number[] }> = {};
for (const c of cells) for (const [layer, m] of Object.entries(c.layers) as [GroundLayer, NonNullable<BuiltCell['layers'][GroundLayer]>][]) {
  if (SKIP.has(layer) || !m) continue;
  const p = m.positions, idx = m.indices;
  const row = rows[layer] ?? (rows[layer] = { tris: 0, straddle: 0, straddleM2: 0, reachMax: 0, off: 0, devs: [] });
  for (let t = 0; t < idx.length; t += 3) {
    const v = [idx[t] * 3, idx[t + 1] * 3, idx[t + 2] * 3];
    const cx = (p[v[0]] + p[v[1]] + p[v[2]]) / 3, cy = (p[v[0] + 1] + p[v[1] + 1] + p[v[2] + 1]) / 3;
    if (Math.hypot(cx - x, cy - y) > radius) continue;
    const sides = v.map(a => wallSide(p[a], p[a + 1]));
    if (!sides.some(Boolean)) continue;
    row.tris++;
    const zs = v.map(a => p[a + 2]);
    const span = Math.max(...zs) - Math.min(...zs);
    const ins = sides.filter(q => q && q.d < -ON_LINE_M).length, outs = sides.filter(q => q && q.d > ON_LINE_M).length;
    if (ins && outs && span > SPAN_M) {
      row.straddle++;
      const [a, b, k] = v, ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], wx = p[k] - p[a], wy = p[k + 1] - p[a + 1];
      row.straddleM2 += Math.abs(ux * wy - uy * wx) / 2;
      row.reachMax = Math.max(row.reachMax, ...sides.map(q => q ? Math.abs(q.d) : 0));
    }
    v.forEach((a, j) => {
      const q = sides[j];
      if (!q || Math.abs(q.d) <= ON_LINE_M) return;
      const want = q.inside ? q.floor : s.ground(p[a], p[a + 1]);
      const dev = Math.abs(p[a + 2] - want);
      row.devs.push(dev);
      if (dev > SPAN_M) { row.off++; if (process.env.PORTAL_VERBOSE && row.off <= 4) console.log(`  ${layer} off ${dev.toFixed(2)} at ${p[a].toFixed(1)},${p[a + 1].toFixed(1)} d ${q.d.toFixed(2)} z ${p[a + 2].toFixed(2)} want ${want.toFixed(2)} (${q.inside ? 'floor' : 'ground'}) cutFloor ${s.cutFloor(p[a], p[a + 1]).toFixed(2)} span ${(Math.max(...zs) - Math.min(...zs)).toFixed(2)}`); }
    });
  }
}
// Holes: points within the band (0.25 m grid) that no drawn triangle of any layer covers (after the mask's discard):
// the sky or the void shows through. Every layer counts, walls and floors included.
const HOLE_STEP = 0.25;
type T = { x: number[]; y: number[]; layer: GroundLayer; cell: BuiltCell };
const near: T[] = [];
for (const c of cells) for (const [layer, m] of Object.entries(c.layers) as [GroundLayer, NonNullable<BuiltCell['layers'][GroundLayer]>][]) {
  if (!m || layer === 'water') continue;
  const p = m.positions, idx = m.indices;
  for (let t = 0; t < idx.length; t += 3) {
    const v = [idx[t] * 3, idx[t + 1] * 3, idx[t + 2] * 3], xs = v.map(a => p[a]), ys = v.map(a => p[a + 1]);
    if (Math.hypot(xs[0] - x, ys[0] - y) > radius + 20) continue;
    near.push({ x: xs, y: ys, layer, cell: c });
  }
}
const grid = new Map<string, T[]>();
for (const t of near) for (let i = Math.floor(Math.min(...t.x) / 4); i <= Math.floor(Math.max(...t.x) / 4); i++) for (let j = Math.floor(Math.min(...t.y) / 4); j <= Math.floor(Math.max(...t.y) / 4); j++) { const k = `${i}:${j}`; (grid.get(k) ?? grid.set(k, []).get(k)!).push(t); }
const covers = (t: T, px: number, py: number) => {
  const d = (t.y[1] - t.y[2]) * (t.x[0] - t.x[2]) + (t.x[2] - t.x[1]) * (t.y[0] - t.y[2]);
  if (Math.abs(d) < 1e-9) return false;
  const u = ((t.y[1] - t.y[2]) * (px - t.x[2]) + (t.x[2] - t.x[1]) * (py - t.y[2])) / d, w = ((t.y[2] - t.y[0]) * (px - t.x[2]) + (t.x[0] - t.x[2]) * (py - t.y[2])) / d;
  if (u < -1e-6 || w < -1e-6 || u + w > 1 + 1e-6) return false;
  const ch = CUT_CHANNEL[t.layer];
  return !(ch !== undefined && t.cell.mask && maskChannelAt(t.cell.mask, px, py, ch) < 0.5);
};
let probes = 0, holes = 0;
const holeAt: string[] = [];
for (let px = x - radius; px <= x + radius; px += HOLE_STEP) for (let py = y - radius; py <= y + radius; py += HOLE_STEP) {
  if (Math.hypot(px - x, py - y) > radius) continue;
  const q = wallSide(px, py);
  if (!q) continue;
  probes++;
  if (!(grid.get(`${Math.floor(px / 4)}:${Math.floor(py / 4)}`) ?? []).some(t => covers(t, px, py))) { holes++; if (holeAt.length < 6) holeAt.push(`${px.toFixed(2)},${py.toFixed(2)} d ${q.d.toFixed(2)}`); }
}
console.log(JSON.stringify({ holeProbes: probes, holes, holeM2: +(holes * HOLE_STEP * HOLE_STEP).toFixed(2), holeAt }));
const table = Object.entries(rows).filter(([, r]) => r.tris).map(([layer, r]) => {
  const d = [...r.devs].sort((a, b) => a - b);
  return { layer, tris: r.tris, straddle: r.straddle, straddleM2: +r.straddleM2.toFixed(1), reachMaxM: +r.reachMax.toFixed(2), offVerts: r.off, devMean: +(d.reduce((s_, v) => s_ + v, 0) / Math.max(1, d.length)).toFixed(3), devP95: +(d[Math.floor(d.length * 0.95)] ?? 0).toFixed(3) };
});
console.table(table);
const tot = table.reduce((t, r) => ({ straddle: t.straddle + r.straddle, straddleM2: t.straddleM2 + r.straddleM2, offVerts: t.offVerts + r.offVerts }), { straddle: 0, straddleM2: 0, offVerts: 0 });
console.log(JSON.stringify({ at: [lng, lat], radius, portalClip, cuts: cuts.map(c => c.id), cells: cells.map(c => c.key), total: { ...tot, straddleM2: +tot.straddleM2.toFixed(1) } }));

// ------------------------------------------------------------------ open ramp sides (issue #269)
// --sides: every open (unwalled) side station of every cut within the radius, with the land 1 m and 3 m beyond its
// edge (raw relief minus the floor) and whether another cut's strip covers those points (its floor within 0.5 m).
// A side is "covered" when a neighbour's strip holds the point 1 m out, "land" when not and the relief there or 3 m
// out stands > 1 m over the floor (a missing wall), else "flat" (a ramp's taper, open land at the floor's level).
// Runs of land stations are written to --sidesOut=<json> (their edge polylines); --sidesFrom=<json> measures the
// sheets (ground triangles spanning > SPAN_M with their centroid within WALL_BAND_M of those edges) against a saved set,
// so before (?rampSides=0) and after compare the same places.
if (process.argv.includes('--sides') || flag('sidesFrom')) {
  const { writeFileSync } = await import('node:fs');
  type Run = { cut: string; side: 'L' | 'R'; from: number; to: number; lenM: number; kind: string; reachMinusHalf: number; rise1: number; rise3: number; cover1: number; cover3: number; edge: [number, number][] };
  const runs: Run[] = [];
  const nrm = (c: Cut, i: number): [number, number] => { const a = Math.max(0, i - 1), b = Math.min(c.x.length - 1, i + 1), dx = c.x[b] - c.x[a], dy = c.y[b] - c.y[a], l = Math.hypot(dx, dy) || 1; return [-dy / l, dx / l]; };
  const coveredBy = (c: Cut, px: number, py: number, floor: number) => s.cuts.some((o: Cut) => o !== c && px >= o.bbox[0] - 30 && px <= o.bbox[2] + 30 && py >= o.bbox[1] - 30 && py <= o.bbox[3] + 30 && (() => { const h = locateCut(o, px, py); return !!h && insideCut(o, h) && Math.abs(h.floor - floor) < 0.5; })());
  for (const c of cuts) for (const sd of ['L', 'R'] as const) {
    const sg = sd === 'L' ? 1 : -1, wall = sd === 'L' ? c.wallL : c.wallR, reach = sd === 'L' ? c.left : c.right, gap = sd === 'L' ? c.gapL : c.gapR;
    const half = Math.min(...c.left.concat(c.right));
    let cur: Run | null = null;
    const n = c.x.length, len = c.s[n - 1];
    for (let i = 0; i < n; i++) {
      if (Math.hypot(c.x[i] - x, c.y[i] - y) > radius || wall[i] >= 0.5) { cur = null; continue; }
      const [nx, ny] = nrm(c, i), e = reach[i] + (gap?.[i] ?? 0);
      const at = (d: number): [number, number] => [c.x[i] + nx * sg * (e + d), c.y[i] + ny * sg * (e + d)];
      const p1 = at(1), p3 = at(3), r1 = s.relief(...p1) - c.floor[i], r3 = s.relief(...p3) - c.floor[i];
      const c1 = coveredBy(c, ...p1, c.floor[i]), c3 = coveredBy(c, ...p3, c.floor[i]);
      const end = c.s[i] < 3 || c.s[i] > len - 3;
      const kind = end ? 'end' : c1 ? 'covered' : (r1 > 1 || r3 > 1) ? 'land' : 'flat';
      if (!cur || cur.kind !== kind || cur.to !== i - 1) { cur = { cut: c.id, side: sd, from: i, to: i, lenM: 0, kind, reachMinusHalf: 0, rise1: 0, rise3: 0, cover1: 0, cover3: 0, edge: [] }; runs.push(cur); }
      const k = cur.to - cur.from + (cur.edge.length ? 1 : 0);
      const avg = (a: number, v: number) => (a * k + v) / (k + 1);
      cur.reachMinusHalf = avg(cur.reachMinusHalf, reach[i] - half); cur.rise1 = avg(cur.rise1, r1); cur.rise3 = avg(cur.rise3, r3); cur.cover1 = avg(cur.cover1, c1 ? 1 : 0); cur.cover3 = avg(cur.cover3, c3 ? 1 : 0);
      cur.to = i; cur.lenM = c.s[cur.to] - c.s[cur.from]; cur.edge.push(at(0));
    }
  }
  const from = flag('sidesFrom');
  const target: Run[] = from ? JSON.parse(readFileSync(from, 'utf8')) : runs.filter(r => r.kind === 'land');
  console.table(runs.map(r => ({ cut: r.cut, side: r.side, st: `${r.from}-${r.to}`, lenM: +r.lenM.toFixed(1), kind: r.kind, reachOverHalf: +r.reachMinusHalf.toFixed(1), rise1: +r.rise1.toFixed(2), rise3: +r.rise3.toFixed(2), cover1: +r.cover1.toFixed(2), cover3: +r.cover3.toFixed(2) })));
  if (flag('sidesOut')) writeFileSync(flag('sidesOut')!, JSON.stringify(target));
  // Sheets across the target edges: non-wall ground triangles spanning > SPAN_M whose centroid lies within WALL_BAND_M of a target edge.
  const segDist = (pl: [number, number][], px: number, py: number) => { let b = Infinity; for (let k = 0; k < pl.length; k++) { const a = pl[k], q = pl[Math.min(pl.length - 1, k + 1)], dx = q[0] - a[0], dy = q[1] - a[1], l2 = dx * dx + dy * dy || 1e-9, t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / l2)); b = Math.min(b, Math.hypot(a[0] + dx * t - px, a[1] + dy * t - py)); } return b; };
  const per = target.map(r => ({ cut: r.cut, side: r.side, st: `${r.from}-${r.to}`, lenM: +r.lenM.toFixed(1), sheets: 0, sheetM2: 0, byLayer: {} as Record<string, number> }));
  const SHEET_SKIP = new Set<GroundLayer>([...SKIP, 'tunnelWall' as GroundLayer]);
  for (const c of cells) for (const [layer, m] of Object.entries(c.layers) as [GroundLayer, NonNullable<BuiltCell['layers'][GroundLayer]>][]) {
    if (!m || SHEET_SKIP.has(layer) || /wall|floor|cut/i.test(layer)) continue;
    const p = m.positions, idx = m.indices;
    for (let t = 0; t < idx.length; t += 3) {
      const v = [idx[t] * 3, idx[t + 1] * 3, idx[t + 2] * 3], zs = v.map(a => p[a + 2]);
      if (Math.max(...zs) - Math.min(...zs) <= SPAN_M) continue;
      const area = Math.abs((p[v[1]] - p[v[0]]) * (p[v[2] + 1] - p[v[0] + 1]) - (p[v[1] + 1] - p[v[0] + 1]) * (p[v[2]] - p[v[0]])) / 2;
      if (area < 1e-3) continue;
      const cx = (p[v[0]] + p[v[1]] + p[v[2]]) / 3, cy = (p[v[0] + 1] + p[v[1] + 1] + p[v[2] + 1]) / 3;
      let bi = -1, bd = WALL_BAND_M;
      target.forEach((r, k) => { const d = segDist(r.edge, cx, cy); if (d <= bd) { bd = d; bi = k; } });
      if (bi < 0) continue;
      per[bi].sheets++; per[bi].sheetM2 += area; per[bi].byLayer[layer] = (per[bi].byLayer[layer] ?? 0) + 1;
    }
  }
  console.table(per.map(r => ({ ...r, sheetM2: +r.sheetM2.toFixed(1), byLayer: JSON.stringify(r.byLayer) })));
  const tot = per.reduce((a, r) => ({ sheets: a.sheets + r.sheets, sheetM2: a.sheetM2 + r.sheetM2 }), { sheets: 0, sheetM2: 0 });
  // Holes within the band of the target edges (0.25 m grid): the sky through the ground.
  let sp = 0, sh = 0;
  const shAt: string[] = [];
  for (const r of target) for (let k = 0; k + 1 < r.edge.length; k++) {
    const [ax, ay] = r.edge[k], [bx, by] = r.edge[k + 1], L = Math.hypot(bx - ax, by - ay) || 1, ux = (bx - ax) / L, uy = (by - ay) / L;
    for (let a = 0; a < L; a += HOLE_STEP) for (let d = -WALL_BAND_M; d <= WALL_BAND_M; d += HOLE_STEP) {
      const px = ax + ux * a - uy * d, py = ay + uy * a + ux * d;
      sp++;
      if (!(grid.get(`${Math.floor(px / 4)}:${Math.floor(py / 4)}`) ?? []).some(t => covers(t, px, py))) { sh++; if (shAt.length < 6) shAt.push(`${px.toFixed(2)},${py.toFixed(2)}`); }
    }
  }
  console.log(JSON.stringify({ sides: { runs: target.length, ...tot, sheetM2: +tot.sheetM2.toFixed(1), holeProbes: sp, holes: sh, holeAt: shAt } }));
}

// --sheets: every steep ground triangle (span > 1 m, plan area > 0.05 m²) within the radius, binned to 4 m cells and
// attributed to the nearest cut edge: cut, side, station s, offset from that edge (+ outside), the edge walled or
// open, and whether it is within 3 m of the strip's ends. Where the pale sheets are, whichever edge holds them.
if (process.argv.includes('--sheets')) {
  const [o0, o1] = [toLocal(0, 0), toLocal(1, 1)], kx = o1[0] - o0[0], ky = o1[1] - o0[1];
  const ll = (px: number, py: number) => `${((px - o0[0]) / kx).toFixed(5)},${((py - o0[1]) / ky).toFixed(5)}`;
  const bins = new Map<string, { n: number; m2: number; layers: Record<string, number>; where: string; at: string; zr: [number, number] }>();
  for (const c of cells) for (const [layer, m] of Object.entries(c.layers) as [GroundLayer, NonNullable<BuiltCell['layers'][GroundLayer]>][]) {
    if (!m || SKIP.has(layer)) continue;
    const p = m.positions, idx = m.indices;
    for (let t = 0; t < idx.length; t += 3) {
      const v = [idx[t] * 3, idx[t + 1] * 3, idx[t + 2] * 3], zs = v.map(a => p[a + 2]);
      if (Math.max(...zs) - Math.min(...zs) <= 1) continue;
      const area = Math.abs((p[v[1]] - p[v[0]]) * (p[v[2] + 1] - p[v[0] + 1]) - (p[v[1] + 1] - p[v[0] + 1]) * (p[v[2]] - p[v[0]])) / 2;
      if (area < 0.05) continue;
      const cx = (p[v[0]] + p[v[1]] + p[v[2]]) / 3, cy = (p[v[0] + 1] + p[v[1] + 1] + p[v[2] + 1]) / 3;
      if (Math.hypot(cx - x, cy - y) > radius) continue;
      // Masked away inside a strip (land and greens are discarded by the cut channel there): not drawn.
      const ch = CUT_CHANNEL[layer];
      if (ch !== undefined && c.mask && maskChannelAt(c.mask, cx, cy, ch) < 0.5) continue;
      let where = 'none', bd = Infinity;
      for (const cut of cuts) {
        const h = locateCut(cut, cx, cy);
        if (!h) continue;
        const len = cut.s[cut.s.length - 1];
        for (const [edge, wall, sg, nm] of [[h.left, h.wallL, 1, 'L'], [h.right, h.wallR, -1, 'R']] as const) {
          const d = sg * h.lateral - edge, past = h.s < 0 ? -h.s : h.s > len ? h.s - len : 0;
          const dist = Math.max(Math.abs(d), past);
          if (dist < bd) { bd = dist; where = `${cut.id} ${nm} s${Math.round(h.s)}${h.s < 3 || h.s > len - 3 ? '(end)' : ''} ${wall >= 0.5 ? 'wall' : 'open'} d${d.toFixed(1)}`; }
        }
      }
      const key = `${Math.floor(cx / 4)}:${Math.floor(cy / 4)}`;
      const b = bins.get(key) ?? bins.set(key, { n: 0, m2: 0, layers: {}, where, at: ll(cx, cy), zr: [Infinity, -Infinity] }).get(key)!;
      b.n++; b.m2 += area; b.layers[layer] = (b.layers[layer] ?? 0) + 1; b.zr[0] = Math.min(b.zr[0], ...zs); b.zr[1] = Math.max(b.zr[1], ...zs);
    }
  }
  const list = [...bins.values()].sort((a, b) => b.m2 - a.m2);
  console.table(list.slice(0, 60).map(b => ({ at: b.at, n: b.n, m2: +b.m2.toFixed(1), z: `${b.zr[0].toFixed(1)}..${b.zr[1].toFixed(1)}`, layers: JSON.stringify(b.layers), nearest: b.where })));
  console.log(JSON.stringify({ sheetBins: list.length, sheets: list.reduce((a, b) => a + b.n, 0), sheetM2: +list.reduce((a, b) => a + b.m2, 0).toFixed(1) }));
}

// --ends: each cut's two ends within the radius: the floor and wall tops there, the portal (if any), the relief and the
// drawn ground 1, 3 and 6 m past the end line, and the steep sheets (non-land layers, span > SPAN_M) whose vertices
// straddle the end line (inside the strip's stations and past the end), within the strip's width + WALL_BAND_M.
if (process.argv.includes('--ends')) {
  const rowsE: Record<string, unknown>[] = [];
  for (const c of cuts) {
    const n = c.x.length, len = c.s[n - 1];
    for (const at of [0, n - 1]) {
      if (Math.hypot(c.x[at] - x, c.y[at] - y) > radius) continue;
      const k = at === 0 ? 1 : at - 1, dx = c.x[at] - c.x[k], dy = c.y[at] - c.y[k], l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l;
      const past = (m: number) => [c.x[at] + ux * m, c.y[at] + uy * m] as const;
      const portal = c.portals.find(p => p.at === at);
      let sheets = 0, m2 = 0;
      const lay: Record<string, number> = {};
      for (const cell of cells) for (const [layer, m] of Object.entries(cell.layers) as [GroundLayer, NonNullable<BuiltCell['layers'][GroundLayer]>][]) {
        if (!m || SKIP.has(layer) || layer === 'land') continue;
        const p = m.positions, idx = m.indices;
        for (let t = 0; t < idx.length; t += 3) {
          const v = [idx[t] * 3, idx[t + 1] * 3, idx[t + 2] * 3], zs = v.map(a => p[a + 2]);
          if (Math.max(...zs) - Math.min(...zs) <= SPAN_M) continue;
          // Along-axis offset past the end (+ beyond) and lateral offset, per vertex.
          const along = v.map(a => (p[a] - c.x[at]) * ux + (p[a + 1] - c.y[at]) * uy), lat = v.map(a => Math.abs(-(p[a] - c.x[at]) * uy + (p[a + 1] - c.y[at]) * ux));
          const w = Math.max(c.left[at], c.right[at]) + WALL_BAND_M;
          if (lat.some(q => q > w) || along.some(q => Math.abs(q) > 8)) continue;
          if (!(along.some(q => q < -ON_LINE_M) && along.some(q => q > ON_LINE_M))) continue;
          const area = Math.abs((p[v[1]] - p[v[0]]) * (p[v[2] + 1] - p[v[0] + 1]) - (p[v[1] + 1] - p[v[0] + 1]) * (p[v[2]] - p[v[0]])) / 2;
          sheets++; m2 += area; lay[layer] = (lay[layer] ?? 0) + 1;
        }
      }
      rowsE.push({ cut: c.id, end: at === 0 ? 's0' : `s${Math.round(len)}`, floor: +c.floor[at].toFixed(2), rimL: +(c.rimL[at] - c.floor[at]).toFixed(2), rimR: +(c.rimR[at] - c.floor[at]).toFixed(2), wallLR: `${c.wallL[at]}${c.wallR[at]}`, portal: portal ? `${portal.open ? 'open' : 'mouth'} top+${(portal.top - c.floor[at]).toFixed(1)}` : '-', relief1: +(s.relief(...past(1)) - c.floor[at]).toFixed(2), relief3: +(s.relief(...past(3)) - c.floor[at]).toFixed(2), relief6: +(s.relief(...past(6)) - c.floor[at]).toFixed(2), ground3: +(s.ground(...past(3)) - c.floor[at]).toFixed(2), sheets, sheetM2: +m2.toFixed(1), layers: JSON.stringify(lay) });
    }
  }
  console.table(rowsE);
}

// --owners: every non-land ground triangle within the radius spanning > SPAN_M with vertices both inside a strip and
// outside every strip (a sheet across a strip boundary), attributed to the nearest boundary of the strip holding its
// inside vertex: a walled side (mid-strip, R5-C2's clip), a walled side within 3 m of an end (the clip's end margin),
// an open side (shared/merged/none), or an end line (a portal mouth, or a plain end). Per cut and boundary.
if (process.argv.includes('--owners')) {
  const OWN_SPAN = Number(flag('ownSpan') ?? SPAN_M);
  const own: Record<string, { n: number; m2: number; layers: Record<string, number> }> = {};
  const classes: Record<string, { n: number; m2: number }> = {};
  const inside = (px: number, py: number) => { for (const c of cuts) { const h = locateCut(c, px, py); if (h && insideCut(c, h)) return { c, h }; } return null; };
  for (const cell of cells) for (const [layer, m] of Object.entries(cell.layers) as [GroundLayer, NonNullable<BuiltCell['layers'][GroundLayer]>][]) {
    if (!m || SKIP.has(layer) || layer === 'land') continue;
    const p = m.positions, idx = m.indices;
    for (let t = 0; t < idx.length; t += 3) {
      const v = [idx[t] * 3, idx[t + 1] * 3, idx[t + 2] * 3], zs = v.map(a => p[a + 2]);
      if (Math.max(...zs) - Math.min(...zs) <= OWN_SPAN) continue;
      const cx = (p[v[0]] + p[v[1]] + p[v[2]]) / 3, cy = (p[v[0] + 1] + p[v[1] + 1] + p[v[2] + 1]) / 3;
      if (Math.hypot(cx - x, cy - y) > radius) continue;
      const area = Math.abs((p[v[1]] - p[v[0]]) * (p[v[2] + 1] - p[v[0] + 1]) - (p[v[1] + 1] - p[v[0] + 1]) * (p[v[2]] - p[v[0]])) / 2;
      if (area < 1e-3) continue;
      const ins = v.map(a => inside(p[a], p[a + 1]));
      if (!ins.some(Boolean) || ins.every(Boolean)) continue;
      const { c, h } = ins.find(Boolean)!;
      const len = c.s[c.s.length - 1];
      const cands: [number, string][] = [[h.left - h.lateral, 'L'], [h.lateral + h.right, 'R'], [h.s, 'start'], [len - h.s, 'end']];
      cands.sort((a, b) => a[0] - b[0]);
      const b = cands[0][1];
      let cls: string;
      if (b === 'start' || b === 'end') { const pt = c.portals.find(q => q.at === (b === 'start' ? 0 : c.x.length - 1)); cls = pt ? `end:${pt.open ? 'open' : 'mouth'}` : 'end:plain'; }
      else { const w = b === 'L' ? h.wallL : h.wallR; const nearEnd = h.s < 3 || h.s > len - 3; cls = w >= 0.5 ? (nearEnd ? 'side:walled<3mEnd' : 'side:walled') : `side:open${(b === 'L' ? c.gapL : c.gapR)?.[h.i] ? '(merged)' : ''}`; }
      const key = `${c.id} ${b === 'start' ? 's0' : b === 'end' ? `s${Math.round(len)}` : b} ${cls}`;
      const o = own[key] ?? (own[key] = { n: 0, m2: 0, layers: {} });
      o.n++; o.m2 += area; o.layers[layer] = (o.layers[layer] ?? 0) + 1;
      const k2 = classes[cls] ?? (classes[cls] = { n: 0, m2: 0 }); k2.n++; k2.m2 += area;
    }
  }
  console.table(Object.entries(own).sort((a, b) => b[1].m2 - a[1].m2).map(([k, o]) => ({ boundary: k, sheets: o.n, m2: +o.m2.toFixed(1), layers: JSON.stringify(o.layers) })));
  console.table(Object.entries(classes).map(([k, o]) => ({ class: k, sheets: o.n, m2: +o.m2.toFixed(1) })));
}
