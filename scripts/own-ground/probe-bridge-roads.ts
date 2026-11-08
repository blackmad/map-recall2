// Roads across bridges and the red lanes (lane R5-C1, issue #262; user aerial shots 2026-11-08: "missing continuity at
// bridges, looks chaotic, grey clipping through red").
//
//   npx tsx scripts/own-ground/probe-bridge-roads.ts [--only=id,id] [--json=out.json] [--before]
//
// At each roadRegressions ROAD_SPOTS crop, the own ground built as the game builds it (roads-v1, LOD 0) with source
// tracing on, and counted:
//   decks        deck polygons (h ≥ 1) whose interior lies in the crop; `skipped` (hidden): their own layer is the topmost
//                surface at under 10 % of their points (0.5 m grid; skipped, or drawn under another surface); `partial` < 90 %
//   deckTopM2    area (m²) where the grey deck top is the topmost surface while a deck polygon of a road class lies there
//   bridgeBandM2 OSM band surface triangles (source `band`) within a bridge way's half-width: bands over the survey's deck
//   redOverlapM2 area where the survey's cycle-crossing red (`cycleCross`) and the cycleThrough ribbon both draw; `mouths`
//                the 5 m tiles holding such overlap
//   greyInRedM2  inside the red footprint (any `cycle` layer triangle), area whose topmost hit (groundCell compareHits) is
//                a grey surface (asphalt, klinker, brick, paving, gravel, deck top); `nearM2`: a grey within 1 cm of the
//                red there (polygon offset alone keeps the red on top: depth-fight prone from the air)
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { GroundStore, toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { buildCell, compareHits, type BuiltCell, type GroundLayer } from '../../src/canalRecall/ownGround/groundCell.ts';
import { RoadIndex, surfaceLayer } from '../../src/canalRecall/ownGround/roadSurfaces.ts';
import { ROAD_SPOTS, type RoadSpot } from '../../src/canalRecall/ownGround/roadRegressions.ts';
import { setSourceTracing, sourceOfCode } from '../../src/canalRecall/ownGround/sourceTrace.ts';
import { prepareWays, isBridgeWay, type LocalWay } from '../../src/canalRecall/ownGround/streets.ts';
import { interiorPoint } from '../../src/canalRecall/ownGround/parks.ts';

const RES = 0.25;
const GREY: readonly GroundLayer[] = ['asphalt', 'klinker', 'brick', 'paving', 'gravel', 'deckTop'];
const SURFACE: readonly GroundLayer[] = ['asphalt', 'klinker', 'brick', 'paving', 'gravel', 'cycle', 'deckTop'];

export interface BridgeRoadCounts {
  id: string;
  decks: number; skipped: number; partial: number;
  deckTopM2: number; bridgeBandM2: number; bridgeBandWays: number[];
  redOverlapM2: number; mouths: number;
  redM2: number; greyInRedM2: number; nearM2: number;
  skippedInfo: string[];
}

type Grid = { w: number; x0: number; y0: number; z: Float32Array; src: Uint8Array };
const newGrid = (x0: number, y0: number, w: number): Grid => ({ w, x0, y0, z: new Float32Array(w * w).fill(-Infinity), src: new Uint8Array(w * w) });

/** Rasterise the triangles of `m` (those `keep` accepts, by triangle index) into `g` as the highest z per texel. */
function raster(g: Grid, positions: ArrayLike<number>, indices: ArrayLike<number>, keep: (t: number) => boolean, src?: ArrayLike<number>): void {
  const p = positions;
  for (let t = 0; t < indices.length; t += 3) {
    if (!keep(t / 3)) continue;
    const a = indices[t] * 3, b = indices[t + 1] * 3, c = indices[t + 2] * 3;
    const minX = Math.min(p[a], p[b], p[c]), maxX = Math.max(p[a], p[b], p[c]), minY = Math.min(p[a + 1], p[b + 1], p[c + 1]), maxY = Math.max(p[a + 1], p[b + 1], p[c + 1]);
    const i0 = Math.max(0, Math.floor((minX - g.x0) / RES)), i1 = Math.min(g.w - 1, Math.floor((maxX - g.x0) / RES));
    const j0 = Math.max(0, Math.floor((minY - g.y0) / RES)), j1 = Math.min(g.w - 1, Math.floor((maxY - g.y0) / RES));
    if (i0 > i1 || j0 > j1) continue;
    const d = (p[b + 1] - p[c + 1]) * (p[a] - p[c]) + (p[c] - p[b]) * (p[a + 1] - p[c + 1]);
    if (Math.abs(d) < 1e-12) continue;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = g.x0 + (i + 0.5) * RES, y = g.y0 + (j + 0.5) * RES;
      const u = ((p[b + 1] - p[c + 1]) * (x - p[c]) + (p[c] - p[b]) * (y - p[c + 1])) / d;
      const v = ((p[c + 1] - p[a + 1]) * (x - p[c]) + (p[a] - p[c]) * (y - p[c + 1])) / d;
      if (u < -1e-9 || v < -1e-9 || u + v > 1 + 1e-9) continue;
      const z = u * p[a + 2] + v * p[b + 2] + (1 - u - v) * p[c + 2], k = j * g.w + i;
      if (z > g.z[k]) { g.z[k] = z; if (src) g.src[k] = src[t / 3]; }
    }
  }
}

const segDist = (x: number, y: number, a: readonly number[], b: readonly number[]) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy, t = l2 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l2)) : 0;
  return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);
};

export async function probeBridgeRoads(store: GroundStore, s: RoadSpot): Promise<BridgeRoadCounts> {
  const [x, y] = toLocal(s.at[0], s.at[1]), half = s.halfM, x0 = x - half, y0 = y - half, w = Math.round(2 * half / RES);
  const keys = new Set<string>([store.cellAt(x, y)]);
  for (const dx of [-half, half]) for (const dy of [-half, half]) keys.add(store.cellAt(x + dx, y + dy));
  for (const k of [...keys]) for (const n of GroundStore.neighbours(k)) keys.add(n);
  const cells: BuiltCell[] = [];
  const ways = new Map<number, LocalWay>();
  setSourceTracing(true);
  try {
    for (const k of keys) {
      if (!store.covers(k)) continue;
      const input = await store.cellInput(k, 0);
      cells.push(buildCell(input));
      if (input.osm) for (const wy of prepareWays(input.osm.ways, input.project)) ways.set(wy.id, wy);
    }
  } finally { setSourceTracing(false); }
  const roads = await Promise.all([...keys].map(k => store.roadCell(k)));
  const index = new RoadIndex(roads, [x0 - 30, y0 - 30, x0 + 2 * half + 30, y0 + 2 * half + 30]);
  const inCrop = (px: number, py: number) => px >= x0 && px < x0 + 2 * half && py >= y0 && py < y0 + 2 * half;

  // Per layer top z, and the red by owner.
  const tops = new Map<GroundLayer, Grid>(), cross = newGrid(x0, y0, w), through = newGrid(x0, y0, w), survey = newGrid(x0, y0, w);
  const BGT = new Set(['bgtCarriage', 'bgtParking', 'bgtFoot', 'bgtPedestrian', 'bgtCycle', 'bgtDriveway', 'bgtIsland', 'bgtBerm', 'bgtVerge', 'bgtSquare', 'fietsstraat', 'deckCarry']);
  const bridgeWays = [...ways.values()].filter(isBridgeWay);
  let bandM2 = 0;
  const bandWays = new Set<number>();
  for (const c of cells) {
    for (const layer of SURFACE) {
      const m = c.layers[layer];
      if (!m) continue;
      const g = tops.get(layer) ?? (tops.set(layer, newGrid(x0, y0, w)), tops.get(layer)!);
      raster(g, m.positions, m.indices, () => true, c.sources?.[layer]);
      const src = c.sources?.[layer];
      if (!src) continue;
      raster(survey, m.positions, m.indices, t => BGT.has(sourceOfCode(src[t]) ?? ''));
      if (layer === 'cycle') {
        raster(cross, m.positions, m.indices, t => sourceOfCode(src[t]) === 'cycleCross');
        raster(through, m.positions, m.indices, t => sourceOfCode(src[t]) === 'cycleThrough');
      }
      if (layer === 'deckTop') continue;
      // Bands on bridge ways: a band triangle whose centroid lies within a bridge way's half-width.
      const p = m.positions, idx = m.indices;
      for (let t = 0; t < idx.length; t += 3) {
        if (sourceOfCode(src[t / 3]) !== 'band') continue;
        const A = idx[t] * 3, B = idx[t + 1] * 3, C = idx[t + 2] * 3, cx = (p[A] + p[B] + p[C]) / 3, cy = (p[A + 1] + p[B + 1] + p[C + 1]) / 3;
        if (!inCrop(cx, cy)) continue;
        for (const bw of bridgeWays) {
          let hit = false;
          for (let i = 0; i + 1 < bw.points.length && !hit; i++) hit = segDist(cx, cy, bw.points[i], bw.points[i + 1]) <= bw.section.halfWidth + 0.25;
          if (!hit) continue;
          bandM2 += Math.abs((p[B] - p[A]) * (p[C + 1] - p[A + 1]) - (p[C] - p[A]) * (p[B + 1] - p[A + 1])) / 2;
          bandWays.add(bw.id);
          break;
        }
      }
    }
  }
  const px = RES * RES;
  // Deck polygons in the crop: shown where the topmost surface at their points (1 m grid, inside the crop) is their own
  // layer (roadSurfaces surfaceLayer). Hidden (< 10 % shown: skipped, or drawn under another surface) / partial (< 90 %).
  let decks = 0, skipped = 0, partial = 0;
  const skippedInfo: string[] = [];
  const topAt = (i: number, j: number): GroundLayer | 'none' => {
    const hs: { layer: GroundLayer; z: number }[] = [];
    for (const [layer, g] of tops) if (g.z[j * w + i] > -Infinity) hs.push({ layer, z: g.z[j * w + i] });
    hs.sort(compareHits);
    return hs[0]?.layer ?? 'none';
  };
  for (let k = 0; k < index.records.length; k++) {
    if (index.records[k].h < 1) continue;
    const ip = interiorPoint(index.ringsOf(k));
    if (!ip || !inCrop(ip[0], ip[1])) continue;
    decks++;
    const want = surfaceLayer(index.drawClass(k), index.mesh(k));
    const ring = index.ringsOf(k)[0];
    const bx0 = Math.min(...ring.map(q => q[0])), bx1 = Math.max(...ring.map(q => q[0])), by0 = Math.min(...ring.map(q => q[1])), by1 = Math.max(...ring.map(q => q[1]));
    let n = 0, shown = 0;
    const seen: Record<string, number> = {};
    for (let qx = bx0 + 0.25; qx < bx1; qx += 0.5) for (let qy = by0 + 0.25; qy < by1; qy += 0.5) {
      if (!index.findAll(qx, qy).includes(k)) continue;
      const i = Math.floor((qx - x0) / RES), j = Math.floor((qy - y0) / RES);
      if (i < 0 || j < 0 || i >= w || j >= w) continue;
      n++;
      const t = topAt(i, j);
      if (t === want || (want === 'paving' && t === 'kerb')) shown++;
      else seen[t] = (seen[t] ?? 0) + 1;
    }
    if (!n) { decks--; continue; }
    if (shown < 0.1 * n) { skipped++; skippedInfo.push(`hidden ${index.drawClass(k)}/${want} h${index.records[k].h} ${(n / 4).toFixed(0)}m² at ${ip.map(v => v.toFixed(0))} top ${JSON.stringify(seen)}`); }
    else if (shown < 0.9 * n) { partial++; skippedInfo.push(`partial ${(100 * shown / n).toFixed(0)}% ${index.drawClass(k)}/${want} h${index.records[k].h} ${(n / 4).toFixed(0)}m² top ${JSON.stringify(seen)}`); }
  }
  // Per texel.
  let deckTop = 0, overlap = 0, red = 0, greyIn = 0, near = 0;
  const mouths = new Set<string>();
  for (let j = 0; j < w; j++) for (let i = 0; i < w; i++) {
    const k = j * w + i, qx = x0 + (i + 0.5) * RES, qy = y0 + (j + 0.5) * RES;
    const hits: { layer: GroundLayer; z: number }[] = [];
    for (const [layer, g] of tops) if (g.z[k] > -Infinity) hits.push({ layer, z: g.z[k] });
    if (!hits.length) continue;
    hits.sort(compareHits);
    if (hits[0].layer === 'deckTop' && index.onDeck(qx, qy)) deckTop++;
    if (cross.z[k] > -Infinity && through.z[k] > -Infinity) { overlap++; mouths.add(`${Math.floor(qx / 5)}:${Math.floor(qy / 5)}`); }
    const r = hits.find(h => h.layer === 'cycle');
    if (!r) continue;
    red++;
    if (GREY.includes(hits[0].layer)) { greyIn++; if (process.env.PROBE_SAMPLES && greyIn % 40 === 1) console.error('greyInRed', s.id, qx.toFixed(1), qy.toFixed(1), JSON.stringify(hits.map(h => [h.layer, +h.z.toFixed(3), sourceOfCode(tops.get(h.layer)!.src[k])]))); }
    else if (hits.some(h => GREY.includes(h.layer) && Math.abs(h.z - r.z) < 0.01)) near++;
  }
  return { id: s.id, decks, skipped, partial, deckTopM2: +(deckTop * px).toFixed(1), bridgeBandM2: +bandM2.toFixed(1), bridgeBandWays: [...bandWays], redOverlapM2: +(overlap * px).toFixed(1), mouths: mouths.size, redM2: +(red * px).toFixed(1), greyInRedM2: +(greyIn * px).toFixed(1), nearM2: +(near * px).toFixed(1), skippedInfo };
}

async function main(): Promise<void> {
  const ROOT = 'public/data/extracts/amsterdam';
  const bytes = async (path: string) => { const b = readFileSync(join(ROOT, path)); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); };
  const only = process.argv.find(a => a.startsWith('--only='))?.slice(7).split(',');
  const json = process.argv.find(a => a.startsWith('--json='))?.slice(7);
  // --before: the build without lane R5-C1 (bridgeCarry and redDedupe off, as `?bridgeCarry=0&redDedupe=0`).
  const before = process.argv.includes('--before');
  const store = new GroundStore(bytes, { roads: true, ...(before ? { bridgeCarry: false, redDedupe: false } : {}) });
  await store.init();
  const rows: BridgeRoadCounts[] = [];
  for (const s of ROAD_SPOTS) if (!only || only.includes(s.id)) { rows.push(await probeBridgeRoads(store, s)); console.error(JSON.stringify(rows[rows.length - 1])); }
  console.table(rows.map(r => ({ spot: r.id, decks: r.decks, skipped: r.skipped, partial: r.partial, deckTopM2: r.deckTopM2, bridgeBandM2: r.bridgeBandM2, redOverlapM2: r.redOverlapM2, mouths: r.mouths, redM2: r.redM2, greyInRedM2: r.greyInRedM2, nearM2: r.nearM2 })));
  if (json) writeFileSync(json, JSON.stringify(rows, null, 2));
}

if (process.argv[1]?.endsWith('probe-bridge-roads.ts')) main().catch(e => { console.error(e); process.exit(1); });
