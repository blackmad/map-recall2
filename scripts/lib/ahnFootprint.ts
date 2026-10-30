/**
 * AHN heights over a footprint: the DSM inside it, the DTM in a 6 m pad around
 * it. AHN4 (2020) comes from the PDOK AHN WCS (CC0), cached in
 * .cache/bag-gaps-ahn/ by request URL. Moved out of scripts/survey-bag-gaps.ts
 * (2026-10-30) so measure-guessed-heights reads the same rasters.
 *
 * AHN5 (2023 flight, CC0) is not on the WCS yet: its 0.5 m sheets are cloud
 * GeoTIFFs on basisdata.nl (scripts/data/ahn5-sheets.json). Only the 256 px
 * tiles a footprint touches are range-fetched, cached in .cache/ahn5/.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { createHash } from 'node:crypto';
import { lngLatToRd } from '../../src/canalRecall/facade/rdNew';
import { readGeoTiff, readTiledTiffHeader, type Raster, type TiledTiff } from '../../src/canalRecall/ownGround/geotiff';
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

// ---- AHN5 from basisdata.nl cloud GeoTIFFs ---------------------------------------------------------------------
type Sampler = (x: number, y: number) => number;
const AHN5 = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/data/ahn5-sheets.json'), 'utf8')) as { flightYear: number; sheets: Record<string, [number, number, number, number]> };
export const AHN5_FLIGHT_YEAR = AHN5.flightYear;
const AHN5_CACHE = path.join(ROOT, '.cache/ahn5');
const ahn5Url = (kind: 'dsm' | 'dtm', sheet: string) => `https://basisdata.nl/hwh-ahn/AHN5/${kind === 'dsm' ? '03a_DSM_50cm/2023_R' : '02a_DTM_50cm/2023_M'}_${sheet}.TIF`;
async function rangeBytes(url: string, start: number, length: number, cacheFile: string): Promise<Uint8Array> {
  if (fs.existsSync(cacheFile)) return fs.readFileSync(cacheFile);
  for (let attempt = 0; ; attempt++) {
    try {
      const r = await fetch(url, { headers: { Range: `bytes=${start}-${start + length - 1}` }, signal: AbortSignal.timeout(90_000) });
      if (r.status === 206) { const b = new Uint8Array(await r.arrayBuffer()); fs.mkdirSync(path.dirname(cacheFile), { recursive: true }); fs.writeFileSync(cacheFile, b); return b; }
      if (attempt >= 5) throw new Error(`HTTP ${r.status} ${url}`);
    } catch (e) { if (attempt >= 5) throw e; }
    await sleep(1500 * (attempt + 1));
  }
}
const headers = new Map<string, Promise<TiledTiff>>();
const tiles = new Map<string, Promise<Float32Array>>();
function ahn5Header(kind: 'dsm' | 'dtm', sheet: string): Promise<TiledTiff> {
  const key = `${kind}-${sheet}`;
  if (!headers.has(key)) headers.set(key, rangeBytes(ahn5Url(kind, sheet), 0, 65536, path.join(AHN5_CACHE, `${key}-header.bin`)).then(b => readTiledTiffHeader(b, x => zlib.inflateSync(x))));
  return headers.get(key)!;
}
/** A sampler over AHN5 for an RD bbox: the tiles of every sheet the box touches, NaN outside the flight. */
async function ahn5Sampler(kind: 'dsm' | 'dtm', bbox: number[]): Promise<Sampler> {
  const parts: { tiff: TiledTiff; got: Map<number, Float32Array> }[] = [];
  for (const [sheet, [w, s, e, n]] of Object.entries(AHN5.sheets)) {
    if (bbox[2] < w || bbox[0] > e || bbox[3] < s || bbox[1] > n) continue;
    const tiff = await ahn5Header(kind, sheet), got = new Map<number, Float32Array>();
    const across = Math.ceil(tiff.width / tiff.tileWidth), tileM = tiff.tileWidth * tiff.pixelX;
    const c0 = Math.max(0, Math.floor((bbox[0] - tiff.originX) / tileM)), c1 = Math.min(across - 1, Math.floor((bbox[2] - tiff.originX) / tileM));
    const r0 = Math.max(0, Math.floor((tiff.originY - bbox[3]) / tileM)), r1 = Math.floor((tiff.originY - bbox[1]) / (tiff.tileHeight * tiff.pixelY));
    const want: number[] = [];
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) { const t = r * across + c; if (t < tiff.offsets.length) want.push(t); }
    await Promise.all(want.map(async t => {
      const key = `${kind}-${sheet}-${t}`;
      if (!tiles.has(key)) tiles.set(key, rangeBytes(ahn5Url(kind, sheet), tiff.offsets[t], tiff.byteCounts[t], path.join(AHN5_CACHE, `${key}.bin`)).then(b => tiff.decodeTile(b)));
      got.set(t, await tiles.get(key)!);
    }));
    parts.push({ tiff, got });
  }
  return (x, y) => {
    for (const { tiff, got } of parts) {
      const col = Math.floor((x - tiff.originX) / tiff.pixelX), row = Math.floor((tiff.originY - y) / tiff.pixelY);
      if (col < 0 || row < 0 || col >= tiff.width || row >= tiff.height) continue;
      const tile = got.get(Math.floor(row / tiff.tileHeight) * Math.ceil(tiff.width / tiff.tileWidth) + Math.floor(col / tiff.tileWidth));
      if (tile) return tile[(row % tiff.tileHeight) * tiff.tileWidth + (col % tiff.tileWidth)];
    }
    return NaN;
  };
}

/** The DSM cells inside the footprint (RD metres, NAP) and the DTM ground around it, in a 6 m pad; AHN4 unless `source` is 'ahn5'. */
export async function ahnCellsForRings(rings: readonly Ring[], source: 'ahn4' | 'ahn5' = 'ahn4'): Promise<{ roof: [number, number, number][]; ground: number[] }> {
  const rd = rings.map(r => r.map(p => { const q = lngLatToRd([p[0], p[1]]); return [q.x, q.y] as [number, number]; }));
  const xs = rd.flat().map(p => p[0]), ys = rd.flat().map(p => p[1]), pad = 6;
  const bbox = [Math.floor(Math.min(...xs) - pad), Math.floor(Math.min(...ys) - pad), Math.ceil(Math.max(...xs) + pad), Math.ceil(Math.max(...ys) + pad)];
  const [dsmAt, dtmAt]: Sampler[] = source === 'ahn5'
    ? await Promise.all([ahn5Sampler('dsm', bbox), ahn5Sampler('dtm', bbox)])
    : (await Promise.all([raster('dsm_05m', bbox), raster('dtm_05m', bbox)])).map(r => (x: number, y: number) => sample(r, x, y));
  const roof: [number, number, number][] = [], ground: number[] = [];
  // Roof: cell centres inside the footprint, 0.5 m in from the walls is not needed at p70. Ground: DTM in the padded box.
  for (let x = bbox[0] + 0.25; x < bbox[2]; x += 0.5) for (let y = bbox[1] + 0.25; y < bbox[3]; y += 0.5) {
    const inside = rd.some(r => pointInRing([x, y], r as unknown as Ring));
    if (inside) roof.push([x, y, dsmAt(x, y)]); else ground.push(dtmAt(x, y));
  }
  return { roof, ground };
}

/** p70 roof (and eaves/ridge) over the median ground around the footprint; null when AHN has too few samples. */
export async function ahnForRings(rings: readonly Ring[], source: 'ahn4' | 'ahn5' = 'ahn4'): Promise<AhnHeights | null> {
  const { roof, ground } = await ahnCellsForRings(rings, source);
  return ahnHeights(roof.map(c => c[2]), ground);
}

// ---- the BAG pand under a footprint (PDOK BAG WFS, CC0) --------------------------------------------------------
const BAG_CACHE = path.join(ROOT, '.cache/bag-wfs');
export interface BagPandFacts { identificatie: string; bouwjaar?: number; status?: string }
/** The BAG pand under a point inside the footprint, or null; cached in .cache/bag-wfs/ by point. */
export async function bagPandUnder(rings: readonly Ring[]): Promise<BagPandFacts | null> {
  const rd = rings.map(r => r.map(p => { const q = lngLatToRd([p[0], p[1]]); return [q.x, q.y] as [number, number]; }));
  // A point inside the outer ring: the box centre if it is inside, else the first inside cell of a 1 m scan.
  const xs = rd[0].map(p => p[0]), ys = rd[0].map(p => p[1]);
  let at: [number, number] | null = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
  if (!pointInRing(at, rd[0] as unknown as Ring)) {
    at = null;
    for (let x = Math.min(...xs) + 0.5; x < Math.max(...xs) && !at; x += 1) for (let y = Math.min(...ys) + 0.5; y < Math.max(...ys) && !at; y += 1) if (pointInRing([x, y], rd[0] as unknown as Ring)) at = [x, y];
  }
  if (!at) return null;
  const [x, y] = at.map(v => Math.round(v * 10) / 10);
  const file = path.join(BAG_CACHE, `${x}_${y}.json`);
  if (!fs.existsSync(file)) {
    const filter = `<Filter xmlns="http://www.opengis.net/fes/2.0" xmlns:gml="http://www.opengis.net/gml/3.2"><Intersects><ValueReference>geom</ValueReference><gml:Point gml:id="p" srsName="urn:ogc:def:crs:EPSG::28992"><gml:pos>${x} ${y}</gml:pos></gml:Point></Intersects></Filter>`;
    const url = 'https://service.pdok.nl/lv/bag/wfs/v2_0?' + new URLSearchParams({ service: 'WFS', version: '2.0.0', request: 'GetFeature', typeNames: 'bag:pand', outputFormat: 'application/json', srsName: 'EPSG:28992', filter });
    const res = await fetchRetry(url, r => (r.headers.get('content-type') ?? '').includes('json'));
    const features = ((await res.json()) as { features: { properties: BagPandFacts }[] }).features.map(f => ({ identificatie: f.properties.identificatie, bouwjaar: f.properties.bouwjaar, status: f.properties.status }));
    fs.mkdirSync(BAG_CACHE, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(features));
  }
  const found = JSON.parse(fs.readFileSync(file, 'utf8')) as BagPandFacts[];
  return found[0] ?? null;
}
