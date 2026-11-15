/**
 * Shopfront photo samples (lane retail-look round 6): for each OSM node named, its template pand's street wall cut from
 * the nearest facing open-data Amsterdam panorama (data.amsterdam.nl, CC BY 4.0; the house line's pand-reference cache
 * and selection), aimed at the wall's ground storey, written as <out>/<node>-<pano>.jpg with a receipts JSON. Used to
 * spot-check a template rule (bike shop classes) and to sample real fronts for new templates. A node with no template
 * pand is hosted on the footprint it stands in, else the nearest within 8 m (sampling shops no template draws yet). Panoramas this run
 * downloads are purged afterwards; the 15 GB disk floor and --max-mb stop it.
 *   node --import tsx scripts/retail-ground/front-photos.ts --nodes=<id,id> --out=<dir> [--per=1] [--max-mb=60] [--offline]
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { execSync } from 'node:child_process';
import { CACHE_DIR, findPands, http, lngLatToRd, neighbourhood, nearestOnSeg, panoTracker, purgeFiles, type Footprint } from '../pand-reference/core.ts';
import { exposedWalls, listPanos, rankPanos } from '../pand-reference/select.ts';
import { aimPose, frameFor, gridConvergenceDeg, type WallQuad } from '../house-frames/pose.ts';
import { cutPerspective, loadEquirect } from '../house-frames/photo.ts';

http.userAgent = 'MapRecall/1.0 (+https://github.com/blackmad/map-recall2)';
const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
if (process.argv.includes('--offline')) http.offline = true;
const OUT = arg('out')!, PER = Number(arg('per') ?? 1), MAX_MB = Number(arg('max-mb') ?? 60);
const nodes = (arg('nodes') ?? '').split(',').filter(Boolean);
fs.mkdirSync(OUT, { recursive: true });
const freeGb = () => { try { return Number(execSync("df -k / | tail -1 | awk '{print $4}'").toString().trim()) / 1048576; } catch { return 99; } };

const ov = JSON.parse(fs.readFileSync('.cache/retail-ground/overpass.json', 'utf8')) as { elements: Array<{ id: number; lat?: number; lon?: number; tags?: Record<string, string> }> };
const staged = JSON.parse(fs.readFileSync('data/retail-ground/shop-templates.json', 'utf8')) as { templates: string[]; buildings: Record<string, [number, number, number]> };
const byAt = new Map(Object.entries(staged.buildings).map(([id, r]) => [`${r[1]},${r[2]}`, id]));
const want = nodes.map(n => ov.elements.find(e => String(e.id) === n)).filter(Boolean) as Array<{ id: number; lat: number; lon: number; tags?: Record<string, string> }>;
const ids = want.map(e => byAt.get(`${Math.round(e.lon * 1e6) / 1e6},${Math.round(e.lat * 1e6) / 1e6}`)).filter(Boolean) as string[];
const fps = await findPands(ids);
const before = new Set(fs.existsSync(CACHE_DIR) ? fs.readdirSync(CACHE_DIR).filter(f => f.endsWith('.jpg')) : []);
panoTracker.touched = new Set();
const receipts: Record<string, unknown> = {};
for (const e of want) {
  if (freeGb() < 15) { console.log('under 15 GB free: stopping'); break; }
  if (http.bytes > MAX_MB * 1024 ** 2) { console.log(`${MAX_MB} MB downloaded: stopping`); break; }
  const node = lngLatToRd([e.lon, e.lat]);
  let id = byAt.get(`${Math.round(e.lon * 1e6) / 1e6},${Math.round(e.lat * 1e6) / 1e6}`), fp = id ? fps.get(id) : undefined;
  const others: Footprint[] = await neighbourhood(node);
  if (!fp) {
    const ringDist = (f: Footprint) => inside(node, f.ring) ? 0 : Math.min(...f.ring.slice(1).map((p, i) => nearestOnSeg(node, { a: f.ring[i], b: p }).d));
    const best = others.map(f => ({ f, d: ringDist(f) })).sort((a, b) => a.d - b.d)[0];
    if (best && best.d <= 8) { fp = best.f; id = best.f.id; }
  }
  if (!id || !fp) { receipts[e.id] = { skip: 'no pand within 8 m' }; continue; }
  const wall = exposedWalls(fp, others).map(w => ({ w, d: nearestOnSeg(node, { a: w.a, b: w.b }).d })).sort((p, q) => p.d - q.d).find(x => x.d <= 6)?.w;
  if (!wall) { receipts[e.id] = { skip: 'no exposed wall within 6 m' }; continue; }
  let done = 0;
  try {
    for (const pick of rankPanos(wall, await listPanos(wall.mid, 35)).slice(0, 4)) {
      if (done >= PER) break;
      const img = await loadEquirect(pick.record, 'small'); if (!img) continue;
      const ll: [number, number] = [pick.record.geometry.coordinates[0], pick.record.geometry.coordinates[1]], published = Number(pick.record.geometry.coordinates[2]);
      const quad: WallQuad = { a: wall.a, b: wall.b, heightM: 5 };
      const pose = aimPose({ lngLat: ll, cameraNap: published > 0 ? published - 43.5 : null }, quad, { width: 900, height: 560 }), frame = frameFor(pose);
      const cut = cutPerspective(img, frame, gridConvergenceDeg(ll));
      const file = path.join(OUT, `${e.id}-${pick.panoId}.jpg`);
      await sharp(Buffer.from(cut.data), { raw: { width: cut.width, height: cut.height, channels: 3 } }).jpeg({ quality: 85 }).toFile(file);
      receipts[e.id] = { pand: id, name: e.tags?.name ?? '', pano: pick.panoId, date: String(pick.timestamp).slice(0, 10), distM: +pick.distM.toFixed(1), obliquityDeg: +pick.obliquityDeg.toFixed(1), file };
      done++;
    }
  } catch (err) { receipts[e.id] = { skip: (err as Error).message }; }
  const mine = [...panoTracker.touched].filter(f => !before.has(path.basename(f))); panoTracker.touched.clear(); await purgeFiles(mine);
}
function inside(p: { x: number; y: number }, ring: ReadonlyArray<{ x: number; y: number }>): boolean {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) if ((ring[i].y > p.y) !== (ring[j].y > p.y) && p.x < (ring[j].x - ring[i].x) * (p.y - ring[i].y) / (ring[j].y - ring[i].y) + ring[i].x) c = !c;
  return c;
}
fs.writeFileSync(path.join(OUT, 'receipts.json'), JSON.stringify(receipts, null, 1));
console.log(`${Object.keys(receipts).length} fronts -> ${OUT}; ${http.requests} requests, ${(http.bytes / 1048576).toFixed(1)} MB (purged)`);
