// The ground layers a view ray meets, nearest first (lane fb-ground2-20261120, 3b8ca68b): the Node side of
// ray-pick.mjs, which prints each pixel's ray in the ground's local metres. Walks the cells around the ray's ground point
// as buildCell makes them (the page's worker builds the same meshes), the mask's discard applied as the shader does.
//   node --import tsx scripts/own-ground/ray-hits.ts '<ox,oy,oz>' '<dx,dy,dz>' [--opt=name=false,...] [--n=6]
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { GroundStore } from '../../src/canalRecall/ownGround/groundStore.ts';
import { buildCell, CUT_CHANNEL, GROUND_LAYERS, maskChannelAt, type BuiltCell, type GroundLayer } from '../../src/canalRecall/ownGround/groundCell.ts';

const ROOT = 'public/data/extracts/amsterdam';
const flag = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const opts: Record<string, boolean> = { roads: true };
for (const kv of (flag('opt') ?? '').split(',').filter(Boolean)) { const [k, v] = kv.split('='); opts[k] = v !== 'false'; }
const store = new GroundStore(async path => { const b = readFileSync(join(ROOT, path)); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); }, opts);
await store.init();
const rays = process.argv.slice(2).filter(a => !a.startsWith('--'));
const cache = new Map<string, BuiltCell>();
const cellOf = async (k: string) => { let c = cache.get(k); if (!c) { c = buildCell(await store.cellInput(k, 0)); cache.set(k, c); } return c; };
export type RayHit = { layer: GroundLayer; t: number; p: [number, number, number]; cut: boolean; cell: string };
for (let r = 0; r + 1 < rays.length; r += 2) {
  const o = rays[r].split(',').map(Number), d = rays[r + 1].split(',').map(Number);
  // The ground point at z ≈ 1 m picks the cells (the 3×3 around it: a crack can show what lies under a neighbour).
  const t0 = (o[2] - 1) / -d[2], gx = o[0] + d[0] * t0, gy = o[1] + d[1] * t0;
  const keys = new Set<string>();
  for (const dx of [-30, 0, 30]) for (const dy of [-30, 0, 30]) keys.add(store.cellAt(gx + dx, gy + dy));
  const hits: RayHit[] = [];
  for (const k of keys) {
    if (!store.covers(k)) continue;
    const cell = await cellOf(k);
    for (const layer of GROUND_LAYERS) {
      const m = cell.layers[layer];
      if (!m) continue;
      const p = m.positions, idx = m.indices;
      for (let i = 0; i < idx.length; i += 3) {
        const a = idx[i] * 3, b = idx[i + 1] * 3, c = idx[i + 2] * 3;
        // Möller–Trumbore, both faces.
        const e1 = [p[b] - p[a], p[b + 1] - p[a + 1], p[b + 2] - p[a + 2]], e2 = [p[c] - p[a], p[c + 1] - p[a + 1], p[c + 2] - p[a + 2]];
        const h = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]];
        const det = e1[0] * h[0] + e1[1] * h[1] + e1[2] * h[2];
        if (Math.abs(det) < 1e-12) continue;
        const f = 1 / det, s = [o[0] - p[a], o[1] - p[a + 1], o[2] - p[a + 2]];
        const u = f * (s[0] * h[0] + s[1] * h[1] + s[2] * h[2]);
        if (u < 0 || u > 1) continue;
        const q = [s[1] * e1[2] - s[2] * e1[1], s[2] * e1[0] - s[0] * e1[2], s[0] * e1[1] - s[1] * e1[0]];
        const v = f * (d[0] * q[0] + d[1] * q[1] + d[2] * q[2]);
        if (v < 0 || u + v > 1) continue;
        const t = f * (e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]);
        if (t <= 0) continue;
        const x = o[0] + d[0] * t, y = o[1] + d[1] * t, z = o[2] + d[2] * t;
        const ch = CUT_CHANNEL[layer];
        const cut = ch !== undefined && !!cell.mask && maskChannelAt(cell.mask, x, y, ch) < 0.5;
        hits.push({ layer, t, p: [x, y, z], cut, cell: k });
      }
    }
  }
  hits.sort((p, q) => p.t - q.t);
  const n = Number(flag('n') ?? 6);
  console.log(`ray ${r / 2}: ground ~ ${gx.toFixed(2)},${gy.toFixed(2)}`);
  for (const h of hits.slice(0, n)) console.log(`  ${h.t.toFixed(3)} ${h.layer}${h.cut ? ' (cut)' : ''} at ${h.p.map(v => v.toFixed(2)).join(',')} cell ${h.cell}`);
}
