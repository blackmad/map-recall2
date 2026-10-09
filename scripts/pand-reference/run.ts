/**
 * Per-pand reference feed for the ordinary-building recipe pipeline.
 *
 *   npx tsx scripts/pand-reference/run.ts --name=marnixstraat --ids=0363100012174914,... [--out=staging/pand-reference] [--ppm=50]
 *   npx tsx scripts/pand-reference/run.ts --name=x --bbox=minLng,minLat,maxLng,maxLat [--limit=40]
 *   npx tsx scripts/pand-reference/run.ts --name=x --street="Bloemgracht" [--limit=40]
 *
 * Writes <out>/<bagId>/{front.jpg,front-alt.jpg,thumb.jpg,reference.json}, <out>/_runs/<name>.json (hit rate)
 * and artifacts/pand-reference/contact-<name>.png. Responses are cached in .cache/pand-reference (<= 3 concurrent).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { selectPands, options as selectOptions, type Selection, type PanoPick } from './select.ts';
import { loadPano, rectifyWall, aimedThumbnail, type Crop } from './rectify.ts';
import { factsFor } from './facts.ts';
import { loadTile, lngLatToRd, loadRoads, nearestOnSeg } from './core.ts';
import { buildContactSheet } from './contact.ts';

const arg = (n: string, d = '') => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const name = arg('name', 'run'), out = path.resolve(arg('out', 'staging/pand-reference')), ppm = Number(arg('ppm', '50'));
const ATTRIBUTION = 'Gemeente Amsterdam, Panoramabeelden (CC BY 4.0; faces and number plates blurred by the publisher)';

async function resolveIds(): Promise<string[]> {
  if (arg('ids')) return arg('ids').split(',').filter(Boolean);
  const limit = Number(arg('limit', '40'));
  const tiles: Array<[number, number]> = [];
  const fs2 = await import('node:fs/promises');
  const root = path.resolve('public/data/extracts/amsterdam/building-tiles/14');
  for (const x of await fs2.readdir(root)) for (const f of await fs2.readdir(path.join(root, x))) tiles.push([Number(x), Number(f.split('.')[0])]);
  let keep: (c: { x: number; y: number }) => boolean;
  if (arg('bbox')) {
    const [a, b, c, d] = arg('bbox').split(',').map(Number), p = lngLatToRd([a, b]), q = lngLatToRd([c, d]);
    keep = ({ x, y }) => x >= Math.min(p.x, q.x) && x <= Math.max(p.x, q.x) && y >= Math.min(p.y, q.y) && y <= Math.max(p.y, q.y);
  } else if (arg('street')) {
    const want = arg('street').toLowerCase(), segs: any[] = [];
    const all = JSON.parse(await fs.readFile('public/data/extracts/amsterdam/streets.json', 'utf8'));
    for (const s of all) if (String(s.name).toLowerCase() === want) for (const p of s.paths ?? [s.path]) for (let i = 0; i + 1 < p.length; i++) segs.push({ a: lngLatToRd([p[i][1], p[i][0]]), b: lngLatToRd([p[i + 1][1], p[i + 1][0]]) });
    if (!segs.length) throw new Error(`street not found in streets.json: ${arg('street')}`);
    keep = c => segs.some(s => nearestOnSeg(c, s).d < 28);
  } else throw new Error('need --ids, --bbox or --street');
  await loadRoads();
  const ids: string[] = [];
  for (const [x, y] of tiles) for (const fp of await loadTile(x, y)) {
    if (!fp.id.startsWith('NL.IMBAG.Pand.')) continue;
    const c = { x: fp.ring.reduce((s, p) => s + p.x, 0) / fp.ring.length, y: fp.ring.reduce((s, p) => s + p.y, 0) / fp.ring.length };
    if (keep(c)) ids.push(fp.id);
  }
  return ids.slice(0, limit);
}

const pickJson = (p: PanoPick | null, crop: Crop | null, resolution?: string) => p && {
  panoId: p.panoId, timestamp: p.timestamp, missionYear: p.missionYear, missionType: p.missionType, surface: p.surface,
  cameraDistM: Math.round(p.distM * 10) / 10, obliquityDeg: Math.round(p.obliquityDeg * 10) / 10, distanceRangeRelaxed: p.relaxed,
  ...(crop ? { washedOut: round(crop.washedOut), crop: { width: crop.width, height: crop.height, pixelsPerMetre: crop.ppm, wallWidthM: round(crop.wallWidthM), wallHeightM: round(crop.wallHeightM), missingFraction: round(crop.missingFraction), groundNapM: round(crop.baseZ), groundSource: crop.groundSource, sourceImage: resolution } } : {}),
};
const round = (v: number) => Math.round(v * 100) / 100;

if (arg('prefer-bearing')) selectOptions.preferBearingDeg = Number(arg('prefer-bearing'));
const ids = await resolveIds();
console.log(`${ids.length} pand(en)`);
const selections = await selectPands(ids);
console.log(`selected: ${selections.filter(s => s.primary).length}/${selections.length} with a primary panorama`);

type Job = { sel: Selection; role: 'front' | 'front-alt'; pick: PanoPick };
const jobs: Job[] = selections.flatMap(sel => [
  ...(sel.primary ? [{ sel, role: 'front' as const, pick: sel.primary }] : []),
  ...(sel.alt ? [{ sel, role: 'front-alt' as const, pick: sel.alt }] : []),
]);
// Group by panorama so each 8000 px image is decoded once.
jobs.sort((a, b) => a.pick.panoId.localeCompare(b.pick.panoId));
const crops = new Map<string, { crop: Crop | null; resolution?: string }>();
const baseZ = new Map<string, number>();
for (const job of [...jobs].sort((a, b) => Number(a.role === 'front-alt') - Number(b.role === 'front-alt') || a.pick.panoId.localeCompare(b.pick.panoId))) { /* primaries first so alt reuses ground */
  const pano = await loadPano(job.pick);
  const key = `${job.sel.pandId}|${job.role}`;
  if (!pano) { crops.set(key, { crop: null }); console.log(`  ${job.sel.pandId} ${job.role}: pano unavailable`); continue; }
  const crop = rectifyWall(pano.img, job.pick, job.sel.wall!, job.sel.footprint.height, ppm, job.role === 'front-alt' ? baseZ.get(job.sel.pandId) : undefined);
  if (crop && job.role === 'front') baseZ.set(job.sel.pandId, crop.baseZ);
  crops.set(key, { crop, resolution: pano.resolution });
}

const records: any[] = [];
for (const sel of selections) {
  const dir = path.join(out, sel.pandId.replace('NL.IMBAG.Pand.', ''));
  const bag = sel.pandId.replace('NL.IMBAG.Pand.', '');
  const rec: any = { schemaVersion: 1, bagPandId: bag, status: 'ok', wallNote: sel.wallNote, panoramaCandidates: sel.candidates };
  const facts = await factsFor(sel.footprint, sel.wall);
  rec.facts = facts;
  if (!sel.wall || !sel.primary) { rec.status = !sel.wall ? 'no-wall' : 'no-panorama'; records.push(rec); await fs.mkdir(dir, { recursive: true }); await fs.writeFile(path.join(dir, 'reference.json'), JSON.stringify(rec, null, 1)); continue; }
  await fs.mkdir(dir, { recursive: true });
  let front = crops.get(`${sel.pandId}|front`)?.crop ?? null, alt = crops.get(`${sel.pandId}|front-alt`)?.crop ?? null;
  let frontRes = crops.get(`${sel.pandId}|front`)?.resolution, altRes = crops.get(`${sel.pandId}|front-alt`)?.resolution;
  // Scaffolding sheeting / overexposure: if the straightest view is washed out and the alternate is not, swap them.
  const occl = (c: Crop) => c.washedOut + c.foliage;
  if (front && alt && occl(front) > 0.3 && occl(alt) < occl(front) - 0.15) {
    [front, alt] = [alt, front]; [frontRes, altRes] = [altRes, frontRes]; [sel.primary, sel.alt] = [sel.alt!, sel.primary!];
    rec.swapped = 'primary was washed out or foliage-covered (scaffolding/overexposure/trees); alternate year promoted';
  }
  if (front && front.washedOut > 0.3) rec.status = 'washed-out';
  else if (front && front.foliage > 0.25) rec.status = 'foliage';
  if (front) await fs.writeFile(path.join(dir, 'front.jpg'), front.jpeg); else rec.status = 'rectify-failed';
  rec.quality = { frontWashedOut: front ? round(front.washedOut) : null, altWashedOut: alt ? round(alt.washedOut) : null, frontFoliage: front ? round(front.foliage) : null, altFoliage: alt ? round(alt.foliage) : null };
  if (alt) await fs.writeFile(path.join(dir, 'front-alt.jpg'), alt.jpeg);
  const thumb = await aimedThumbnail(sel.primary, sel.wall, sel.footprint.height);
  if (thumb) await fs.writeFile(path.join(dir, 'thumb.jpg'), thumb.jpeg);
  const [sLng, sLat] = (await import('./core.ts')).rdToLngLat(sel.wall.a), [eLng, eLat] = (await import('./core.ts')).rdToLngLat(sel.wall.b);
  Object.assign(rec, {
    wall: { startLngLat: [sLng, sLat], endLngLat: [eLng, eLat], lengthM: round(sel.wall.len), outwardBearingDeg: Math.round((Math.atan2(sel.wall.nx, sel.wall.ny) * 180 / Math.PI + 360) % 360), nearestRoadM: Math.round(sel.wall.roadDistM), facingRoad: round(sel.wall.facing), tileHeightM: sel.footprint.height },
    images: { front: front ? 'front.jpg' : null, frontAlt: alt ? 'front-alt.jpg' : null, thumb: thumb ? 'thumb.jpg' : null,
      frontDescription: 'Rectified straight-on elevation; x runs wall start->end (left->right facing the wall), y top->bottom; one pixel = 1/pixelsPerMetre metres; grey = no data (outside the panorama image).' },
    primary: pickJson(sel.primary, front, frontRes),
    alt: pickJson(sel.alt, alt, altRes),
    thumbnail: thumb && { panoId: sel.primary.panoId, url: thumb.url, fovDeg: thumb.fovDeg, headingDeg: thumb.headingDeg },
    otherWalls: (sel.otherWalls ?? []).sort((p, q) => q.len - p.len).slice(0, 4).map(w => ({ lengthM: round(w.len), outwardBearingDeg: Math.round((Math.atan2(w.nx, w.ny) * 180 / Math.PI + 360) % 360), nearestRoadM: Math.round(w.roadDistM), facingRoad: round(w.facing) })),
    attribution: ATTRIBUTION,
  });
  records.push(rec);
  await fs.writeFile(path.join(dir, 'reference.json'), JSON.stringify(rec, null, 1));
}
const summary = {
  name, generatedAt: new Date().toISOString(), total: records.length,
  withFront: records.filter(r => r.images?.front).length, withAlt: records.filter(r => r.images?.frontAlt).length, withThumb: records.filter(r => r.images?.thumb).length,
  status: Object.fromEntries([...new Set(records.map(r => r.status))].map(s => [s, records.filter(r => r.status === s).length])),
};
await fs.mkdir(path.join(out, '_runs'), { recursive: true });
await fs.writeFile(path.join(out, '_runs', `${name}.json`), JSON.stringify({ ...summary, pands: records.map(r => r.bagPandId) }, null, 1));
console.log(JSON.stringify(summary));
await buildContactSheet(name, out, records.map(r => r.bagPandId), arg('order'));
