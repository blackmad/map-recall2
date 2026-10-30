/**
 * AHN heights over a footprint: dsm_05m inside it, dtm_05m in a 6 m pad around
 * it, from the PDOK AHN WCS (CC0), cached in .cache/bag-gaps-ahn/ by request URL.
 * Moved out of scripts/survey-bag-gaps.ts (2026-10-30) so measure-guessed-heights
 * reads the same rasters; behaviour unchanged.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { createHash } from 'node:crypto';
import { lngLatToRd } from '../../src/canalRecall/facade/rdNew';
import { readGeoTiff, type Raster } from '../../src/canalRecall/ownGround/geotiff';
import { pointInRing, type Ring } from '../../src/canalRecall/landmarks/osmUnderModels';
import { ahnHeights, type AhnHeights } from '../../src/canalRecall/bagGaps';

const ROOT = path.resolve(import.meta.dirname, '../..');
const AHN_CACHE = path.join(ROOT, '.cache/bag-gaps-ahn');
const WCS = 'https://service.pdok.nl/rws/ahn/wcs/v1_0';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
export async function fetchRetry(url: string, accept: (r: Response) => boolean): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    try { const r = await fetch(url, { signal: AbortSignal.timeout(90_000) }); if (r.ok && accept(r)) return r; if (attempt >= 5) throw new Error(`HTTP ${r.status} ${url}`); }
    catch (e) { if (attempt >= 5) throw e; }
    await sleep(1500 * (attempt + 1));
  }
}

async function raster(coverage: 'dsm_05m' | 'dtm_05m', bbox: number[]): Promise<Raster> {
  const url = `${WCS}?` + new URLSearchParams({ SERVICE: 'WCS', VERSION: '1.0.0', REQUEST: 'GetCoverage', COVERAGE: coverage, CRS: 'EPSG:28992', BBOX: bbox.join(','), RESX: '0.5', RESY: '0.5', FORMAT: 'GEOTIFF' });
  const file = path.join(AHN_CACHE, `${createHash('sha1').update(url).digest('hex')}.tif`);
  if (!fs.existsSync(file)) {
    const res = await fetchRetry(url, r => (r.headers.get('content-type') ?? '').includes('tiff'));
    fs.mkdirSync(AHN_CACHE, { recursive: true });
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
  return readGeoTiff(fs.readFileSync(file), b => zlib.inflateSync(b));
}
const sample = (r: Raster, x: number, y: number) => {
  const col = Math.floor((x - r.originX) / r.pixelX), row = Math.floor((r.originY - y) / Math.abs(r.pixelY));
  return col < 0 || row < 0 || col >= r.width || row >= r.height ? NaN : r.data[row * r.width + col];
};

/** p70 roof (and eaves/ridge) over the median ground around the footprint; null when AHN has too few samples. */
export async function ahnForRings(rings: readonly Ring[]): Promise<AhnHeights | null> {
  const rd = rings.map(r => r.map(p => { const q = lngLatToRd([p[0], p[1]]); return [q.x, q.y] as [number, number]; }));
  const xs = rd.flat().map(p => p[0]), ys = rd.flat().map(p => p[1]), pad = 6;
  const bbox = [Math.floor(Math.min(...xs) - pad), Math.floor(Math.min(...ys) - pad), Math.ceil(Math.max(...xs) + pad), Math.ceil(Math.max(...ys) + pad)];
  const [dsm, dtm] = await Promise.all([raster('dsm_05m', bbox), raster('dtm_05m', bbox)]);
  const roof: number[] = [], ground: number[] = [];
  // Roof: cell centres inside the footprint, 0.5 m in from the walls is not needed at p70. Ground: DTM in the padded box.
  for (let x = bbox[0] + 0.25; x < bbox[2]; x += 0.5) for (let y = bbox[1] + 0.25; y < bbox[3]; y += 0.5) {
    const inside = rd.some(r => pointInRing([x, y], r as unknown as Ring));
    if (inside) roof.push(sample(dsm, x, y)); else ground.push(sample(dtm, x, y));
  }
  return ahnHeights(roof, ground);
}
