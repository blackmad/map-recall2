// Build the ground-height extract (AHN DTM → 2 m RD grid, holes filled) into a
// staging directory, with a coverage report. Review, then publish:
//
//   npx tsx scripts/own-ground/build-ground-height.ts            # the two prototype boxes
//   npx tsx scripts/own-ground/build-ground-height.ts --city     # every 1 km tile touching Amsterdam (≈1.6 GB of AHN downloads)
//   # review artifacts/own-ground/staging/ground-height-v1/report.json, then
//   cp -R artifacts/own-ground/staging/ground-height-v1 public/data/extracts/amsterdam/
//
// Source: AHN `dtm_05m` from PDOK's WCS (open data, CC0), fetched as 500 m GeoTIFFs
// and cached under artifacts/own-ground/raw/ahn (not committed; re-fetchable).
// See src/canalRecall/ownGround/heightField.ts for the tile format.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gzipSync, inflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { readGeoTiff } from '../../src/canalRecall/ownGround/geotiff.ts';
import { downsample, encodeTile, pullPushFill, type GroundIndex, type Grid } from '../../src/canalRecall/ownGround/heightField.ts';
import { lngLatToRd } from '../../src/canalRecall/facade/rdNew.ts';
import { OWN_GROUND_BOXES } from '../../src/canalRecall/ownGround/boxes.ts';

const args = process.argv.slice(2);
const opt = (k: string, d: string) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const STEP = Number(opt('step', '2'));
const TILE = 1000;
const SRC = 500; // AHN request size, metres (1000 × 1000 px at 0.5 m)
const PX = 0.5;
const RAW = opt('raw', 'artifacts/own-ground/raw/ahn');
const OUT = opt('out', 'artifacts/own-ground/staging/ground-height-v1');
const MARGIN = Number(opt('margin', '500'));
const WATER_LEVEL_NAP = -0.40, FREEBOARD = 1.77;

function wantedTiles(): Set<string> {
  const keys = new Set<string>();
  const addBox = (lng0: number, lat0: number, lng1: number, lat1: number) => {
    const corners = [[lng0, lat0], [lng1, lat0], [lng0, lat1], [lng1, lat1]].map(c => lngLatToRd(c as [number, number]));
    const xs = corners.map(c => c.x), ys = corners.map(c => c.y);
    for (let tx = Math.floor(Math.min(...xs) / TILE); tx <= Math.floor(Math.max(...xs) / TILE); tx++)
      for (let ty = Math.floor(Math.min(...ys) / TILE); ty <= Math.floor(Math.max(...ys) / TILE); ty++) keys.add(`${tx}_${ty}`);
  };
  if (args.includes('--city')) {
    const b = JSON.parse(readFileSync('public/data/extracts/amsterdam/boundaries.json', 'utf8')) as Array<{ kind: string; name: string; geometry: [number, number][][][] }>;
    const city = b.find(x => x.kind === 'municipality' && x.name === 'Amsterdam')!;
    for (const poly of city.geometry) for (const ring of poly) for (const [lat, lng] of ring) addBox(lng, lat, lng, lat);
    // Fill the interior: every tile between the ring's tiles on each row.
    const rows = new Map<number, number[]>();
    for (const k of keys) { const [tx, ty] = k.split('_').map(Number); rows.set(ty, [...(rows.get(ty) ?? []), tx]); }
    for (const [ty, txs] of rows) for (let tx = Math.min(...txs); tx <= Math.max(...txs); tx++) keys.add(`${tx}_${ty}`);
    return keys;
  }
  for (const box of OWN_GROUND_BOXES) {
    const dLng = box.halfM / (111_320 * Math.cos(box.lat * Math.PI / 180)), dLat = box.halfM / 111_320;
    addBox(box.lng - dLng, box.lat - dLat, box.lng + dLng, box.lat + dLat);
  }
  return keys;
}

async function fetchAhn(x0: number, y0: number): Promise<{ data: Float32Array; width: number; height: number; file: string } | null> {
  const file = join(RAW, `dtm_05m_${x0}_${y0}.tif`);
  if (!existsSync(file)) {
    const url = `https://service.pdok.nl/rws/ahn/wcs/v1_0?service=WCS&request=GetCoverage&version=2.0.1&coverageId=dtm_05m&format=image/tiff&subset=x(${x0},${x0 + SRC})&subset=y(${y0},${y0 + SRC})`;
    for (let attempt = 0; ; attempt++) {
      const r = await fetch(url);
      if (r.ok && (r.headers.get('content-type') ?? '').includes('tiff')) { writeFileSync(file, Buffer.from(await r.arrayBuffer())); break; }
      if (attempt >= 3) { console.warn(`AHN ${x0},${y0}: ${r.status}`); return null; }
      await new Promise(res => setTimeout(res, 1000 * (attempt + 1)));
    }
  }
  const raster = readGeoTiff(readFileSync(file), b => inflateSync(b));
  if (raster.originX !== x0 || raster.originY !== y0 + SRC || raster.pixelX !== PX) throw new Error(`AHN ${file}: unexpected georeference ${raster.originX},${raster.originY} @ ${raster.pixelX}`);
  return { ...raster, file };
}

async function main(): Promise<void> {
  mkdirSync(RAW, { recursive: true });
  mkdirSync(join(OUT, 'tiles'), { recursive: true });
  const t0 = performance.now();
  const tiles = [...wantedTiles()].map(k => k.split('_').map(Number) as [number, number]).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  if (args.includes('--dry')) { console.log(JSON.stringify({ tiles: tiles.length, ahnRequests: tiles.length * (TILE / SRC) ** 2 })); return; }
  // Process row bands of tiles so the city build never holds more than a few km² at once.
  const bands = new Map<number, number[]>();
  for (const [tx, ty] of tiles) bands.set(ty, [...(bands.get(ty) ?? []), tx]);
  const factor = Math.round(STEP / PX);
  const n = TILE / STEP;
  const index: GroundIndex = {
    version: 1, crs: 'EPSG:28992', vertical: 'NAP', stepM: STEP, tileSizeM: TILE, samples: n, heightUnitM: 0.01, tiles: [],
    sceneDatumNAP: +(WATER_LEVEL_NAP + FREEBOARD).toFixed(2), waterLevelNAP: WATER_LEVEL_NAP,
    sources: { dtm: { service: 'https://service.pdok.nl/rws/ahn/wcs/v1_0', coverage: 'dtm_05m', licence: 'CC0 (AHN via PDOK)', fetched: new Date().toISOString().slice(0, 10) }, method: `mean of measured 0.5 m pixels per ${STEP} m cell (≥ 1/4 measured), holes (buildings, water, bridges) pull-push filled over the tile plus ${MARGIN} m margin` },
    attribution: 'Heights: AHN (Rijkswaterstaat / PDOK), CC0',
  };
  const report: Record<string, unknown>[] = [];
  const sourceHashes: Record<string, string> = {};
  let rawBytes = 0, gzBytes = 0;
  for (const [ty, txs] of bands) {
    const minTx = Math.min(...txs), maxTx = Math.max(...txs);
    const x0 = minTx * TILE - MARGIN, x1 = (maxTx + 1) * TILE + MARGIN, y0 = ty * TILE - MARGIN, y1 = (ty + 1) * TILE + MARGIN;
    const gw = (x1 - x0) / STEP, gh = (y1 - y0) / STEP;
    const grid: Grid = { width: gw, height: gh, data: new Float32Array(gw * gh).fill(NaN) };
    const requests: [number, number][] = [];
    for (let sx = x0; sx < x1; sx += SRC) for (let sy = y0; sy < y1; sy += SRC) requests.push([sx, sy]);
    // A few requests in flight; PDOK answers a 500 m tile in about a second.
    for (let i = 0; i < requests.length; i += 6) {
      const batch = await Promise.all(requests.slice(i, i + 6).map(([sx, sy]) => fetchAhn(sx, sy).then(r => ({ sx, sy, r }))));
      for (const { sx, sy, r } of batch) {
        if (!r) continue;
        sourceHashes[r.file.split('/').pop()!] = createHash('sha256').update(readFileSync(r.file)).digest('hex').slice(0, 16);
        const small = downsample(r, factor);
        const ox = (sx - x0) / STEP, oy = (sy - y0) / STEP;
        for (let j = 0; j < small.height; j++) grid.data.set(small.data.subarray(j * small.width, (j + 1) * small.width), (oy + j) * gw + ox);
      }
    }
    const measured = new Uint8Array(grid.data.length);
    for (let i = 0; i < measured.length; i++) measured[i] = grid.data[i] === grid.data[i] ? 1 : 0;
    pullPushFill(grid);
    for (const tx of txs) {
      const heights = new Float32Array(n * n);
      let meas = 0, min = Infinity, max = -Infinity, sum = 0;
      const ox = (tx * TILE - x0) / STEP, oy = (ty * TILE - y0) / STEP;
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const g = (oy + j) * gw + ox + i, v = grid.data[g];
        heights[j * n + i] = v; meas += measured[g];
        if (v === v) { min = Math.min(min, v); max = Math.max(max, v); sum += v; }
      }
      const bin = encodeTile(heights, n), gz = gzipSync(bin, { level: 9 });
      writeFileSync(join(OUT, 'tiles', `${tx}_${ty}.bin`), gz);
      rawBytes += bin.byteLength; gzBytes += gz.byteLength;
      const frac = meas / (n * n);
      index.tiles.push([tx, ty, +frac.toFixed(3)]);
      report.push({ tile: `${tx}_${ty}`, measured: +frac.toFixed(3), filled: +(1 - frac).toFixed(3), minNAP: +min.toFixed(2), maxNAP: +max.toFixed(2), meanNAP: +(sum / (n * n)).toFixed(2), gzBytes: gz.byteLength });
    }
    console.log(`band ty=${ty}: ${txs.length} tiles, ${requests.length} AHN requests, ${Math.round(performance.now() - t0)} ms`);
  }
  (index.sources as Record<string, unknown>).rawHashes = sourceHashes;
  writeFileSync(join(OUT, 'index.json'), JSON.stringify(index) + '\n');
  const summary = {
    tiles: index.tiles.length, stepM: STEP, samplesPerTile: n * n,
    measuredFraction: +(index.tiles.reduce((s, t) => s + t[2], 0) / index.tiles.length).toFixed(3),
    rawBytes, gzBytes, gzBytesPerKm2: Math.round(gzBytes / index.tiles.length), buildMs: Math.round(performance.now() - t0),
    note: 'gzBytes is what the browser downloads (tiles are served as gzip; DecompressionStream inflates them).',
  };
  writeFileSync(join(OUT, 'report.json'), JSON.stringify({ summary, tiles: report }, null, 2) + '\n');
  console.log(JSON.stringify(summary, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
