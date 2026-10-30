// Ground materials per road spot (lane road-look-continuity 2026-10-29, step 1: "one material per level").
//
//   npx tsx scripts/own-ground/probe-spot-materials.ts [--only=id,id] [--json=out.json]
//
// At every roadRegressions ROAD_SPOTS crop, the own ground built as the game builds it (roads-v1 on, LOD 0), and per
// surface layer the m² of triangles whose centroid lies in the crop (top-down area). A layer is a material in the
// game (gameGround.ts makeMaterials), so the count of layers over MIN_M2 is the number of greys the rider sees. The
// overlays (kerb, paint, tram, bollard, hedge, furniture) and the bridge parts are not ground surfaces and are left out.
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { GroundStore, toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { ROAD_SPOTS } from '../../src/canalRecall/ownGround/roadRegressions.ts';
import type { GroundLayer } from '../../src/canalRecall/ownGround/groundCell.ts';
import { probeSpot } from './probe-doubled-lanes.ts';

const OVERLAYS = new Set<GroundLayer>(['kerb', 'paint', 'tram', 'bollard', 'hedge', 'furniture', 'quay', 'deckBody', 'deckTop']);
/** A layer under this many m² in the crop is a sliver, not a material the rider reads. */
export const MIN_M2 = 2;

async function main(): Promise<void> {
  const ROOT = 'public/data/extracts/amsterdam';
  const bytes = async (path: string) => { const b = readFileSync(join(ROOT, path)); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); };
  const only = process.argv.find(a => a.startsWith('--only='))?.slice(7).split(',');
  const json = process.argv.find(a => a.startsWith('--json='))?.slice(7);
  const store = new GroundStore(bytes, { roads: true });
  await store.init();
  const rows: Record<string, Record<string, number>> = {};
  for (const s of ROAD_SPOTS) {
    if (only && !only.includes(s.id)) continue;
    const { cells } = await probeSpot(store, s);
    const [x, y] = toLocal(s.at[0], s.at[1]), x0 = x - s.halfM, y0 = y - s.halfM, x1 = x + s.halfM, y1 = y + s.halfM;
    const area: Record<string, number> = {};
    for (const c of cells) for (const [layer, m] of Object.entries(c.layers)) {
      if (!m || OVERLAYS.has(layer as GroundLayer)) continue;
      const p = m.positions, idx = m.indices;
      for (let t = 0; t < idx.length; t += 3) {
        const A = idx[t] * 3, B = idx[t + 1] * 3, C = idx[t + 2] * 3, cx = (p[A] + p[B] + p[C]) / 3, cy = (p[A + 1] + p[B + 1] + p[C + 1]) / 3;
        if (cx < x0 || cx >= x1 || cy < y0 || cy >= y1) continue;
        area[layer] = (area[layer] ?? 0) + Math.abs((p[B] - p[A]) * (p[C + 1] - p[A + 1]) - (p[B + 1] - p[A + 1]) * (p[C] - p[A])) / 2;
      }
    }
    rows[s.id] = Object.fromEntries(Object.entries(area).filter(([, v]) => v >= MIN_M2).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, Math.round(v)]));
  }
  console.table(Object.entries(rows).map(([id, a]) => ({ spot: id, materials: Object.keys(a).length, layers: Object.entries(a).map(([k, v]) => `${k} ${v}`).join(', ') })));
  if (json) writeFileSync(json, JSON.stringify(rows, null, 1) + '\n');
}

main().catch(e => { console.error(e); process.exit(1); });
