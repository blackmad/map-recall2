/**
 * Buurt generator round 9: the roof form each drawn pand shows the street, from the AHN4 0.5 m DSM and DTM (PDOK WCS,
 * CC0, 200 m tiles cached in .cache/bag-gaps-ahn).
 * For every member of the district's staged rows (artifacts/buurt-generators/<district>/rows.json, fronts.json):
 * the DSM cells inside its BAG ring in its front's frame, over the DTM ground around it, then measure.ts roofFormOf.
 * Each row's hips are read the same way over the union of its members. Writes the `roofs` and `rowRoofs` keys of
 * src/canalRecall/buurtGenerator/districts/measured/<district>.json (other keys kept).
 *
 *   node --import tsx scripts/buurt-generators/measure-roofs.ts --district=apollo-stadion [--only=<row id prefix>,...] [--max-mb=200] [--refresh]
 */
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { lngLatToRd } from '../../src/canalRecall/facade/rdNew.ts';
import path from 'node:path';
import zlib from 'node:zlib';
import { createHash } from 'node:crypto';
import { readGeoTiff, type Raster } from '../../src/canalRecall/ownGround/geotiff.ts';
import { pointInRing, type Ring } from '../../src/canalRecall/landmarks/osmUnderModels.ts';
import { roofFormOf, type RoofCell, type RoofForm } from '../../src/canalRecall/buurtGenerator/measure.ts';
import { districtPands, loadLibrary } from './generate.ts';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const district = arg('district') ?? 'rivierenbuurt', stage = `artifacts/buurt-generators/${district}`;
const only = (arg('only') ?? '').split(',').filter(Boolean);
const MAX_MB = Number(arg('max-mb') ?? 200);
const OUT = `src/canalRecall/buurtGenerator/districts/measured/${district}.json`;
const freeGb = () => { try { return Number(execSync("df -k / | tail -1 | awk '{print $4}'").toString().trim()) / 1048576; } catch { return 99; } };

const rows = (JSON.parse(fs.readFileSync(`${stage}/rows.json`, 'utf8')).rows as any[]).filter(r => !only.length || only.some(o => r.id.startsWith(o)));
const fronts = JSON.parse(fs.readFileSync(`${stage}/fronts.json`, 'utf8')).fronts as Record<string, { a: [number, number]; b: [number, number] }>;
const rings = new Map(districtPands(loadLibrary(district)).map(p => [p.id.replace(/^NL\.IMBAG\.Pand\./, ''), p.ring]));
const prior = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
/** --refresh: re-read every pand (the AHN tiles stay cached), e.g. after a roofFormOf change. */
const keep = !process.argv.includes('--refresh');
const roofs: Record<string, Omit<RoofForm, 'cells'> & { cells: number }> = { ...(keep ? prior.roofs ?? {} : {}) }, rowRoofs: Record<string, { hipped: RoofForm['hipped']; form: string }> = { ...(keep ? prior.rowRoofs ?? {} : {}) };

// AHN4 0.5 m DSM and DTM (2020, CC0) from the PDOK WCS in 200 m tiles on a fixed grid, cached in .cache/bag-gaps-ahn by
// request URL (scripts/lib/ahnFootprint.ts's cache). Its AHN5 tile reader decodes these sheets as vertical stripes (the
// Sportstraat block read as 0.4-18.8 m bands on 2026-11-15), so round 9 stays on AHN4.
const WCS = 'https://service.pdok.nl/rws/ahn/wcs/v1_0', TILE = 200, AHN_CACHE = '.cache/bag-gaps-ahn';
let fetchedBytes = 0;
const rasters = new Map<string, Promise<Raster>>();
function tile(coverage: 'dsm_05m' | 'dtm_05m', tx: number, ty: number): Promise<Raster> {
  const key = `${coverage}:${tx}:${ty}`;
  if (!rasters.has(key)) rasters.set(key, (async () => {
    const bbox = [tx * TILE, ty * TILE, (tx + 1) * TILE, (ty + 1) * TILE];
    const url = `${WCS}?` + new URLSearchParams({ SERVICE: 'WCS', VERSION: '1.0.0', REQUEST: 'GetCoverage', COVERAGE: coverage, CRS: 'EPSG:28992', BBOX: bbox.join(','), RESX: '0.5', RESY: '0.5', FORMAT: 'GEOTIFF' });
    const file = path.join(AHN_CACHE, `${createHash('sha1').update(url).digest('hex')}.tif`);
    if (!fs.existsSync(file)) {
      for (let attempt = 0; ; attempt++) {
        try {
          const r = await fetch(url, { headers: { 'User-Agent': 'MapRecall/1.0 (+https://github.com/blackmad/map-recall2)' }, signal: AbortSignal.timeout(90_000) });
          if (r.ok && (r.headers.get('content-type') ?? '').includes('tiff')) { const b = Buffer.from(await r.arrayBuffer()); fetchedBytes += b.length; fs.mkdirSync(AHN_CACHE, { recursive: true }); fs.writeFileSync(file, b); break; }
          if (attempt >= 4) throw new Error(`HTTP ${r.status} ${url}`);
        } catch (e) { if (attempt >= 4) throw e; }
        await new Promise(res => setTimeout(res, 1500 * (attempt + 1)));
      }
    }
    return readGeoTiff(fs.readFileSync(file), b => zlib.inflateSync(b));
  })());
  return rasters.get(key)!;
}
async function sampleAt(coverage: 'dsm_05m' | 'dtm_05m', x: number, y: number): Promise<number> {
  const r = await tile(coverage, Math.floor(x / TILE), Math.floor(y / TILE));
  const col = Math.floor((x - r.originX) / r.pixelX), row = Math.floor((r.originY - y) / Math.abs(r.pixelY));
  if (col < 0 || row < 0 || col >= r.width || row >= r.height) return NaN;
  const v = r.data[row * r.width + col]; return v > 1e30 || v < -1000 ? NaN : v;
}
async function ahnCellsForRings(rs: readonly Ring[]): Promise<{ roof: [number, number, number][]; ground: number[] }> {
  const rd = rs.map(r => r.map(p => { const q = lngLatToRd([p[0], p[1]]); return [q.x, q.y] as [number, number]; }));
  const xs = rd.flat().map(p => p[0]), ys = rd.flat().map(p => p[1]), pad = 6;
  const bbox = [Math.floor(Math.min(...xs) - pad), Math.floor(Math.min(...ys) - pad), Math.ceil(Math.max(...xs) + pad), Math.ceil(Math.max(...ys) + pad)];
  const roof: [number, number, number][] = [], ground: number[] = [];
  for (let x = bbox[0] + 0.25; x < bbox[2]; x += 0.5) for (let y = bbox[1] + 0.25; y < bbox[3]; y += 0.5) {
    if (rd.some(r => pointInRing([x, y], r as unknown as Ring))) roof.push([x, y, await sampleAt('dsm_05m', x, y)]); else ground.push(await sampleAt('dtm_05m', x, y));
  }
  return { roof, ground };
}

/** Cells of the rings in the frame of the line a→b (t along it, n back from it, h over the median ground). */
async function cellsFor(rs: (readonly (readonly [number, number])[])[], a: [number, number], b: [number, number]): Promise<{ cells: RoofCell[]; len: number }> {
  const A = lngLatToRd(a), B = lngLatToRd(b), len = Math.hypot(B.x - A.x, B.y - A.y), ux = (B.x - A.x) / len, uy = (B.y - A.y) / len;
  const { roof, ground } = await ahnCellsForRings(rs as any);
  const g = ground.filter(Number.isFinite).sort((p, q) => p - q), g0 = g.length ? g[g.length >> 1] : 0;
  // Into the block: the front's street side is its left-hand normal (sheet.ts: the wall normal (uy, -ux) faces the camera).
  const cells = roof.map(([x, y, z]) => ({ t: (x - A.x) * ux + (y - A.y) * uy, n: -((x - A.x) * uy - (y - A.y) * ux), h: z - g0 }));
  // A front line whose block lies on the other side reads negative depths: flip it.
  const neg = cells.filter(c => c.n < 0).length > cells.length / 2;
  return { cells: neg ? cells.map(c => ({ ...c, n: -c.n })) : cells, len };
}

let done = 0;
for (const r of rows) {
  if (freeGb() < 15) { console.log('under 15 GB free: stopping'); break; }
  if (fetchedBytes / 1048576 > MAX_MB) { console.log(`${MAX_MB} MB of AHN fetched: stopping`); break; }
  for (const m of r.members) {
    if (roofs[m.pandId]) continue;
    const ring = rings.get(m.pandId), f = fronts[m.pandId];
    if (!ring || !f) continue;
    const { cells, len } = await cellsFor([ring], f.a, f.b);
    const { cells: n, ...rest } = roofFormOf(cells, len, { start: false, end: false });
    roofs[m.pandId] = { ...rest, cells: n };
  }
  if (!rowRoofs[r.id] && r.members.length >= 2) {
    const ids: string[] = r.members.map((m: any) => m.pandId), f0 = fronts[ids[0]], f1 = fronts[ids[ids.length - 1]];
    const rs = ids.map(id => rings.get(id)).filter(Boolean) as (readonly (readonly [number, number])[])[];
    if (f0 && f1 && rs.length === ids.length) {
      const { cells, len } = await cellsFor(rs, f0.a, f1.b), rf = roofFormOf(cells, len);
      rowRoofs[r.id] = { form: rf.form, hipped: rf.hipped };
    }
  }
  if (++done % 25 === 0) console.log(`${done}/${rows.length} rows, ${Object.keys(roofs).length} pands, ${(fetchedBytes / 1048576).toFixed(0)} MB AHN fetched`);
}
const now = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {}; // merge-on-write: measure-walls.ts writes the other keys
const out = { ...now, version: 1, district, roofSource: 'AHN4 DSM/DTM 0.5 m (PDOK WCS, CC0) via scripts/buurt-generators/measure-roofs.ts', roofs, rowRoofs };
fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
const forms = new Map<string, number>(); for (const v of Object.values(roofs)) forms.set(v.form, (forms.get(v.form) ?? 0) + 1);
console.log(`${Object.keys(roofs).length} pands: ${[...forms].map(([k, v]) => `${k} ${v}`).join(', ')}; ${Object.values(rowRoofs).filter(x => x.hipped.start || x.hipped.end).length} rows with a hipped end; AHN fetched ${(fetchedBytes / 1048576).toFixed(1)} MB -> ${OUT}`);
