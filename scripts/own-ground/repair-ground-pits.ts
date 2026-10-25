// Fill stairwell / ramp pits in the published ground-height extract (issue #53: Stationsplein's metro and
// bike-garage entrances drew as 3 m craters in the paving). build-ground-height.ts blanks pits before its hole
// fill (heightField.ts findPits); this applies the same pass to the published tiles without re-downloading AHN:
// each tile with its eight neighbours on one canvas (decoded at the index step), pits found, blanked with a
// one-sample rim (the published field was smoothed across it), pull-push filled, smoothed inside the blank only.
//
//   npx tsx scripts/own-ground/repair-ground-pits.ts                 # report only (counts, pits with lng/lat)
//   npx tsx scripts/own-ground/repair-ground-pits.ts --write         # repaired tiles + index into the staging dir
//   # review artifacts/own-ground/staging/ground-height-pits/report.json, then
//   cp artifacts/own-ground/staging/ground-height-pits/tiles/* public/data/extracts/amsterdam/ground-height-v1/tiles/
//   cp artifacts/own-ground/staging/ground-height-pits/index.json public/data/extracts/amsterdam/ground-height-v1/
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
import { join } from 'node:path';
import { coarsenTile, dilateMask, encodeTile, findPits, PIT_DEFAULTS, pullPushFill, readGroundTile, smooth3, tileKey, type GroundIndex } from '../../src/canalRecall/ownGround/heightField.ts';
import { rdToLngLat } from '../../src/canalRecall/facade/rdNew.ts';

const args = process.argv.slice(2);
const opt = (k: string, d: string) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const SRC = opt('src', 'public/data/extracts/amsterdam/ground-height-v1');
const OUT = opt('out', 'artifacts/own-ground/staging/ground-height-pits');
const WRITE = args.includes('--write');
const index = JSON.parse(readFileSync(join(SRC, 'index.json'), 'utf8')) as GroundIndex;
const n = index.samples, step = index.stepM, T = index.tileSizeM;
const entries = new Map(index.tiles.map(t => [tileKey(t[0], t[1]), t]));
const cache = new Map<string, Float32Array>();
const tile = (k: string): Float32Array | null => {
  if (cache.has(k)) return cache.get(k)!;
  const e = entries.get(k);
  if (!e) return null;
  const b = readFileSync(join(SRC, 'tiles', `${k}.bin`));
  const h = readGroundTile(index, e, new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b));
  cache.set(k, h);
  return h;
};

const pits: { tile: string; lng: number; lat: number; areaM2: number; depthM: number; rimSpreadM: number }[] = [];
let changedTiles = 0, blanked = 0, rejected = 0;
if (WRITE) mkdirSync(join(OUT, 'tiles'), { recursive: true });
const order = [...index.tiles].sort((a, b) => a[1] - b[1] || a[0] - b[0]);
for (const [tx, ty] of order) {
  // Drop decoded tiles two rows behind (row-major order) to bound memory.
  for (const k of [...cache.keys()]) if (Number(k.split('_')[1]) < ty - 1) cache.delete(k);
  const w = 3 * n, data = new Float32Array(w * w).fill(NaN);
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const t = tile(tileKey(tx + dx, ty + dy));
    if (!t) continue;
    for (let j = 0; j < n; j++) data.set(t.subarray(j * n, (j + 1) * n), ((dy + 1) * n + j) * w + (dx + 1) * n);
  }
  const grid = { width: w, height: w, data };
  const found = findPits(grid, { stepM: step, ...PIT_DEFAULTS });
  // Only the centre tile's pits are this tile's (a neighbour's are counted, and repaired, with that tile).
  rejected += found.rejected; // canvas-wide (each hollow is seen by up to nine canvases): a relative figure
  const own = found.pits.filter(p => p.i >= n && p.i < 2 * n && p.j >= n && p.j < 2 * n);
  for (const p of own) {
    const [lng, lat] = rdToLngLat({ x: tx * T - T + (p.i + 0.5) * step, y: ty * T - T + (p.j + 0.5) * step });
    pits.push({ tile: tileKey(tx, ty), lng: +lng.toFixed(6), lat: +lat.toFixed(6), areaM2: p.areaM2, depthM: p.depthM, rimSpreadM: p.rimSpreadM });
  }
  if (!own.length || !WRITE) continue;
  const blank = dilateMask(found.mask, w, w, 1);
  let count = 0;
  for (let k = 0; k < blank.length; k++) if (blank[k]) { data[k] = NaN; count++; }
  pullPushFill(grid);
  const smoothed = { width: w, height: w, data: data.slice() };
  smooth3(smoothed);
  const e = entries.get(tileKey(tx, ty))!, factor = Math.round((e[3] ?? step) / step), m = n / factor;
  const out = new Float32Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = (n + j) * w + n + i;
    out[j * n + i] = blank[k] ? smoothed.data[k] : data[k];
    if (blank[k]) blanked++;
  }
  // A coarse (outer-ring) tile is stored at its own step again: only the blocks under a pit change.
  let stored = out;
  if (factor > 1) {
    const after = coarsenTile(out, n, factor), touched = new Uint8Array(m * m);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) if (blank[(n + j) * w + n + i]) touched[Math.floor(j / factor) * m + Math.floor(i / factor)] = 1;
    // The stored coarse samples stay exactly where no pit touched their block.
    stored = decodeStored(readFileSync(join(SRC, 'tiles', `${tileKey(tx, ty)}.bin`)), m);
    for (let k = 0; k < m * m; k++) if (touched[k]) stored[k] = after[k];
  }
  writeFileSync(join(OUT, 'tiles', `${tileKey(tx, ty)}.bin`), gzipSync(encodeTile(stored, m, index.predictor ?? 'dx'), { level: 9 }));
  changedTiles++;
}

function decodeStored(raw: Buffer, m: number): Float32Array {
  // readGroundTile upsamples coarse tiles; the stored grid itself is the plain decode at m × m.
  return readGroundTile({ ...index, stepM: T / m }, [0, 0, 1], new Uint8Array(gunzipSync(raw)));
}

const byDepth = [...pits].sort((a, b) => b.depthM - a.depthM);
const summary = { tiles: index.tiles.length, pits: pits.length, areaM2: pits.reduce((s, p) => s + p.areaM2, 0), deeperThan2m: pits.filter(p => p.depthM > 2).length, tilesWithPits: new Set(pits.map(p => p.tile)).size, changedTiles, blankedSamples: blanked, rejectedOnCanvases: rejected, options: PIT_DEFAULTS };
console.log(JSON.stringify(summary, null, 2));
if (WRITE) {
  const method = `${(index.sources as Record<string, unknown>)?.method ?? ''}; pits (findPits: ${PIT_DEFAULTS.radiusM} m closing, > ${PIT_DEFAULTS.minDepthM} m deep, ≤ ${PIT_DEFAULTS.maxAreaM2} m²) blanked with a one-sample rim and refilled (repair-ground-pits.ts)`;
  writeFileSync(join(OUT, 'index.json'), JSON.stringify({ ...index, sources: { ...index.sources, method } }) + '\n');
}
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'report.json'), JSON.stringify({ summary, pits: byDepth }, null, 2) + '\n');
