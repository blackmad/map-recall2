// Junction seam probe (lane rails-class 2026-11-10; feedback "whats with the lines on the road?", Radarweg junction).
// Per built cell, the road-layer triangles (asphalt, klinker, cycle, paving, gravel) whose centroid lies inside a
// triangle of ANOTHER road layer: `fight` within 5 mm of its plane and not decided by the layers' draw ranks (a
// flickering seam line on screen), `hidden` more than 5 mm under it (wasted, invisible). Binned by 20 m; the worst bins.
//
//   npx tsx scripts/own-ground/probe-road-seams.ts [--at=lng,lat,halfM] [--cells=a,b] [--json=out.json]
import { writeFileSync } from 'node:fs';
import { GroundStore, toLocal, fromLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { buildCell, DRAW_RANK, type BuiltCell, type GroundLayer } from '../../src/canalRecall/ownGround/groundCell.ts';
import { readExtract } from './probe-rails.ts';
import { triIndex, hitsAt } from './probe-rails-class.ts';

const SEAM = new Set<GroundLayer>(['asphalt', 'klinker', 'cycle', 'paving', 'gravel']);
export interface SeamBin { cell: string; at: [number, number]; lngLat?: [number, number]; fight: number; hidden: number; layers: Record<string, number> }

export function seamScan(cell: BuiltCell): SeamBin[] {
  const ix = triIndex(cell, SEAM), [x0, y0, x1, y1] = cell.rect, bins = new Map<string, SeamBin>();
  for (const layer of SEAM) {
    const m = cell.layers[layer];
    if (!m) continue;
    const p = m.positions, idx = m.indices;
    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
      const cx = (p[a] + p[b] + p[c]) / 3, cy = (p[a + 1] + p[b + 1] + p[c + 1]) / 3, cz = (p[a + 2] + p[b + 2] + p[c + 2]) / 3;
      if (cx < x0 || cx >= x1 || cy < y0 || cy >= y1) continue;
      for (const h of hitsAt(ix, cx, cy)) {
        if (h.layer === layer) continue;
        const dz = cz - h.z;
        let kind: 'fight' | 'hidden' | null = null;
        if (Math.abs(dz) <= 0.005 && (DRAW_RANK[layer] ?? 0) === (DRAW_RANK[h.layer] ?? 0)) kind = 'fight';
        else if (dz < -0.005 && layer !== 'cycle') kind = 'hidden';
        if (!kind) continue;
        const key = `${Math.round(cx / 20)}:${Math.round(cy / 20)}`;
        const e = bins.get(key) ?? { cell: cell.key, at: [cx, cy], fight: 0, hidden: 0, layers: {} };
        e[kind]++; const lk = `${layer}/${h.layer}`; e.layers[lk] = (e.layers[lk] ?? 0) + 1; bins.set(key, e);
      }
    }
  }
  return [...bins.values()];
}

async function main(): Promise<void> {
  const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
  const store = new GroundStore(readExtract, { roads: true });
  await store.init();
  let keys: string[] = [];
  const at = arg('at');
  if (at) { const [lng, lat, half] = at.split(',').map(Number), [x, y] = toLocal(lng, lat), s = new Set<string>(); for (let dx = -half; dx <= half; dx += 50) for (let dy = -half; dy <= half; dy += 50) s.add(store.cellAt(x + dx, y + dy)); keys = [...s].filter(k => store.covers(k)); }
  if (arg('cells')) keys = arg('cells')!.split(',');
  const all: SeamBin[] = [];
  for (const k of keys) { for (const b of seamScan(buildCell(await store.cellInput(k, 0)))) { b.lngLat = fromLocal(b.at[0], b.at[1]).map(v => +v.toFixed(5)) as [number, number]; all.push(b); } }
  all.sort((p, q) => q.fight + q.hidden - p.fight - p.hidden);
  const sum = { cells: keys.length, fight: all.reduce((s, b) => s + b.fight, 0), hidden: all.reduce((s, b) => s + b.hidden, 0), bins: all.length, worst: all.slice(0, 20) };
  if (arg('json')) writeFileSync(arg('json')!, JSON.stringify({ sum, all }, null, 1));
  console.log(JSON.stringify(sum, null, 1));
}
if (process.argv[1]?.endsWith('probe-road-seams.ts')) main().catch(e => { console.error(e); process.exit(1); });
