// The drawn parapet lines of the bridges around a spot, over the top-down raster (render-topdown.ts): each parapet
// piece in yellow (its first station a white dot), each deck's centreline in cyan, its water run in blue, the BGT/OSM
// bridge ways in magenta. Prints every piece's stations and lateral offset from the deck axis. For reviewing where a
// parapet starts, ends and turns (lane bridge-decks-followups 2026-10-16).
//
//   node --import tsx scripts/own-ground/probe-parapet-lines.ts <lng> <lat> [halfM=40] [mPerPx=0.1] [out.png] [--roads] [--id=OSM323258135]
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import sharp from 'sharp';
import { GroundStore, toLocal, fromLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { buildCell, type BuiltCell } from '../../src/canalRecall/ownGround/groundCell.ts';
import { parapetTrace, kitTrace, type KitInput } from '../../src/canalRecall/ownGround/bridgeKit.ts';
import { isBridgeWay, prepareWays } from '../../src/canalRecall/ownGround/streets.ts';
import { rasterTopDown } from './render-topdown.ts';
import type { Vec2 } from '../../src/canalRecall/ownGround/surface.ts';

const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const only = process.argv.find(a => a.startsWith('--id='))?.slice(5);
const [lng, lat] = [Number(args[0]), Number(args[1])], half = Number(args[2] ?? 40), res = Number(args[3] ?? 0.1);
const outPath = args[4] ?? `artifacts/parapet-lines-${lng}-${lat}.png`;
const ROOT = 'public/data/extracts/amsterdam';
const store = new GroundStore(async path => { const b = readFileSync(join(ROOT, path)); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); }, process.argv.includes('--roads') ? { roads: true } : {});
await store.init();
const [x, y] = toLocal(lng, lat);
const lines: { id: string; side: number; piece: number; line: { s: number; p: Vec2 }[] }[] = [];
const inputs = new Map<string, KitInput>();
parapetTrace.fn = (id, side, line, at) => { if (at.level === 0) lines.push({ id, side, piece: at.piece, line: line.map(l => ({ s: l.s, p: l.p })) }); };
kitTrace.input = k => { if (k.lod === 0) inputs.set(k.id, k); };
const cells: BuiltCell[] = [];
// --first=key prepares that cell first (way decks are grouped per prepared cell: the order the game streams cells in).
const first = process.argv.find(a => a.startsWith('--first='))?.slice(8);
if (first) await store.prepareCell(first);
for (const k of GroundStore.neighbours(store.cellAt(x, y))) if (store.covers(k)) cells.push(buildCell(await store.cellInput(k, 0)));
parapetTrace.fn = null; kitTrace.input = null;
const x0 = x - half, y0 = y - half, w = Math.round(2 * half / res), h = w;
const rgb = rasterTopDown(cells, x0, y0, w, h, res);
const px = (p: Vec2): [number, number] => [(p[0] - x0) / res, (y0 + h * res - p[1]) / res];
const dot = (q: Vec2, c: [number, number, number], r = 1) => {
  const [u, v] = px(q);
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const a = Math.round(u) + dx, b = Math.round(v) + dy;
    if (a >= 0 && a < w && b >= 0 && b < h) rgb.set(c, (b * w + a) * 3);
  }
};
const seg = (a: Vec2, b: Vec2, c: [number, number, number], r = 1) => { const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / (res / 2))); for (let i = 0; i <= n; i++) dot([a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n], c, r); };
const inView = (p: Vec2) => Math.abs(p[0] - x) < half && Math.abs(p[1] - y) < half;
// Bridge ways.
const input = await store.cellInput(store.cellAt(x, y), 0);
for (const wy of [input.osm, ...input.osmAround].flatMap(e => (e ? prepareWays(e.ways, input.project) : []))) {
  if (!isBridgeWay(wy) || !wy.tags.highway || !wy.points.some(inView)) continue;
  for (let i = 0; i + 1 < wy.points.length; i++) seg(wy.points[i], wy.points[i + 1], [220, 40, 200], 0);
}
// Deck centrelines and water runs.
for (const d of store.surface.decks) {
  const p = d.profile;
  if (only && p.id !== only) continue;
  if (![...p.x.keys()].some(i => inView([p.x[i], p.y[i]]))) continue;
  for (let i = 0; i + 1 < p.x.length; i++) {
    const wet = p.water && p.s[i] >= p.water[0] && p.s[i] <= p.water[1];
    seg([p.x[i], p.y[i]], [p.x[i + 1], p.y[i + 1]], wet ? [40, 90, 255] : [0, 230, 230], 0);
  }
}
for (const l of lines) {
  if (only && l.id !== only) continue;
  if (!l.line.some(q => inView(q.p))) continue;
  for (let i = 0; i + 1 < l.line.length; i++) seg(l.line[i].p, l.line[i + 1].p, [255, 220, 0], 1);
  dot(l.line[0].p, [255, 255, 255], 2);
  const kit = inputs.get(l.id), a = l.line[0], b = l.line[l.line.length - 1];
  const lat0 = (q: { s: number; p: Vec2 }) => {
    if (!kit) return NaN;
    const r = kit.rows.reduce((m, r) => (Math.abs(r.s - q.s) < Math.abs(m.s - q.s) ? r : m));
    return (q.p[0] - r.c[0]) * r.n[0] + (q.p[1] - r.c[1]) * r.n[1];
  };
  console.log(`${l.id} side ${l.side > 0 ? 'L' : 'R'} piece ${l.piece}: s ${a.s.toFixed(1)}–${b.s.toFixed(1)} (${l.line.length} pts) ${fromLocal(...a.p).map(v => v.toFixed(6))} → ${fromLocal(...b.p).map(v => v.toFixed(6))}; offset ${l.line.map(lat0).map(v => v.toFixed(1)).join(' ')}`);
}
for (const d of store.surface.decks) if (d.profile.family === 'way-deck' && [...d.profile.x.keys()].some(i => inView([d.profile.x[i], d.profile.y[i]]))) console.log(`way deck ${d.profile.id} half ${d.profile.halfWidth[0].toFixed(1)} water ${d.profile.water?.map(v => v.toFixed(1))}`);
for (const [id, k] of inputs) {
  if (only && id !== only) continue;
  if (!k.rows.some(r => inView(r.c))) continue;
  if (process.argv.includes('--rows')) for (const r of k.rows) console.log(`  s ${r.s.toFixed(1)} c ${r.c.map(v => v.toFixed(1))} z ${r.z.toFixed(2)} zL ${r.zL.toFixed(2)} zR ${r.zR.toFixed(2)} gL ${r.gL.toFixed(2)} gR ${r.gR.toFixed(2)} water ${+r.water} wL ${+r.wL} wR ${+r.wR} oL ${r.oL === undefined ? '-' : +r.oL} oR ${r.oR === undefined ? '-' : +r.oR}`);
  console.log(`${id}: waterZ ${k.waterZ?.toFixed(2)} parapet ${k.parapet.map(v => v.toFixed(1))} sides ${JSON.stringify(k.parapetSides?.map(s => s.map(v => +v.toFixed(1))))} spans ${JSON.stringify(k.spans.map(s => s.map(v => +v.toFixed(1))))} rows ${k.rows[0].s.toFixed(1)}–${k.rows[k.rows.length - 1].s.toFixed(1)}`);
}
await sharp(Buffer.from(rgb), { raw: { width: w, height: h, channels: 3 } }).png().toFile(outPath);
console.log(JSON.stringify({ out: outPath, px: [w, h], res }));
