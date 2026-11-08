// A ramp's wall gaps, station by station (issue #270: the 16 m gap in the IJ-tunnel west ramp ramp:7371028).
//
//   npx tsx scripts/own-ground/probe-ramp-gap.ts [wayId=7371028] [fromS=20] [toS=60] [--rampGaps=0] [--at=lng,lat (a point in the way's cell)] [--bins] [--dump] [--line]
//
// Re-scans the way as the planner does (scanWay with the neighbourhood's candidate roads and the raw relief) and prints
// each station between fromS and toS (metres along the way): the floor, each side's scan before and after the gap fill
// (W wall / S shared / - none, its reach and rim over the floor), and the land 6 m out either side. Then the cuts the
// surface holds for the way, and the steep ground triangles (> 45°, every layer but kerbs/paint/water/bollards) whose
// centroid projects onto the way between fromS and toS within 20 m: count and area.
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { GroundStore, fromLocal, toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { steepInBand, wallsAlong } from './rampBand.ts';
import { buildCell, type BuiltCell, type GroundLayer } from '../../src/canalRecall/ownGround/groundCell.ts';
import { scanWay, motorOnlyTags, locateCut, type CutWay, type SideScan } from '../../src/canalRecall/ownGround/tunnels.ts';

const pos = process.argv.slice(2).filter(a => !a.startsWith('--'));
const flag = (k: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.split('=')[1];
const [wayId, fromS, toS] = [Number(pos[0] ?? 7371028), Number(pos[1] ?? 20), Number(pos[2] ?? 60)];
const rampGaps = flag('rampGaps') !== '0';
const ROOT = 'public/data/extracts/amsterdam';
const bytes = async (p: string) => { const b = readFileSync(join(ROOT, p)); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); };
const store = new GroundStore(bytes, { roads: true, ...(rampGaps ? {} : { rampGaps: false }) } as never);
await store.init();
const at = (flag('at') ?? '4.9116,52.3720').split(',').map(Number), [x0, y0] = toLocal(at[0], at[1]), key = store.cellAt(x0, y0);
for (const n of GroundStore.neighbours(key)) if (store.covers(n)) await store.prepareCell(n);
const ways: CutWay[] = [];
const seen = new Set<number>();
for (const n of GroundStore.neighbours(key)) for (const w of await (store as never as { cutWaysOf(k: string): Promise<CutWay[]> }).cutWaysOf(n)) if (!seen.has(w.id)) { seen.add(w.id); ways.push(w); }
const way = ways.find(w => w.id === wayId);
if (!way) throw new Error(`way ${wayId} is not a candidate road around ${key}`);
const s = store.surface;
const fmt = (sd: SideScan | null, f: number) => (sd ? `${sd.wall ? 'W' : 'S'} r${sd.reach.toFixed(1)} +${(sd.rim - f).toFixed(1)}` : '-');
const rows: Record<string, unknown>[] = [];
const lineSt: number[] = [], lineAt: Record<number, [number, number]> = {};
let raw: readonly [SideScan | null, SideScan | null][] = [];
scanWay(way, s.relief, ways, true, undefined, undefined, { rampGaps, trace: (stage, st, floor, sides) => {
  if (stage === 'scanned') { raw = sides; return; }
  for (let i = 0; i < st.p.length; i++) {
    if (st.s[i] < fromS || st.s[i] > toS) continue;
    if (i % 3 === 0 || st.s[i + 1] > toS) { lineSt.push(i); lineAt[i] = [st.p[i][0], st.p[i][1]]; }
    const f = floor[i], [cx, cy] = st.p[i], j = Math.min(st.p.length - 1, i + 1), k = Math.max(0, i - 1);
    const tx = st.p[j][0] - st.p[k][0], ty = st.p[j][1] - st.p[k][1], l = Math.hypot(tx, ty) || 1, nx = -ty / l, ny = tx / l;
    const out = (sg: number) => (s.relief(cx + nx * sg * (way.half + 6), cy + ny * sg * (way.half + 6)) - f).toFixed(1);
    rows.push({ i, s: Math.round(st.s[i]), floor: +f.toFixed(2), L: fmt(raw[i][0], f), Lfill: fmt(sides[i][0], f), R: fmt(raw[i][1], f), Rfill: fmt(sides[i][1], f), land6L: out(1), land6R: out(-1) });
  }
} });
if (process.argv.includes('--line')) console.log('line', JSON.stringify(lineSt.map(i => fromLocal(...lineAt[i]).map(v => +v.toFixed(6)))));
console.log(`way ${wayId} half ${way.half} motor ${motorOnlyTags(way.tags)} rampGaps ${rampGaps}`);
console.table(rows);
// The way's cuts as the surface holds them, their stations along the way.
const along = (px: number, py: number) => {
  let best = Infinity, at = 0, acc = 0, lat = 0;
  // lat: signed, + left of the way's direction.
  for (let i = 0; i + 1 < way.points.length; i++) {
    const [ax, ay] = way.points[i], dx = way.points[i + 1][0] - ax, dy = way.points[i + 1][1] - ay, L = Math.hypot(dx, dy) || 1e-9;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (L * L))), d = Math.hypot(ax + dx * t - px, ay + dy * t - py);
    if (d < best) { best = d; at = acc + t * L; lat = Math.sign(dx * (py - ay) - dy * (px - ax)) * d; }
    acc += L;
  }
  return { s: at, lat };
};
{ const [qx, qy] = toLocal(4.9116, 52.3720), h = along(qx, qy); console.log(`  issue point 4.9116,52.3720: s${h.s.toFixed(0)} lateral ${h.lat.toFixed(1)}`); }
for (const c of s.cuts.filter(c => c.way === wayId)) console.log(`  ${c.id}: s${along(c.x[0], c.y[0]).s.toFixed(0)}..s${along(c.x[c.x.length - 1], c.y[c.y.length - 1]).s.toFixed(0)} walls L ${c.wallL.join('')} R ${c.wallR.join('')}`);
// Steep ground triangles in the band.
const keys = new Set<string>();
for (const p of way.points) { const k = store.cellAt(p[0], p[1]); if (store.covers(k)) keys.add(k); }
const cells: BuiltCell[] = [];
for (const k of keys) cells.push(buildCell(await store.cellInput(k, 0)));
const SKIP = new Set<GroundLayer>(['kerb', 'paint', 'deckBody', 'bollard', 'furniture', 'hedge', 'track', 'ballast', 'water']);
let n = 0, m2 = 0;
const by: Record<string, number> = {};
const bins: Record<string, { n: number; m2: number; zlo: number; zhi: number; layers: Record<string, number> }> = {};
for (const c of cells) for (const [layer, m] of Object.entries(c.layers) as [GroundLayer, NonNullable<BuiltCell['layers'][GroundLayer]>][]) {
  if (SKIP.has(layer) || !m) continue;
  const p = m.positions, idx = m.indices;
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, q = idx[t + 2] * 3;
    const cx = (p[a] + p[b] + p[q]) / 3, cy = (p[a + 1] + p[b + 1] + p[q + 1]) / 3;
    const h = along(cx, cy);
    if (h.s < fromS || h.s > toS || Math.abs(h.lat) > 20) continue;
    const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2], vx = p[q] - p[a], vy = p[q + 1] - p[a + 1], vz = p[q + 2] - p[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, nl = Math.hypot(nx, ny, nz) || 1;
    if (Math.abs(nz) / nl >= Math.SQRT1_2) continue;
    n++; m2 += Math.abs(nz) / 2; by[layer] = (by[layer] ?? 0) + 1;
    if (process.argv.includes('--dump')) console.log(`  ${layer} ` + [a, b, q].map(v => { const hv = along(p[v], p[v + 1]); const c = s.cuts.find(c => c.way === wayId && (() => { const l = locateCut(c, p[v], p[v + 1]); return !!l && l.s >= 0 && l.s <= c.s[c.s.length - 1]; })()); const l = c && locateCut(c, p[v], p[v + 1]); return `[s${hv.s.toFixed(1)} lat${hv.lat.toFixed(2)} z${p[v + 2].toFixed(2)}${l ? ` wallR ${l.right.toFixed(2)}@${l.wallR.toFixed(1)} floor ${l.floor.toFixed(2)}` : ''}]`; }).join(' '));
    const bin = `s${Math.floor(h.s / 4) * 4} ${h.lat >= 0 ? 'L' : 'R'}${Math.floor(Math.abs(h.lat) / 4) * 4}`;
    const zs = [p[a + 2], p[b + 2], p[q + 2]];
    const r = bins[bin] ?? (bins[bin] = { n: 0, m2: 0, zlo: Infinity, zhi: -Infinity, layers: {} as Record<string, number> });
    r.n++; r.m2 += Math.abs(nz) / 2; r.zlo = Math.min(r.zlo, ...zs); r.zhi = Math.max(r.zhi, ...zs); r.layers[layer] = (r.layers[layer] ?? 0) + 1;
  }
}
if (process.argv.includes('--bins')) console.table(Object.entries(bins).sort().map(([k, r]) => ({ bin: k, n: r.n, m2: +r.m2.toFixed(1), z: `${r.zlo.toFixed(1)}..${r.zhi.toFixed(1)}`, layers: JSON.stringify(r.layers) })));
{
  const line = lineSt.map(i => lineAt[i]);
  const b = steepInBand(cells, s.cuts, line, -1, 12), w = wallsAlong(s.cuts, line, -1);
  console.log(JSON.stringify({ rightBand: { steep: b.n, m2: +b.m2.toFixed(1), bins: b.bins, layers: b.layers }, wallsRight: w }));
}
console.log(JSON.stringify({ way: wayId, band: [fromS, toS], rampGaps, steep45: n, planM2: +m2.toFixed(1), layers: by, cells: [...keys] }));
