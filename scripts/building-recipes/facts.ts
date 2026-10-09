/**
 * Facts step: fetch (and cache) the 3DBAG item for a Pand, derive its frontage
 * from the routing street extract, write facts.json, and fetch one municipal
 * panorama crop per front as the reference photo.
 *
 *   node --import tsx scripts/building-recipes/facts.ts --house=bloemgracht-80 [--pand=0363...] [--street=Bloemgracht] [--refresh] [--no-photo]
 *
 * Without an intent.json, --pand and --street seed a new house directory.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {buildFacts, type BuildingFacts, type CityJsonItem, type RD, type StreetPath} from '../../src/canalRecall/buildingRecipe/facts.ts';
import {lngLatToRd, rdToLngLat} from '../../src/canalRecall/facade/rdNew.ts';
import {perspectiveCrop} from '../street-appearance/perspective.ts';
import {loadIntent} from './compile.ts';

const arg = (name: string) => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
export const HOUSES = 'scripts/building-recipes/houses';
export const ARTIFACTS = 'artifacts/building-recipes';

async function json<T>(file: string): Promise<T | null> {
  try { return JSON.parse(await fs.readFile(file, 'utf8')) as T; } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null; throw e; }
}
async function fetchBytes(url: string): Promise<Buffer> {
  for (let attempt = 0; ; attempt++) {
    const r = await fetch(url);
    if (r.ok) return Buffer.from(await r.arrayBuffer());
    if (attempt >= 2) throw Error(`${r.status} ${url}`);
    await new Promise(res => setTimeout(res, 1000 * (attempt + 1)));
  }
}

let streetCache: StreetPath[] | null = null;
async function streets(): Promise<StreetPath[]> {
  streetCache ??= (JSON.parse(await fs.readFile('public/data/extracts/amsterdam/streets-routing.json', 'utf8')) as any[])
    .map(s => ({name: s.name, paths: s.paths ?? [s.path]}));
  return streetCache;
}
const toRD = (p: [number, number]): RD => { const r = lngLatToRd(p); return [r.x, r.y]; };

export interface PanoramaReference { front: string; panoId: string; timestamp: string; url: string; cameraRD: RD; headingDeg: number; fovDeg: number; pitchDeg: number; distanceM: number; image: string; license: string }

/** Choose the recent municipal panorama that sees the frontage most squarely, and crop it. */
export async function fetchPanorama(id: string, front: BuildingFacts['fronts'][number], frontId: string): Promise<PanoramaReference | null> {
  const [a, b] = front.endpointsRD, mid: RD = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], n = front.outwardNormalRD;
  const [lng, lat] = rdToLngLat({x: mid[0] + n[0] * 12, y: mid[1] + n[1] * 12});
  const listing = JSON.parse((await fetchBytes(`https://api.data.amsterdam.nl/panorama/panoramas/?near=${lng},${lat}&radius=25&page_size=200&timestamp_after=2019-01-01`)).toString());
  const candidates = (listing._embedded?.panoramas ?? []).map((p: any) => {
    const c = toRD(p.geometry.coordinates.slice(0, 2)), d = [c[0] - mid[0], c[1] - mid[1]];
    const depth = d[0] * n[0] + d[1] * n[1], lateral = Math.abs(d[0] * -n[1] + d[1] * n[0]);
    // Leaf-off months matter most on tree-lined canals; then a square view
    // at moderate distance; then recency.
    const month = Number(String(p.timestamp).slice(5, 7)), leafOff = month <= 4 || month >= 11;
    return {p, c, depth, score: lateral + 0.35 * Math.abs(depth - 14) - (leafOff ? 6 : 0) - (p.timestamp > '2023' ? 1 : 0)};
  }).filter((x: any) => x.depth > 4 && x.depth < 40).sort((x: any, y: any) => x.score - y.score);
  for (const best of candidates.slice(0, 4)) {
  const distance = Math.hypot(best.c[0] - mid[0], best.c[1] - mid[1]);
  const heading = (Math.atan2(mid[0] - best.c[0], mid[1] - best.c[1]) * 180 / Math.PI + 360) % 360;
  const height = Math.max(front.topM, 8) + 1.5;
  // Portrait crop: fit the facade height (camera ~2.5 m) and width.
  const pitch = Math.atan((height / 2 - 2.5) / Math.max(distance, 1)) * 180 / Math.PI;
  const fovV = 2 * Math.atan((height / 2 + 1.5) / distance) * 180 / Math.PI, aspect = 0.8;
  const fovH = Math.min(110, Math.max(2 * Math.atan((front.widthM / 2 + 1.5) / distance) * 180 / Math.PI, 2 * Math.atan(Math.tan(fovV * Math.PI / 360) * aspect) * 180 / Math.PI));
  const image = path.join(ARTIFACTS, id, `photo-${frontId}.jpg`);
  let bytes: Buffer;
  try { bytes = await fetchBytes(best.p._links.equirectangular_medium.href); } catch { continue; }
  await fs.mkdir(path.dirname(image), {recursive: true});
  await fs.writeFile(image, perspectiveCrop(bytes, heading, 800, 1000, fovH, pitch));
  return {front: frontId, panoId: best.p.pano_id, timestamp: best.p.timestamp, url: best.p._links.equirectangular_medium.href, cameraRD: best.c, headingDeg: heading, fovDeg: fovH, pitchDeg: pitch, distanceM: distance, image, license: 'Gemeente Amsterdam panorama, CC BY 4.0'};
  }
  return null;
}

export async function prepareFacts(id: string, options: {pand?: string; streets?: string[]; refresh?: boolean; photo?: boolean} = {}) {
  const dir = path.join(HOUSES, id);
  await fs.mkdir(dir, {recursive: true});
  let intent = await json<any>(path.join(dir, 'intent.json'));
  if (intent?.sameAs) intent = (await loadIntent(id)).intent;
  const pandId: string = options.pand ?? intent?.pandId;
  const frontStreets: string[] = options.streets ?? intent?.fronts?.map((f: any) => f.street);
  if (!/^\d{16}$/.test(pandId ?? '') || !frontStreets?.length) throw Error(`${id}: need intent.json or --pand/--street`);
  const rawFile = path.join(dir, '3dbag.json'), url = `https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.${pandId}`;
  let raw = options.refresh ? null : await json<CityJsonItem & {fetchedAt?: string}>(rawFile);
  if (!raw) {
    raw = {...JSON.parse((await fetchBytes(url)).toString()), fetchedAt: new Date().toISOString().slice(0, 10)};
    await fs.writeFile(rawFile, JSON.stringify(raw) + '\n');
  }
  const facts = buildFacts(pandId, raw!, await streets(), frontStreets, toRD, {threeDBag: url, fetchedAt: (raw as any).fetchedAt ?? 'unknown', streets: 'public/data/extracts/amsterdam/streets-routing.json'});
  await fs.writeFile(path.join(dir, 'facts.json'), JSON.stringify(facts, null, 1) + '\n');
  const photos: PanoramaReference[] = [];
  if (options.photo !== false) {
    const frontIds: string[] = intent?.fronts?.map((f: any) => f.id) ?? frontStreets.map((_, i) => `front${i}`);
    for (const [i, front] of facts.fronts.entries()) {
      const ref = await fetchPanorama(id, front, frontIds[frontStreets.indexOf(front.street)] ?? `front${i}`);
      if (ref) photos.push(ref);
    }
    await fs.writeFile(path.join(dir, 'photos.json'), JSON.stringify(photos, null, 1) + '\n');
  }
  return {facts, photos};
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('building-recipes/facts.ts')) {
  const ids = (arg('house') ?? '').split(',').filter(Boolean);
  if (!ids.length) throw Error('Use --house=<id>[,<id>...]');
  for (const id of ids) {
    const started = performance.now();
    const {facts, photos} = await prepareFacts(id, {pand: arg('pand'), streets: arg('street')?.split('|'), refresh: process.argv.includes('--refresh'), photo: !process.argv.includes('--no-photo')});
    console.log(JSON.stringify({id, seconds: +((performance.now() - started) / 1000).toFixed(2), fronts: facts.fronts.map(f => ({street: f.street, widthM: +f.widthM.toFixed(2), eavesM: +f.eavesM.toFixed(2), topM: +f.topM.toFixed(2), uncertainty: f.uncertainty.length})), ridgeM: +facts.heights.ridgeM.toFixed(2), photos: photos.map(p => `${p.timestamp.slice(0, 10)} ${p.distanceM.toFixed(1)}m`)}));
  }
}
