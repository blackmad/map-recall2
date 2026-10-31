/**
 * Which Wikipedia articles about buildings never reach a building card?
 *
 * Joins every Wikidata item inside the Amsterdam box that has coordinates
 * and a Dutch or English article to the OSM building footprint its point
 * falls in, then drops the ones any extract already links by Q-id, name or
 * article title. The remainder is what the trivia lane can add
 * (`docs/handoffs/lane-wikipedia-buildings-20261030.md`).
 *
 * Reads `.cache/osm-source/derived/amsterdam-buildings.geojsonseq`
 * (`npm run resolve:landmark-buildings` derives it) and the Wikidata box
 * (`lib/wikidata-articles-box.ts`, fetched once into staging).
 *
 * Writes `public/data/extracts/amsterdam/staging/wikipedia-building-articles.json`
 * and prints the summary. Usage: npm run audit:wikipedia-buildings
 */
import { createReadStream } from 'node:fs';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { isBuildingClass } from '../src/canalRecall/buildingArticles.ts';
import { articleTitle, loadWikidataArticlesBox } from './lib/wikidata-articles-box.ts';

const directory = path.resolve('public/data/extracts/amsterdam');
const staging = path.join(directory, 'staging');
const buildingsSeq = path.resolve('.cache/osm-source/derived/amsterdam-buildings.geojsonseq');
const outFile = path.join(staging, 'wikipedia-building-articles.json');
await mkdir(staging, { recursive: true });
if (!await stat(buildingsSeq).catch(() => null)) throw new Error('Run `npm run resolve:landmark-buildings` first.');

const items = await loadWikidataArticlesBox(directory);
type Item = (typeof items extends Map<string, infer T> ? T : never);

// What the extracts already link, by Q-id, feature name and article title.
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const titleOf = (url: string) => norm(articleTitle(url));
const haveQ = new Set<string>(); const haveNames = new Set<string>(); const haveTitles = new Set<string>();
for (const file of await readdir(directory)) {
  if (!file.endsWith('.json')) continue;
  const text = await readFile(path.join(directory, file), 'utf8');
  for (const m of text.matchAll(/"(Q\d+)"/g)) haveQ.add(m[1]);
  if (file === 'all.json' || file === 'landmarks.json') {
    const parsed = JSON.parse(text) as unknown;
    const features = (Array.isArray(parsed) ? parsed : Object.values(parsed as Record<string, unknown>).flat()) as Array<{ name?: string; wikipedia?: string; wikipediaUrl?: string }>;
    for (const f of features) {
      if (f.name) haveNames.add(norm(f.name));
      if (f.wikipedia) haveTitles.add(norm(f.wikipedia.replace(/^\w\w:/, '')));
      if (f.wikipediaUrl) haveTitles.add(titleOf(f.wikipediaUrl));
    }
  }
}

// Point-in-footprint over the building export, with a coarse grid on the points.
type Hit = { osmId: string; name: string | null; building: string; startDate: string | null; wikipedia: string | null; wikidata: string | null; bag: string | null };
const hits = new Map<string, Hit>();
const cellOf = (lng: number, lat: number) => `${Math.floor(lng * 500)}:${Math.floor(lat * 1000)}`;
const grid = new Map<string, Item[]>();
for (const item of items.values()) { const key = cellOf(item.lng, item.lat); (grid.get(key) ?? grid.set(key, []).get(key)!).push(item); }
function inRing(x: number, y: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
let scanned = 0;
for await (const raw of createInterface({ input: createReadStream(buildingsSeq) })) {
  const line = raw.replace(/^\x1e/, ''); if (!line) continue;
  const feature = JSON.parse(line) as { properties?: Record<string, string>; geometry: { type: string; coordinates: number[][][] | number[][][][] } };
  const props = feature.properties ?? {}; if (!props.building) continue; scanned++;
  const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates as number[][][]]
    : feature.geometry.type === 'MultiPolygon' ? feature.geometry.coordinates as number[][][][] : [];
  for (const polygon of polygons) {
    const outer = polygon[0]; let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [x, y] of outer) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    for (let cx = Math.floor(minX * 500); cx <= Math.floor(maxX * 500); cx++) for (let cy = Math.floor(minY * 1000); cy <= Math.floor(maxY * 1000); cy++) {
      for (const item of grid.get(`${cx}:${cy}`) ?? []) {
        if (hits.has(item.q) || item.lng < minX || item.lng > maxX || item.lat < minY || item.lat > maxY || !inRing(item.lng, item.lat, outer)) continue;
        hits.set(item.q, {
          osmId: `${props['@type'] === 'relation' ? 'r' : 'w'}${props['@id']}`, name: props.name ?? null, building: props.building,
          startDate: props.start_date ?? null, wikipedia: props.wikipedia ?? null, wikidata: props.wikidata ?? null, bag: props['ref:bag'] ?? null,
        });
      }
    }
  }
}

const rows = [...items.values()].flatMap(item => {
  const hit = hits.get(item.q); if (!hit) return [];
  const classes = item.classes;
  if (!isBuildingClass(classes)) return [];
  const linked = haveQ.has(item.q) || haveNames.has(norm(item.label)) || haveTitles.has(titleOf(item.nl)) || haveTitles.has(titleOf(item.en))
    || (hit.name != null && haveNames.has(norm(hit.name)));
  return [{ ...item, classes, linked, osm: hit }];
}).sort((a, b) => b.sitelinks - a.sitelinks);
const unlinked = rows.filter(r => !r.linked);
const tagged = unlinked.filter(r => r.osm.wikipedia || r.osm.wikidata);
const summary = {
  scannedBuildings: scanned, itemsWithArticles: items.size, buildingItemsInFootprints: rows.length, alreadyLinked: rows.length - unlinked.length,
  unlinked: unlinked.length, unlinkedOnTaggedFootprint: tagged.length, unlinkedByPointOnly: unlinked.length - tagged.length,
  unlinkedWithEnglishArticle: unlinked.filter(r => r.en).length, unlinkedDutchOnly: unlinked.filter(r => !r.en).length,
  unlinkedFootprintNamed: unlinked.filter(r => r.osm.name).length,
};
await writeFile(outFile, JSON.stringify({ generated: new Date().toISOString(), summary, unlinked: unlinked.map(({ linked: _l, ...r }) => r) }, null, 1));
console.log(JSON.stringify(summary, null, 2));
console.log(`top unlinked:\n${unlinked.slice(0, 15).map(r => ` ${r.q} ${r.sitelinks}sl ${r.label} [${r.classes[0]}] -> ${r.osm.osmId} ${r.osm.name ?? '(no name)'} ${r.osm.bag ?? ''}`).join('\n')}`);
console.log(`wrote ${path.relative(process.cwd(), outFile)}`);
