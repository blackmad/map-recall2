/**
 * F1 design measurement (docs/plans/facade-f1-design-20261112.md §2): what the published baked shells (SHEL, world-v1
 * format 6 level 2) spend today, per cell and per building, and what the parametric-facade layout would spend: one
 * quad per visible wall plane, no thin trim/cornice/frontage strips (the record draws them), roofs and lids kept.
 *   node --import tsx scripts/world/facade-record-cost.ts [--dir=public/data/extracts/amsterdam/world-v1] [--top=12]
 * Bytes: today's GPU layout is bakedCoarse.ts install (Int16 position 6, uv 8, layer 1, tint 4, accent 3, thin 2,
 * hidden 1, swapSlot 1 = 26 B a vertex; u16/u32 indices); the record layout is 18 B a vertex (Int16 xyz 6, Int16 wall
 * u/v/len 6, u16 rec 2, u8 wallKind 1, hidden 1, swapSlot 1, pad 1). A "wall plane" is one (x0,y0)-(x1,y1) footprint
 * edge with vertical quads on it; the ground/upper/parapet pieces of one wall share a plane and become one quad.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { decodeShellCell } from '../../src/canalRecall/world/cellFormat.js';
import { NO_BID } from '../../src/canalRecall/world/shellMesh.js';
import { EXTRACT } from './pipeline.js';

const args = process.argv.slice(2);
const value = (name: string) => args.find(a => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const dir = path.resolve(value('dir') ?? path.join(EXTRACT, 'world-v1'));
const top = Number(value('top') ?? 12);
const index = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));
const keys = fs.readdirSync(path.join(dir, 'shells')).filter(f => f.endsWith('.bin')).map(f => f.slice(0, -4));

export const TODAY_BYTES_PER_VERTEX = 26;
export const RECORD_BYTES_PER_VERTEX = 18;
export const RECORD_BYTES_PER_PAND = 64;

type CellStat = { key: string; V: number; T: number; walls: number; keepTris: number; keepVerts: number; thinTris: number; wallQuads: number; bounds: number[]; pands: number; gz: number };
const q = (v: number) => Math.round(v * 1000);
const cells: CellStat[] = [];
const perBuilding: { quads: number; walls: number }[] = [];
for (const key of keys) {
  const gzb = fs.readFileSync(path.join(dir, 'shells', `${key}.bin`));
  const m = decodeShellCell(zlib.gunzipSync(gzb), key).shel; if (!m) continue;
  const n = m.layers.length, I = m.indices, P = m.positions;
  const wallsByBid = new Map<number, Set<string>>(), quadsByBid = new Map<number, number>();
  let t = 0, keepTris = 0, thinTris = 0, wallQuads = 0, pands = 0; const keepV = new Set<number>();
  for (let k = 0; k < n; k++) if (m.bids[k] !== NO_BID && m.bids[k] + 1 > pands) pands = m.bids[k] + 1;
  while (t < I.length) {
    const k = I[t];
    const isQuad = t + 6 <= I.length && I[t] === k && I[t + 1] === k + 1 && I[t + 2] === k + 2 && I[t + 3] === k && I[t + 4] === k + 2 && I[t + 5] === k + 3
      && P[(k + 2) * 3] === P[(k + 1) * 3] && P[(k + 2) * 3 + 1] === P[(k + 1) * 3 + 1] && P[(k + 3) * 3] === P[k * 3] && P[(k + 3) * 3 + 1] === P[k * 3 + 1] && P[(k + 1) * 3 + 2] === P[k * 3 + 2] && P[(k + 2) * 3 + 2] === P[(k + 3) * 3 + 2];
    const thin = m.thin ? m.thin[k * 2] > 0 : false;
    if (isQuad) {
      const vertical = (P[k * 3] !== P[(k + 1) * 3] || P[k * 3 + 1] !== P[(k + 1) * 3 + 1]) && P[(k + 2) * 3 + 2] !== P[k * 3 + 2];
      if (thin) thinTris += 2;
      else if (vertical) {
        wallQuads++; const b = m.bids[k]; quadsByBid.set(b, (quadsByBid.get(b) ?? 0) + 1);
        const a = `${q(P[k * 3])},${q(P[k * 3 + 1])}`, c = `${q(P[(k + 1) * 3])},${q(P[(k + 1) * 3 + 1])}`, wk = a < c ? `${a}|${c}` : `${c}|${a}`;
        let s = wallsByBid.get(b); if (!s) wallsByBid.set(b, s = new Set()); s.add(wk);
      } else { keepTris += 2; for (let c = 0; c < 4; c++) keepV.add(k + c); }
      t += 6; continue;
    }
    if (thin) thinTris++; else { keepTris++; keepV.add(I[t]); keepV.add(I[t + 1]); keepV.add(I[t + 2]); }
    t += 3;
  }
  let walls = 0; for (const [b, s] of wallsByBid) { walls += s.size; perBuilding.push({ quads: quadsByBid.get(b) ?? 0, walls: s.size }); }
  cells.push({ key, V: n, T: I.length / 3, walls, keepTris, keepVerts: keepV.size, thinTris, wallQuads, bounds: index.cells[key]?.bounds ?? [], pands, gz: gzb.length });
}
const today = (s: CellStat) => s.V * TODAY_BYTES_PER_VERTEX + s.T * 3 * (s.V <= 65536 ? 2 : 4);
const afterV = (s: CellStat) => s.walls * 4 + s.keepVerts, afterT = (s: CellStat) => s.walls * 2 + s.keepTris;
const after = (s: CellStat) => { const v = afterV(s); return v * RECORD_BYTES_PER_VERTEX + afterT(s) * 3 * (v <= 65536 ? 2 : 4); };
const sum = (f: (s: CellStat) => number, set = cells) => set.reduce((a, s) => a + f(s), 0);
const MB = (b: number) => (b / 1048576).toFixed(1);
const med = (v: number[]) => { const s = [...v].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };
console.log(`cells ${cells.length}; buildings ${sum(s => s.pands)}; vertices ${sum(s => s.V)} -> ${sum(afterV)}; triangles ${sum(s => s.T)} -> ${sum(afterT)}`);
console.log(`wall quads ${sum(s => s.wallQuads)} -> wall planes ${sum(s => s.walls)}; thin strips dropped ${sum(s => s.thinTris)} tris; roofs/lids kept ${sum(s => s.keepTris)} tris / ${sum(s => s.keepVerts)} verts`);
console.log(`per building: wall quads median ${med(perBuilding.map(b => b.quads))} mean ${(perBuilding.reduce((a, b) => a + b.quads, 0) / perBuilding.length).toFixed(2)}; wall planes median ${med(perBuilding.map(b => b.walls))} mean ${(perBuilding.reduce((a, b) => a + b.walls, 0) / perBuilding.length).toFixed(2)}`);
console.log(`city GPU buffers: today ${MB(sum(today))} MB -> record layout ${MB(sum(after))} MB; records ${MB(sum(s => s.pands) * RECORD_BYTES_PER_PAND)} MB if every cell were resident`);
const dam = [4.893, 52.373], cx = (b: number[]) => [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
const dist = (s: CellStat) => { const c = cx(s.bounds); return Math.hypot((c[0] - dam[0]) * 68000, (c[1] - dam[1]) * 111320); };
const byDist = cells.filter(s => s.bounds.length === 4).sort((a, b) => dist(a) - dist(b));
let tris = 0; const picked: CellStat[] = [];
for (const s of byDist) { if (picked.length >= 96) break; if (tris + s.T > 3_500_000 && picked.length) break; tris += s.T; picked.push(s); }
console.log(`Dam resident set (bakedCoarseBudget desktop: 96 cells / 3.5 M triangles -> ${picked.length} cells, ${sum(s => s.T, picked)} tris, ${sum(s => s.V, picked)} verts, ${sum(s => s.pands, picked)} pands): today ${MB(sum(today, picked))} MB -> ${MB(sum(after, picked))} MB buffers + ${MB(sum(s => s.pands, picked) * RECORD_BYTES_PER_PAND)} MB records; triangles after ${sum(afterT, picked)}`);
console.log(`\n| cell | pands | vertices | triangles | wall quads | wall planes | thin tris | roof/lid tris | today MB | record MB | records KB | gz KB |`);
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const s of [...cells].sort((a, b) => b.pands - a.pands).slice(0, top)) console.log(`| ${s.key} | ${s.pands} | ${s.V} | ${s.T} | ${s.wallQuads} | ${s.walls} | ${s.thinTris} | ${s.keepTris} | ${(today(s) / 1048576).toFixed(2)} | ${(after(s) / 1048576).toFixed(2)} | ${(s.pands * RECORD_BYTES_PER_PAND / 1024).toFixed(0)} | ${(s.gz / 1024).toFixed(0)} |`);
