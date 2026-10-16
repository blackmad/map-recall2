/**
 * Survey register gaps (src/canalRecall/bagGaps.ts): BAG pands that stand but that
 * the city tiles do not draw, and stage the tile features that fill them.
 *
 *   1. BAG pands from the PDOK BAG WFS (open data, CC0) per z16 cell of every z14
 *      tile in bag-tiles/index-z14.json; raw responses cached in .cache/bag-wfs/.
 *   2. Gaps: standing, not in the tiles by id, < 50% under tile features.
 *   3. Placed models: a gap >= 50% under a drawn model's footprint is "modelled"
 *      (the model draws it), not a hole.
 *   4. Heights (--heights): AHN dsm_05m / dtm_05m from the PDOK AHN WCS (CC0),
 *      cached in .cache/bag-gaps-ahn/; p70 roof minus the median ground around it.
 *
 * Writes (staging only; publish-bag-gaps.ts appends to the tiles after review):
 *   scripts/data/bag-gaps/bag-gaps.json                report (holes >= 10 m2 listed; smaller only counted)
 *   scripts/data/bag-gaps/bag-gaps-supplement.geojson  fill features (tracked, reviewable before publish)
 *
 * Usage: node --max-old-space-size=8192 --import tsx scripts/survey-bag-gaps.ts [--heights] [--limit=N] [--tile=14/x/y]
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { createHash } from 'node:crypto';
import { tileBounds } from '../src/canalRecall/slippyTiles';
import { BAG3D_VERSION } from '../src/canalRecall/bag3dTiles';
import { readTileIndex } from '../src/canalRecall/bag3dTileIndex';
import { lngLatToRd } from '../src/canalRecall/facade/rdNew';
import { readGeoTiff, type Raster } from '../src/canalRecall/ownGround/geotiff';
import { pointInRing, ringBounds, type LngLat, type Ring, type TileBuilding } from '../src/canalRecall/landmarks/osmUnderModels';
import { ahnHeights, coveredShare, fillDecision, findBagGaps, supplementFeature, type BagGap, type RegisterPand, type SupplementFeature } from '../src/canalRecall/bagGaps';

const ROOT = path.resolve(import.meta.dirname, '..');
const flag = (name: string) => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const withHeights = process.argv.includes('--heights');
const limit = Number(flag('limit') ?? Infinity), onlyTile = flag('tile');
const TILES = path.join(ROOT, 'public/data/extracts/amsterdam/bag-tiles');
const STAGING = path.join(ROOT, 'scripts/data/bag-gaps');
const WFS_CACHE = path.join(ROOT, '.cache/bag-wfs'), AHN_CACHE = path.join(ROOT, '.cache/bag-gaps-ahn');
const WFS = 'https://service.pdok.nl/lv/bag/wfs/v2_0', WCS = 'https://service.pdok.nl/rws/ahn/wcs/v1_0';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
async function fetchRetry(url: string, accept: (r: Response) => boolean): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    try { const r = await fetch(url, { signal: AbortSignal.timeout(90_000) }); if (r.ok && accept(r)) return r; if (attempt >= 5) throw new Error(`HTTP ${r.status} ${url}`); }
    catch (e) { if (attempt >= 5) throw e; }
    await sleep(1500 * (attempt + 1));
  }
}
async function pool<T, R>(items: T[], n: number, fn: (t: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length); let next = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); } }));
  return out;
}

// ---- register (BAG WFS) ----------------------------------------------------------------------------------------
type WfsFeature = { properties: { identificatie: string; status: string; bouwjaar?: number }; geometry: { type: string; coordinates: unknown } };
const ringsOf = (g: { type: string; coordinates: unknown } | null | undefined): Ring[] =>
  !g ? [] : g.type === 'Polygon' ? [(g.coordinates as LngLat[][])[0]] : g.type === 'MultiPolygon' ? (g.coordinates as LngLat[][][]).map(p => p[0]) : [];
async function registerCell(z: number, x: number, y: number): Promise<WfsFeature[]> {
  const file = path.join(WFS_CACHE, `${z}-${x}-${y}.json.gz`);
  if (fs.existsSync(file)) return JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString());
  const [w, s, e, n] = tileBounds({ z, x, y }), out: WfsFeature[] = [];
  for (let start = 0; ; start += 1000) {
    const url = `${WFS}?` + new URLSearchParams({ service: 'WFS', version: '2.0.0', request: 'GetFeature', typeName: 'bag:pand', outputFormat: 'application/json', srsName: 'EPSG:4326', count: '1000', startIndex: String(start), sortBy: 'identificatie', bbox: `${s},${w},${n},${e},urn:ogc:def:crs:EPSG::4326` });
    const page = (await (await fetchRetry(url, r => (r.headers.get('content-type') ?? '').includes('json'))).json()) as { features: WfsFeature[] };
    out.push(...page.features);
    if (page.features.length < 1000) break;
  }
  fs.mkdirSync(WFS_CACHE, { recursive: true });
  fs.writeFileSync(file, zlib.gzipSync(JSON.stringify(out)));
  return out;
}

// ---- tiles -----------------------------------------------------------------------------------------------------
const index = JSON.parse(fs.readFileSync(path.join(TILES, 'index-z14.json'), 'utf8')) as { tileList: string[] };
const tileKeys = index.tileList.filter(k => !onlyTile || k === onlyTile).slice(0, limit);
const tileIds = new Set<string>();
const grid = new Map<string, TileBuilding[]>(); // 0.001 deg cells
const CELL = 0.001;
for (const key of index.tileList) {
  const fc = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(TILES, `${key}.geojson.gz`))).toString()) as { features: { properties: { id?: string; pand?: string }; geometry: { type: string; coordinates: unknown } }[] };
  for (const f of fc.features) {
    const id = String(f.properties.id ?? f.properties.pand ?? ''); if (id) tileIds.add(id);
    const rings = ringsOf(f.geometry); if (!rings.length) continue;
    const b: TileBuilding = { id, height: undefined, rings };
    const bb = rings.map(ringBounds), w = Math.min(...bb.map(q => q.w)), e = Math.max(...bb.map(q => q.e)), s = Math.min(...bb.map(q => q.s)), n = Math.max(...bb.map(q => q.n));
    for (let x = Math.floor(w / CELL); x <= Math.floor(e / CELL); x++) for (let y = Math.floor(s / CELL); y <= Math.floor(n / CELL); y++) {
      const k = `${x},${y}`; const list = grid.get(k); if (list) list.push(b); else grid.set(k, [b]);
    }
  }
}
const tilesNear = (rings: readonly Ring[]): TileBuilding[] => {
  const seen = new Set<TileBuilding>();
  for (const r of rings) { const b = ringBounds(r); for (let x = Math.floor(b.w / CELL); x <= Math.floor(b.e / CELL); x++) for (let y = Math.floor(b.s / CELL); y <= Math.floor(b.n / CELL); y++) for (const t of grid.get(`${x},${y}`) ?? []) seen.add(t); }
  return [...seen];
};

// ---- survey ----------------------------------------------------------------------------------------------------
const cells = tileKeys.flatMap(k => { const [, x, y] = k.split('/').map(Number); const out: [number, number, number][] = []; for (let dx = 0; dx < 4; dx++) for (let dy = 0; dy < 4; dy++) out.push([16, x * 4 + dx, y * 4 + dy]); return out; });
const pands = new Map<string, RegisterPand>();
let done = 0;
await pool(cells, 6, async ([z, x, y]) => {
  for (const f of await registerCell(z, x, y)) {
    if (pands.has(f.properties.identificatie)) continue;
    pands.set(f.properties.identificatie, { id: f.properties.identificatie, status: f.properties.status, year: f.properties.bouwjaar ?? null, rings: ringsOf(f.geometry) });
  }
  if (++done % 200 === 0) console.log(`register cells ${done}/${cells.length}, ${pands.size} pands`);
});
// Only pands whose centre lies in a surveyed tile (the tiles stop at the drivable area).
// Only pands inside a z14 tile we surveyed AND inside a 3DBAG tile the city was built from
// (the z14 tiles reach past the drivable area; a pand out there is a place nobody built, not a gap).
const BAG3D_CACHE = path.join(ROOT, '.cache/3dbag', BAG3D_VERSION);
const cachedTiles = new Set(fs.readdirSync(path.join(BAG3D_CACHE, 'tiles')).map(f => f.replace('.city.json.gz', '')));
const builtFrom = readTileIndex(fs.readFileSync(path.join(BAG3D_CACHE, 'tile_index.fgb'))).filter(t => cachedTiles.has(t.tileId.replace(/\//g, '-')));
const inSurvey = (c: LngLat) => {
  const { x, y } = lngLatToRd([c[0], c[1]]);
  return builtFrom.some(t => x >= t.bbox[0] && x < t.bbox[2] && y >= t.bbox[1] && y < t.bbox[3])
    && tileKeys.some(k => { const [z, tx, ty] = k.split('/').map(Number); const [w, s, e, n] = tileBounds({ z, x: tx, y: ty }); return c[0] >= w && c[0] < e && c[1] >= s && c[1] < n; });
};
console.log(`3DBAG ${BAG3D_VERSION}: built from ${builtFrom.length} cached tiles`);
const gaps = findBagGaps(pands.values(), tileIds, tilesNear).filter(g => inSurvey(g.centre));
console.log(`register: ${pands.size} pands in ${cells.length} z16 cells; ${gaps.length} gaps`);

// ---- placed models ---------------------------------------------------------------------------------------------
const { allSpecs, footprintOf } = await import('./lib/placedFootprints');
const modelled = new Map<string, string>();
{
  const suppressed = new Map<string, string>();
  const specs = allSpecs().filter(s => (s as { status?: string }).status !== 'held');
  for (const s of specs) for (const id of s.suppressOsmIds) suppressed.set(String(id), s.id);
  for (const g of gaps) if (suppressed.has(g.id)) modelled.set(g.id, suppressed.get(g.id)!);
  const near = (c: LngLat, m: LngLat) => Math.abs(c[0] - m[0]) < 0.003 && Math.abs(c[1] - m[1]) < 0.002;
  for (const s of specs) {
    const centre = (s.surveyed?.anchor ?? s.footprint?.centre) as LngLat | undefined;
    if (!centre) continue;
    const cand = gaps.filter(g => !modelled.has(g.id) && near(g.centre, centre));
    if (!cand.length) continue;
    const { fp } = await footprintOf(s);
    if (!fp) continue;
    for (const g of cand) {
      const share = coveredShare(pands.get(g.id.replace('NL.IMBAG.Pand.', ''))!.rings, fp);
      if (share >= 0.5) modelled.set(g.id, s.id);
      else if (share > (g.modelCover ?? 0)) g.modelCover = Math.round(share * 1000) / 1000;
    }
  }
}
const holes = gaps.filter(g => !modelled.has(g.id));

// ---- heights (AHN) ---------------------------------------------------------------------------------------------
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
const supplement: SupplementFeature[] = [];
const decisions: Record<string, number> = {};
const reviewList: unknown[] = [];
const heightOf = new Map<string, ReturnType<typeof ahnHeights>>();
if (withHeights) {
  const fill = holes.filter(g => g.areaM2 >= 10);
  decisions['too-small'] = holes.length - fill.length;
  await pool(fill, 4, async g => {
    const rings = pands.get(g.id.replace('NL.IMBAG.Pand.', ''))!.rings;
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
    const h = ahnHeights(roof, ground);
    heightOf.set(g.id, h);
    const why = fillDecision(g, h);
    decisions[why] = (decisions[why] ?? 0) + 1;
    if (why !== 'fill' && why !== 'too-small') reviewList.push({ id: g.id, why, year: g.year, areaM2: g.areaM2, centre: g.centre, ...(h ? { height: h.height } : {}) });
    const f = supplementFeature(g, rings, h);
    if (f) supplement.push(f);
  });
  supplement.sort((a, b) => a.properties.id.localeCompare(b.properties.id));
}

// ---- report ----------------------------------------------------------------------------------------------------
const bucket = (a: number) => a < 10 ? '<10' : a < 50 ? '10-50' : a < 200 ? '50-200' : a < 1000 ? '200-1000' : '>=1000';
const byArea: Record<string, number> = {};
for (const g of holes) byArea[bucket(g.areaM2)] = (byArea[bucket(g.areaM2)] ?? 0) + 1;
const row = (g: BagGap) => ({ ...g, centre: g.centre.map(v => Math.round(v * 1e6) / 1e6), ...(modelled.has(g.id) ? { modelledBy: modelled.get(g.id) } : {}), ...(heightOf.has(g.id) ? { ahn: heightOf.get(g.id) } : {}) });
const report = {
  generatedAt: new Date().toISOString().slice(0, 10),
  sources: { register: `${WFS} (BAG pand, Kadaster, CC0)`, heights: withHeights ? `${WCS} (AHN dsm_05m/dtm_05m, CC0)` : null, tiles: 'public/data/extracts/amsterdam/bag-tiles/14' },
  tiles: tileKeys.length, registerPands: pands.size, gaps: gaps.length, modelled: modelled.size, holes: holes.length,
  holesAreaM2: Math.round(holes.reduce((a, g) => a + g.areaM2, 0)), holesByArea: byArea,
  filled: supplement.length, fillDecisions: decisions, filledAreaM2: Math.round(supplement.reduce((a, f) => a + (holes.find(g => g.id === f.properties.id)?.areaM2 ?? 0), 0)),
  holeList: holes.filter(g => g.areaM2 >= 10).map(row), notFilledForReview: reviewList, modelledList: gaps.filter(g => modelled.has(g.id)).map(row),
};
fs.mkdirSync(STAGING, { recursive: true });
fs.writeFileSync(path.join(STAGING, 'bag-gaps.json'), `${JSON.stringify(report, null, 1)}\n`);
if (withHeights) fs.writeFileSync(path.join(STAGING, 'bag-gaps-supplement.geojson'), `${JSON.stringify({ type: 'FeatureCollection', features: supplement })}\n`);
console.log(JSON.stringify({ ...report, holeList: undefined, modelledList: undefined, notFilledForReview: undefined }));
