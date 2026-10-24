// Doubled lanes probe (lane roads-lanes 2026-10-23, R2; user: "multiple lanes where people don't expect").
//
//   npx tsx scripts/own-ground/probe-doubled-lanes.ts [--only=id,id]
//
// At every roadRegressions ROAD_SPOTS crop, the own ground built as the game builds it (roads-v1 on, LOD 0) with
// source tracing on (sourceTrace.ts), and per triangle whose centroid lies in the crop:
//   ribbonOverCycle  a red cycle-lane ribbon (laneRibbon) or red band piece (cyclePaint) over a BGT `cycle` polygon:
//                    the fietspad is the lane, the ribbon a second one;
//   bandOverSurvey   an OSM street band's surface triangle (any surface mesh) over a BGT polygon of any class: the
//                    survey is the surface there, the band a second carriageway or path on top of it.
// Both are gated at 0 by check-ground-cells (`--road-regressions` and the full run). Exit code 1 when either is not 0.
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { GroundStore, toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { buildCell, type BuiltCell, type GroundLayer } from '../../src/canalRecall/ownGround/groundCell.ts';
import { RoadIndex } from '../../src/canalRecall/ownGround/roadSurfaces.ts';
import { ROAD_SPOTS, type RoadSpot } from '../../src/canalRecall/ownGround/roadRegressions.ts';
import { setSourceTracing, sourceOfCode } from '../../src/canalRecall/ownGround/sourceTrace.ts';

const SURFACES: readonly GroundLayer[] = ['asphalt', 'klinker', 'cycle', 'paving', 'gravel'];

export interface DoubledLanes { id: string; ribbonOverCycle: number; bandOverSurvey: number; ribbons: number; bands: number; samples: [number, number, string][]; /** The cells built (LOD 0, traced), for the caller's own rasters. */ cells: BuiltCell[] }

/** Count the doubled-lane triangles of one spot (store with roads on). */
export async function probeSpot(store: GroundStore, s: RoadSpot): Promise<DoubledLanes> {
  const [x, y] = toLocal(s.at[0], s.at[1]), half = s.halfM, x0 = x - half, y0 = y - half;
  const keys = new Set<string>([store.cellAt(x, y)]);
  for (const dx of [-half, half]) for (const dy of [-half, half]) keys.add(store.cellAt(x + dx, y + dy));
  for (const k of [...keys]) for (const n of GroundStore.neighbours(k)) keys.add(n);
  const cells: BuiltCell[] = [];
  setSourceTracing(true);
  try { for (const k of keys) if (store.covers(k)) cells.push(buildCell(await store.cellInput(k, 0))); } finally { setSourceTracing(false); }
  const roads = await Promise.all([...keys].map(k => store.roadCell(k)));
  const index = new RoadIndex(roads, [x0 - 5, y0 - 5, x0 + 2 * half + 5, y0 + 2 * half + 5]);
  const out: DoubledLanes = { id: s.id, ribbonOverCycle: 0, bandOverSurvey: 0, ribbons: 0, bands: 0, samples: [], cells };
  for (const c of cells) for (const layer of SURFACES) {
    const m = c.layers[layer], src = c.sources?.[layer];
    if (!m || !src) continue;
    const p = m.positions, idx = m.indices;
    for (let t = 0; t < idx.length; t += 3) {
      const A = idx[t] * 3, B = idx[t + 1] * 3, C = idx[t + 2] * 3, cx = (p[A] + p[B] + p[C]) / 3, cy = (p[A + 1] + p[B + 1] + p[C + 1]) / 3;
      if (cx < x0 || cx >= x0 + 2 * half || cy < y0 || cy >= y0 + 2 * half) continue;
      const s_ = sourceOfCode(src[t / 3]);
      if (s_ === 'laneRibbon' || s_ === 'cyclePaint') {
        out.ribbons++;
        if (index.classAt(cx, cy) === 'cycle') { out.ribbonOverCycle++; if (out.samples.length < 8) out.samples.push([+cx.toFixed(1), +cy.toFixed(1), `${s_}/${layer}`]); }
      } else if (s_ === 'band') {
        out.bands++;
        const cls = index.classAt(cx, cy);
        if (cls !== null) { out.bandOverSurvey++; if (out.samples.length < 8) out.samples.push([+cx.toFixed(1), +cy.toFixed(1), `band/${layer} over ${cls}`]); }
      }
    }
  }
  return out;
}

async function main(): Promise<void> {
  const ROOT = 'public/data/extracts/amsterdam';
  const bytes = async (path: string) => { const b = readFileSync(join(ROOT, path)); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); };
  const only = process.argv.find(a => a.startsWith('--only='))?.slice(7).split(',');
  const store = new GroundStore(bytes, { roads: true });
  await store.init();
  const rows: DoubledLanes[] = [];
  for (const s of ROAD_SPOTS) if (!only || only.includes(s.id)) rows.push(await probeSpot(store, s));
  console.table(rows.map(r => ({ spot: r.id, ribbonOverCycle: `${r.ribbonOverCycle}/${r.ribbons}`, bandOverSurvey: `${r.bandOverSurvey}/${r.bands}`, sample: r.samples[0]?.join(' ') ?? '' })));
  const bad = rows.reduce((n, r) => n + r.ribbonOverCycle + r.bandOverSurvey, 0);
  console.log(JSON.stringify({ ribbonOverCycle: rows.reduce((n, r) => n + r.ribbonOverCycle, 0), bandOverSurvey: rows.reduce((n, r) => n + r.bandOverSurvey, 0) }));
  process.exitCode = bad ? 1 : 0;
}

if (process.argv[1]?.endsWith('probe-doubled-lanes.ts')) main().catch(e => { console.error(e); process.exit(1); });
