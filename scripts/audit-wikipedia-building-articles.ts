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
 * (`npm run resolve:landmark-buildings` derives it) and the Wikidata CSV in
 * `staging/wikidata-articles-box.csv`, fetched once when missing.
 *
 * Writes `public/data/extracts/amsterdam/staging/wikipedia-building-articles.json`
 * and prints the summary. Usage: npm run audit:wikipedia-buildings
 */
import { createReadStream } from 'node:fs';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline';

const directory = path.resolve('public/data/extracts/amsterdam');
const staging = path.join(directory, 'staging');
const buildingsSeq = path.resolve('.cache/osm-source/derived/amsterdam-buildings.geojsonseq');
const csvFile = path.join(staging, 'wikidata-articles-box.csv');
const outFile = path.join(staging, 'wikipedia-building-articles.json');
await mkdir(staging, { recursive: true });
if (!await stat(buildingsSeq).catch(() => null)) throw new Error('Run `npm run resolve:landmark-buildings` first.');

const SPARQL = `SELECT ?item ?itemLabel ?classLabel ?coord ?nl ?en ?sitelinks WHERE {
  SERVICE wikibase:box { ?item wdt:P625 ?coord .
    bd:serviceParam wikibase:cornerSouthWest "Point(4.73 52.28)"^^geo:wktLiteral .
    bd:serviceParam wikibase:cornerNorthEast "Point(5.08 52.43)"^^geo:wktLiteral . }
  ?item wikibase:sitelinks ?sitelinks .
  OPTIONAL { ?nl schema:about ?item ; schema:isPartOf <https://nl.wikipedia.org/> . }
  OPTIONAL { ?en schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> . }
  FILTER(BOUND(?nl) || BOUND(?en))
  OPTIONAL { ?item wdt:P31 ?class . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,nl". }
}`;
if (!await stat(csvFile).catch(() => null)) {
  console.log('fetching Wikidata box query…');
  const response = await fetch('https://query.wikidata.org/sparql', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'text/csv', 'user-agent': 'map-recall (https://github.com/blackmad/map-recall2)' },
    body: new URLSearchParams({ query: SPARQL }),
  });
  if (!response.ok) throw new Error(`Wikidata ${response.status}`);
  await writeFile(csvFile, await response.text());
}

// Building-ish Wikidata classes; the negative list wins (a destroyed church, an event).
const BUILDING_RE = /build|house|church|office|warehouse|hotel|theat|school|museum|windmill|station|synagogue|mosque|chapel|monaster|hospital|palace|castle|gate|tower|hall|cinema|library|brewery|factory|mill|bank|shop|store|university|college|gable|villa|mansion|squat|prison|court|embassy|fort|bunker|barracks|distillery|residen|apartment|complex|hofje|almshouse|orphanage|pavilion|stadium|arena|concert|opera|depot|pumping|lighthouse|observatory|laboratory|headquarters|skyscraper|high-rise|dwelling|farm|inn|cafe|restaurant|pub|bar\b|club/i;
const EXCLUDE_RE = /destroyed|former|event|discipline|organization|club$|team|company|business|festival|competition|street|neighborhood|village|bridge|polder/i;

function parseCsvLine(line: string): string[] {
  const out: string[] = []; let cell = ''; let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) { if (ch === '"') { if (line[i + 1] === '"') { cell += '"'; i++; } else quoted = false; } else cell += ch; }
    else if (ch === '"') quoted = true;
    else if (ch === ',') { out.push(cell); cell = ''; }
    else cell += ch;
  }
  out.push(cell); return out;
}

interface Item { q: string; label: string; classes: Set<string>; lng: number; lat: number; nl: string; en: string; sitelinks: number }
const items = new Map<string, Item>();
for (const line of (await readFile(csvFile, 'utf8')).trim().split('\n').slice(1)) {
  const [item, label, cls, coord, nl, en, sitelinks] = parseCsvLine(line);
  const point = /Point\(([-\d.]+) ([-\d.]+)\)/.exec(coord); if (!point) continue;
  const q = item.split('/').pop()!;
  const entry = items.get(q) ?? { q, label, classes: new Set<string>(), lng: Number(point[1]), lat: Number(point[2]), nl, en, sitelinks: Number(sitelinks) };
  entry.classes.add(cls); items.set(q, entry);
}

// What the extracts already link, by Q-id, feature name and article title.
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const titleOf = (url: string) => norm(decodeURIComponent(url.split('/wiki/')[1] ?? '').replace(/_/g, ' '));
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
  const classes = [...item.classes];
  if (!BUILDING_RE.test(classes.join('|')) || EXCLUDE_RE.test(classes.join('|'))) return [];
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
