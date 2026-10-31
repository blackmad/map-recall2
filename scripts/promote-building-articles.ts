/**
 * Promote the well-known buildings the article join found to landmarks.
 *
 * The extract's `classify()` admits a landmark only through tourism/historic/
 * civic tags, so the Olympisch Stadion, De Nederlandsche Bank or the
 * Rembrandttoren — plain `building=*` ways with dozens of Wikipedia editions
 * — never got a landmark dot, an arrival card or a place in the destination
 * list. This appends them to `landmarks.json` from the building-article
 * master (`scripts/data/amsterdam-building-articles.json`), with the pands
 * the tiles draw as `buildingIds` (so a click lights the building up and the
 * landmark card wins, exactly as for extracted landmarks) and the footprint
 * as `path`.
 *
 * Only items with at least MIN_SITELINKS Wikipedia editions, of a building
 * class (stations, villages, polders and islands are not landmarks), not
 * already a landmark by Q-id, name or pand. Idempotent: earlier
 * `article_landmarks_*` entries are replaced. Then run
 * `npm run resolve:landmark-buildings -- --publish` is NOT needed: the ids
 * ship on the feature.
 *
 * Usage: npm run promote:building-articles [-- --min-sitelinks=8] [-- --dry-run]
 */
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { manualPoiBuildingIds, mergeManualPoiFeatures } from '../src/canalRecall/game/manualPoiCatalog';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { ringCentroid, type Ring } from './lib/landmarkBuildings.ts';
import { loadWikidataArticlesBox } from './lib/wikidata-articles-box.ts';

const directory = path.resolve('public/data/extracts/amsterdam');
const argument = (name: string) => process.argv.find(v => v.startsWith(`--${name}=`))?.slice(name.length + 3);
const MIN_SITELINKS = Number(argument('min-sitelinks') || 8);
const dryRun = process.argv.includes('--dry-run');
const NOT_A_LANDMARK = /station|village|neighbo|polder|island|fortification|defence line|municipality|metro|tram|bus stop|cadastral|hamlet|organization|organisation|company|event|club|team|academy of sciences|learned society|institute|foundation|society/i;
/** A class that is a building outranks an institutional one on the same item (Vondelkerk: church building + parish). */
const A_BUILDING = /build|church|tower|hall|house|museum|stadium|arena|hotel|theat|mill|castle|palace|warehouse|office|school|bank building|skyscraper|shopping cent|complex|gate|monaster|synagogue|mosque|chapel|mansion|villa/i;

interface MasterRecord { pands: string[]; osmId: string; osmName: string | null; wikidata: string | null; sitelinks: number; name: string; title: string; url: string; imageUrl: string | null; lng: number; lat: number; extract: string; extractLang: string }
interface LandmarkFeature {
  id: string; name: string; type: string; cityId: string; center: [number, number]; path?: [number, number][]; funFact: string; clues: string[]; distractors: string[];
  difficulty: string; wikidata?: string; wikipedia?: string; prominenceScore: number; wikipediaExtract?: string; wikipediaUrl?: string; wikipediaImageUrl?: string;
  wikidataSitelinks?: number; wikipediaExtractLang?: string; buildingIds?: string[]; wikidataInstanceOf?: string[];
}
const master = JSON.parse(await readFile(path.resolve('scripts/data/amsterdam-building-articles.json'), 'utf8')) as { articles: MasterRecord[] };
const landmarksFile = path.join(directory, 'landmarks.json');
const landmarks = (JSON.parse(await readFile(landmarksFile, 'utf8')) as LandmarkFeature[]).filter(l => !l.id.startsWith('article_landmarks_'));
const join = JSON.parse(await readFile(path.join(directory, 'landmark-buildings.json'), 'utf8')) as { buildings: Record<string, string[]> };
const items = await loadWikidataArticlesBox(directory);

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s*\([^)]*\)\s*/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
const haveQ = new Set(landmarks.map(l => l.wikidata).filter(Boolean));
// Bespoke models (manual POIs) are merged into the landmark list at runtime,
// not in landmarks.json: Paradiso, Magna Plaza, the Amstel hotel already own
// their card and building there, under their own names.
const manual = mergeManualPoiFeatures(landmarks).filter(l => !landmarks.includes(l));
const haveName = new Set([...landmarks, ...manual].map(l => norm(l.name)));
const manualCentres = manual.map(l => l.center).filter((c): c is [number, number] => Array.isArray(c) && c.length === 2);
const MANUAL_CLAIM_KM = 0.06;
const havePand = new Set([...Object.values(join.buildings).flat(), ...landmarks.flatMap(l => l.buildingIds ?? []), ...manual.flatMap(l => manualPoiBuildingIds(l.id, l.buildingIds ?? []))]);

// Footprints of the drawn pands, for `path`.
const wanted = new Set(master.articles.filter(a => a.sitelinks >= MIN_SITELINKS).flatMap(a => a.pands));
const rings = new Map<string, Ring>();
const tileRoot = path.join(directory, 'building-tiles', '14');
for (const x of await readdir(tileRoot)) {
  for (const file of await readdir(path.join(tileRoot, x))) {
    if (!file.endsWith('.geojson.gz')) continue;
    const collection = JSON.parse(gunzipSync(await readFile(path.join(tileRoot, x, file))).toString('utf8'));
    for (const feature of collection.features) {
      const id = String(feature.properties?.id ?? '');
      if (!wanted.has(id)) continue;
      const ring: Ring | undefined = feature.geometry?.type === 'Polygon' ? feature.geometry.coordinates[0] : feature.geometry?.type === 'MultiPolygon' ? feature.geometry.coordinates[0]?.[0] : undefined;
      if (ring?.length) rings.set(id, ring);
    }
  }
}
const ringArea = (ring: Ring) => Math.abs(ring.reduce((sum, [x, y], i) => { const [nx, ny] = ring[(i + 1) % ring.length]; return sum + x * ny - nx * y; }, 0) / 2);
const kmBetween = (a: [number, number], b: [number, number]) => Math.hypot((a[1] - b[1]) * 111.32 * Math.cos(a[0] * Math.PI / 180), (a[0] - b[0]) * 110.54);

const promoted: LandmarkFeature[] = [];
const skipped: string[] = [];
for (const record of master.articles) {
  if (record.sitelinks < MIN_SITELINKS || !record.wikidata) continue;
  const item = items.get(record.wikidata);
  const classes = item?.classes ?? [];
  const label = item?.label || record.title;
  if (NOT_A_LANDMARK.test(classes.join('|')) && !classes.some(c => A_BUILDING.test(c))) { skipped.push(`${label}: ${classes.join(', ')}`); continue; }
  if (haveQ.has(record.wikidata) || haveName.has(norm(label)) || haveName.has(norm(record.title)) || haveName.has(norm(record.osmName ?? ''))) { skipped.push(`${label}: already a landmark`); continue; }
  if (record.pands.some(p => havePand.has(p))) { skipped.push(`${label}: its building already belongs to a landmark`); continue; }
  if (record.extractLang !== 'en') { skipped.push(`${label}: lede not English`); continue; }
  const footprint = record.pands.map(p => rings.get(p)).filter((r): r is Ring => !!r).sort((a, b) => ringArea(b) - ringArea(a))[0];
  const center: [number, number] = footprint ? (([lng, lat]) => [lat, lng] as [number, number])(ringCentroid(footprint)) : [record.lat, record.lng];
  if (manualCentres.some(c => kmBetween(c, center) < MANUAL_CLAIM_KM)) { skipped.push(`${label}: a bespoke model stands here`); continue; }
  const distractors = landmarks.map(l => ({ name: l.name, d: kmBetween(center, l.center) })).sort((a, b) => a.d - b.d).slice(0, 4).map(l => l.name);
  const score = 60 + 4 * record.sitelinks;
  const feature: LandmarkFeature = {
    id: `article_landmarks_${record.wikidata}`, name: label, type: 'landmark', cityId: 'amsterdam', center,
    ...(footprint ? { path: footprint.map(([lng, lat]) => [lat, lng] as [number, number]) } : {}),
    funFact: '', clues: [], distractors, difficulty: score >= 140 ? 'easy' : score >= 70 ? 'medium' : 'hard',
    wikidata: record.wikidata, wikipedia: `${record.url.includes('//en.') ? 'en' : 'nl'}:${record.title}`, prominenceScore: score,
    wikipediaExtract: record.extract, wikipediaUrl: record.url, ...(record.imageUrl ? { wikipediaImageUrl: record.imageUrl } : {}),
    wikidataSitelinks: record.sitelinks, buildingIds: record.pands,
  };
  promoted.push(feature);
  haveName.add(norm(label));
  for (const p of record.pands) havePand.add(p);
}
promoted.sort((a, b) => b.prominenceScore - a.prominenceScore);
process.stdout.write(`${promoted.length} buildings promoted to landmarks (≥${MIN_SITELINKS} sitelinks):\n${promoted.map(p => `  ${p.name} (${p.wikidataSitelinks} sitelinks, ${p.buildingIds!.length} pand${p.buildingIds!.length === 1 ? '' : 's'}${p.path ? '' : ', no footprint'})`).join('\n')}\n`);
process.stdout.write(`${skipped.length} skipped:\n${skipped.map(s => `  ${s}`).join('\n')}\n`);
if (!dryRun) {
  const merged = [...landmarks, ...promoted].sort((a, b) => (b.prominenceScore || 0) - (a.prominenceScore || 0));
  await writeFile(landmarksFile, JSON.stringify(merged));
  process.stdout.write(`wrote ${path.relative(process.cwd(), landmarksFile)} (${merged.length} landmarks)\n`);
}
