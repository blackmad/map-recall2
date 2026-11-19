/**
 * AHN front heights for design-unit members (phase 1): for each member of a multi-pand unit in the chosen layers, the
 * AHN4 DSM cells within FRONT_BAND_M of its street front (the join's slice `line`) inside its footprint, over the median
 * DTM ground around its unit (beltLook/ahnFront.ts frontBandHeights; the belt look's reader, scripts/belt-look/ahn-fronts.ts).
 * This, not 3DBAG's per-pand eaves, decides where a unit splits into segments (segments.ts).
 *
 *   node --import tsx scripts/design-units/ahn-fronts.ts [--layers=ring] [--also=<pand,...>] [--jobs=6] [--limit=<units>]
 *
 * Reads artifacts/design-units/staging/design-units.json; writes artifacts/design-units/staging/ahn-fronts.json
 * (resumable: pands already measured are skipped). Rasters cache in .cache/bag-gaps-ahn (scripts/lib/ahnFootprint.ts).
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { ahnCellsForRings } from '../lib/ahnFootprint.ts';
import { lngLatToRd } from '../../src/canalRecall/facade/rdNew.ts';
import { pointInRing, type Ring } from '../../src/canalRecall/landmarks/osmUnderModels.ts';
import { frontBandHeights, type AhnFront } from '../../src/canalRecall/beltLook/ahnFront.ts';
import type { DesignUnit } from '../../src/canalRecall/designUnits/types.ts';

const ROOT = path.resolve(import.meta.dirname, '../..');
const STAGING = path.join(ROOT, 'artifacts/design-units/staging');
const OUT = path.join(STAGING, 'ahn-fronts.json');
const arg = (k: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const layers = new Set((arg('layers') ?? 'ring').split(','));
const also = new Set((arg('also') ?? '').split(',').filter(Boolean));
const jobs = Number(arg('jobs') ?? 6), limit = Number(arg('limit') ?? 1e9);
// --roof: (re)measure every member's roof mass too (p90 of all DSM cells in the footprint over the median ground), even when
// its front is already measured.
const roofPass = process.argv.includes('--roof');

const units = (JSON.parse(fs.readFileSync(path.join(STAGING, 'design-units.json'), 'utf8')).units as DesignUnit[])
  .filter(u => u.members.length > 1 && ((u.object && layers.has(u.object.key.split(':')[0])) || u.members.some(m => also.has(m))))
  .slice(0, limit);
const want = new Set(units.flatMap(u => u.members));
const rings = new Map<string, [number, number][]>();
const TILES = path.join(ROOT, 'public/data/extracts/amsterdam/bag-tiles/14');
for (const x of fs.readdirSync(TILES).filter(n => /^\d+$/.test(n))) for (const f of fs.readdirSync(path.join(TILES, x)).filter(n => n.endsWith('.geojson.gz'))) {
  for (const ft of JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(TILES, x, f))).toString('utf8')).features) {
    const id = String(ft.properties?.id ?? '').replace(/^NL\.IMBAG\.Pand\./, '');
    if (!want.has(id) || rings.has(id) || !ft.geometry) continue;
    rings.set(id, ft.geometry.type === 'Polygon' ? ft.geometry.coordinates[0] : ft.geometry.coordinates[0][0]);
  }
}
const prior: Record<string, AhnFront | null> = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')).fronts ?? {} : {};
const res: Record<string, (AhnFront & { roofP90?: number; riseM?: number }) | null> = { ...prior };
let done = 0, failed = 0;
const save = () => { fs.mkdirSync(STAGING, { recursive: true }); fs.writeFileSync(OUT, JSON.stringify({ source: 'AHN4 dsm_05m/dtm_05m (PDOK WCS, CC0)', bandM: 1.5, fronts: res })); };
async function one(u: DesignUnit) {
  const lines = new Map<string, [readonly [number, number], readonly [number, number]]>();
  for (const f of u.faces) for (const s of f.slices) if (s.line && !lines.has(s.pandId)) lines.set(s.pandId, s.line);
  const ids = u.members.filter(id => rings.has(id) && lines.has(id) && (!(id in res) || (roofPass && res[id] && res[id]!.riseM === undefined)));
  if (!ids.length) return;
  try {
    const { roof, ground } = await ahnCellsForRings(u.members.filter(id => rings.has(id)).map(id => rings.get(id)! as unknown as Ring), 'ahn4');
    for (const id of ids) {
      const ring = rings.get(id)!.map(p => { const q = lngLatToRd([p[0], p[1]]); return [q.x, q.y]; }) as unknown as Ring;
      const cells = roof.filter(c => pointInRing([c[0], c[1]], ring));
      const [a, b] = lines.get(id)!, A = lngLatToRd([a[0], a[1]]), B = lngLatToRd([b[0], b[1]]);
      const front = frontBandHeights(cells, ground, [A.x, A.y], [B.x, B.y]);
      const g = [...ground].sort((x, y) => x - y)[Math.floor(ground.length / 2)];
      const zs = cells.map(c => c[2] - g).sort((x, y) => x - y);
      // The roof mass over the front line, ground-free: p90 of every DSM cell in the footprint minus p90 of the cells within
      // 1.5 m of the front line (absolute heights both; dense blocks have no DTM pad to stand on).
      const ux = B.x - A.x, uy = B.y - A.y, L2 = ux * ux + uy * uy || 1;
      const band = cells.filter(c => { const t = Math.max(0, Math.min(1, ((c[0] - A.x) * ux + (c[1] - A.y) * uy) / L2)); return Math.hypot(c[0] - A.x - t * ux, c[1] - A.y - t * uy) <= 1.5; }).map(c => c[2]).sort((x, y) => x - y);
      const all = cells.map(c => c[2]).sort((x, y) => x - y);
      const riseM = band.length >= 3 && all.length ? +(all[Math.floor(all.length * 0.9)] - band[Math.floor(band.length * 0.9)]).toFixed(2) : undefined;
      res[id] = front ? { ...front, ...(zs.length && Number.isFinite(g) ? { roofP90: +zs[Math.floor(zs.length * 0.9)].toFixed(2) } : {}), ...(riseM !== undefined ? { riseM } : {}) } : front;
    }
  } catch (e) { failed++; console.error(u.id, String(e).slice(0, 160)); }
  if (++done % 100 === 0) { console.error(`${done}/${units.length} units`); save(); }
}
const queue = [...units];
await Promise.all(Array.from({ length: jobs }, async () => { for (let u = queue.shift(); u; u = queue.shift()) await one(u); }));
save();
const all = [...want];
console.log(JSON.stringify({ out: path.relative(ROOT, OUT), units: units.length, pands: all.length, measured: all.filter(id => res[id]).length, unread: all.filter(id => id in res && !res[id]).length, failedUnits: failed }));
