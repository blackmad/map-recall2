/**
 * Identify the top ride-visible dominant buildings (dominant-building-backlog.json)
 * from open data, and write name / function / address / source per row.
 *
 *   node --import tsx scripts/landmarks/identify-dominant.ts [--top=600] [--no-lookup] [--no-network]
 *
 * Sources, in the order a row takes its name:
 *   1. monument  scripts/data/amsterdam-monuments.json (Gemeente Amsterdam monumenten, joined on BAG pand id)  conf 1.0
 *   2. osm       name on the building itself: the OSM footprint way (ref:bag = pand, or the building polygon
 *                containing the centre), or a building-tagged named part inside it                          conf 1.0
 *                Tenant POIs (shops, offices, restaurants inside a larger block) never name the pand; they are
 *                listed in identity.tenantNames for the reviewer.
 *   3. osm       operator only (no name) on the building itself                                              conf 0.6
 *   4. bag-address   no name; address and function from the PDOK BAG verblijfsobjecten only                    conf 0.3
 *   5. wikipedia lookup (rows under 0.7 only): a Dutch Wikipedia article within 20 m of the centre whose
 *                summary describes a building. Never a guess; otherwise `lookup: "none found <date>"`.       conf 0.7
 *
 * BAG is read from the PDOK OGC API (CC0), cached per pand under .cache/bag-vbo/. OSM is read from the
 * archived Amsterdam pbf, filtered and exported with osmium into .cache/landmark-identity/. Wikipedia
 * responses are cached under .cache/landmark-identity/wiki/. Every request is sequential with a delay.
 * An index of what each pand resolved to is committed as scripts/landmarks/identity-cache-index.json.
 */
import { execFileSync } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createInterface } from 'node:readline';
import path from 'node:path';
import { lngLatToRd } from '../../src/canalRecall/facade/rdNew.js';

const TODAY = '2026-10-23';
const ROOT = process.cwd();
const BACKLOG = path.join(ROOT, 'public/canal-drive/dominant-building-backlog.json');
const MONUMENTS = path.join(ROOT, 'scripts/data/amsterdam-monuments.json');
const INDEX = path.join(ROOT, 'scripts/landmarks/identity-cache-index.json');
// The archived pbf lives in the maintainer's main checkout (gitignored .cache there, not in worktrees).
const PBF = process.env.AMSTERDAM_PBF ?? '/Users/blackmad/Code/map-recall2/.cache/osm-source/Amsterdam.osm.pbf';
const OSM_DIR = path.join(ROOT, '.cache/landmark-identity');
const BAG_DIR = path.join(ROOT, '.cache/bag-vbo');
const WIKI_DIR = path.join(OSM_DIR, 'wiki');
const CRS = 'http://www.opengis.net/def/crs/EPSG/0/28992';
const PDOK_DELAY_MS = 200;
const WIKI_DELAY_MS = 300;

const args = new Map(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v ?? 'true'];
}));
const TOP = Number(args.get('top') ?? 600);
const DO_LOOKUP = args.get('no-lookup') !== 'true';
const NO_NETWORK = args.get('no-network') === 'true';

type LngLat = [number, number];
interface Candidate {
  id: string; name: string | null; footprintSquareMetres: number; heightMetres: number; center: LngLat;
  sourceUrl?: string; rideVisibility: { score: number; rank: number };
  [key: string]: unknown;
}
interface Backlog { candidates: Candidate[]; [key: string]: unknown }
interface Feature { id: string; geometry: { type: string; coordinates: any }; properties: Record<string, any> }
interface Named { id: string; kind: 'way' | 'relation' | 'node'; osmId: number; tags: Record<string, string>; rep: LngLat; polygon: LngLat[][][] | null; bbox: number[] }
interface Monument { number: number | null; status: string; name: string; architect: string; yearFrom: string; yearTo: string; fn: string; panden: string[] }

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const pandCode = (id: string) => id.replace(/^NL\.IMBAG\.Pand\./, '');
const hash = (s: string) => createHash('sha1').update(s).digest('hex');

async function cachedJson(url: string, file: string, delay: number): Promise<any> {
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8')).json;
  if (NO_NETWORK) throw new Error(`no-network: missing cache ${file}`);
  await sleep(delay);
  const response = await fetch(url, { headers: { 'user-agent': 'map-recall2 identity lane (david@whizziwig.com)' } });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  const json = await response.json();
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify({ url, fetched: TODAY, json }));
  return json;
}

// ---------- OSM: prepare exports once, then stream the features that matter ----------

function prepareOsm(): { buildings: string; named: string } {
  const buildings = path.join(OSM_DIR, 'bld.geojsonseq');
  const named = path.join(OSM_DIR, 'named.geojsonseq');
  mkdirSync(OSM_DIR, { recursive: true });
  if (!existsSync(buildings)) {
    const pbf = path.join(OSM_DIR, 'bld.osm.pbf');
    execFileSync('osmium', ['tags-filter', '--overwrite', '-o', pbf, PBF, 'w/building', 'r/building'], { stdio: 'inherit' });
    execFileSync('osmium', ['export', '--overwrite', '-f', 'geojsonseq', '-u', 'type_id', '-x', 'print_record_separator=false', '-o', buildings, pbf], { stdio: 'inherit' });
  }
  if (!existsSync(named)) {
    const pbf = path.join(OSM_DIR, 'named.osm.pbf');
    const keys = ['name', 'amenity', 'office', 'tourism', 'operator', 'shop', 'historic', 'healthcare', 'education'];
    const exprs = keys.flatMap(k => ['n', 'w', 'r'].map(t => `${t}/${k}`));
    execFileSync('osmium', ['tags-filter', '--overwrite', '-o', pbf, PBF, ...exprs], { stdio: 'inherit' });
    execFileSync('osmium', ['export', '--overwrite', '-f', 'geojsonseq', '-u', 'type_id', '-x', 'print_record_separator=false', '-o', named, pbf], { stdio: 'inherit' });
  }
  return { buildings, named };
}

function ringsOf(geometry: Feature['geometry']): LngLat[][][] | null {
  if (geometry.type === 'MultiPolygon') return geometry.coordinates;
  if (geometry.type === 'Polygon') return [geometry.coordinates];
  return null;
}

function bboxOf(geometry: Feature['geometry']): number[] {
  const pts: LngLat[] = [];
  if (geometry.type === 'Point') pts.push(geometry.coordinates);
  else for (const poly of ringsOf(geometry) ?? []) for (const ring of poly) pts.push(...ring);
  const lngs = pts.map(p => p[0]), lats = pts.map(p => p[1]);
  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
}

function representative(geometry: Feature['geometry']): LngLat {
  if (geometry.type === 'Point') return geometry.coordinates;
  const ring = ringsOf(geometry)?.[0]?.[0] ?? [];
  const n = Math.max(ring.length - 1, 1);
  let x = 0, y = 0;
  for (let i = 0; i < n; i++) { x += ring[i][0]; y += ring[i][1]; }
  return [x / n, y / n];
}

function inside(point: LngLat, polygons: LngLat[][][] | null): boolean {
  if (!polygons) return false;
  for (const poly of polygons) {
    const ring = poly[0];
    let hit = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((yi > point[1]) !== (yj > point[1]) && point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi) hit = !hit;
    }
    if (hit) return true;
  }
  return false;
}

function metresBetween(a: LngLat, b: LngLat): number {
  const dy = (a[1] - b[1]) * 111_320, dx = (a[0] - b[0]) * 111_320 * Math.cos((a[1] * Math.PI) / 180);
  return Math.hypot(dx, dy);
}

// osmium --add-unique-id=type_id: n/w/r prefixes are plain; a<N> is an area, even N = way N/2, odd N = relation (N-1)/2.
const osmRef = (id: string): { kind: Named['kind']; osmId: number } => {
  const m = /^([nwra])(\d+)$/.exec(id);
  if (!m) throw new Error(`unknown osm id ${id}`);
  const n = Number(m[2]);
  if (m[1] === 'n') return { kind: 'node', osmId: n };
  if (m[1] === 'w') return { kind: 'way', osmId: n };
  if (m[1] === 'r') return { kind: 'relation', osmId: n };
  return n % 2 === 0 ? { kind: 'way', osmId: n / 2 } : { kind: 'relation', osmId: (n - 1) / 2 };
};

async function streamOsm(files: string[], wanted: Candidate[]): Promise<{ buildings: Named[]; named: Named[] }> {
  const pands = new Set(wanted.map(c => pandCode(c.id)));
  // Search box around each centre: ~90 m.
  const boxes = wanted.map(c => ({ c: c.center, box: [c.center[0] - 0.0013, c.center[1] - 0.0008, c.center[0] + 0.0013, c.center[1] + 0.0008] }));
  const buildings: Named[] = [], named: Named[] = [];
  for (const file of files) {
    const rl = createInterface({ input: createReadStream(file), crlfDelay: Infinity });
    for await (const line of rl) {
      if (!line.trim()) continue;
      const f = JSON.parse(line) as Feature;
      if (!f.geometry || (f.geometry.type !== 'Point' && f.geometry.type !== 'MultiPolygon')) continue;
      const tags = f.properties ?? {};
      const bbox = bboxOf(f.geometry);
      const ref = String(tags['ref:bag'] ?? '');
      const near = boxes.some(({ box }) => bbox[0] <= box[2] && bbox[2] >= box[0] && bbox[1] <= box[3] && bbox[3] >= box[1]);
      if (!near && !pands.has(ref)) continue;
      const item: Named = {
        id: f.id, ...osmRef(f.id), tags: Object.fromEntries(Object.entries(tags).map(([k, v]) => [k, String(v)])),
        rep: representative(f.geometry), polygon: ringsOf(f.geometry), bbox,
      };
      if (tags.building !== undefined || tags['ref:bag'] !== undefined) buildings.push(item);
      if (tags.name || tags.operator) named.push(item);
    }
  }
  return { buildings, named };
}

// ---------- BAG: verblijfsobjecten of the pand, via PDOK OGC API ----------

interface Unit { street: string; number: number; letter: string | null; suffix: string | null; uses: string[] }
interface BagResult { units: Unit[]; url: string; footprintBbox: number[] | null }

async function bagFor(pand: string, footprintBbox: number[] | null, center: LngLat): Promise<BagResult> {
  const base = footprintBbox ?? [center[0] - 0.0007, center[1] - 0.0005, center[0] + 0.0007, center[1] + 0.0005];
  const sw = lngLatToRd([base[0], base[1]]);
  const ne = lngLatToRd([base[2], base[3]]);
  const pad = 10;
  const [x0, y0, x1, y1] = [Math.min(sw.x, ne.x) - pad, Math.min(sw.y, ne.y) - pad, Math.max(sw.x, ne.x) + pad, Math.max(sw.y, ne.y) + pad];
  const url = `https://api.pdok.nl/kadaster/bag/ogc/v2/collections/verblijfsobject/items?bbox=${x0.toFixed(0)},${y0.toFixed(0)},${x1.toFixed(0)},${y1.toFixed(0)}&bbox-crs=${CRS}&crs=${CRS}&f=json&limit=1000`;
  const vbos: Array<{ uuid: string; unit: Unit }> = [];
  let next: string | null = url;
  for (let page = 0; next && page < 5; page++) {
    const json: any = await cachedJson(next, path.join(BAG_DIR, `${pand}-${hash(next)}.json`), PDOK_DELAY_MS);
    for (const feature of json.features ?? []) {
      const p = feature.properties ?? {};
      const hrefs: string[] = [].concat(p['pand.href'] ?? []);
      if (!hrefs.length) continue;
      if (/ingetrokken|niet gerealiseerd/i.test(String(p.status ?? ''))) continue;
      const uses = [].concat(p.gebruiksdoel ?? []).flatMap((u: string) => String(u).split(',')).map((u: string) => u.trim()).filter(Boolean);
      const unit: Unit = { street: String(p.openbare_ruimte_naam ?? ''), number: Number(p.huisnummer), letter: p.huisletter ?? null, suffix: p.toevoeging ?? null, uses };
      for (const h of hrefs) vbos.push({ uuid: h.split('/').pop() ?? '', unit });
    }
    next = json.links?.find((l: any) => l.rel === 'next')?.href ?? null;
  }
  // BAG pand features carry the 16-digit identificatie; verblijfsobjecten link to them by uuid.
  const pandsUrl = `https://api.pdok.nl/kadaster/bag/ogc/v2/collections/pand/items?bbox=${x0.toFixed(0)},${y0.toFixed(0)},${x1.toFixed(0)},${y1.toFixed(0)}&bbox-crs=${CRS}&crs=${CRS}&f=json&limit=1000`;
  const pandJson: any = await cachedJson(pandsUrl, path.join(BAG_DIR, `${pand}-pands-${hash(pandsUrl)}.json`), PDOK_DELAY_MS);
  const idByUuid = new Map<string, string>();
  for (const f of pandJson.features ?? []) idByUuid.set(String(f.id), String(f.properties?.identificatie));
  const units: Unit[] = [];
  for (const { uuid, unit } of vbos) {
    if (!idByUuid.has(uuid)) {
      const item: any = await cachedJson(`https://api.pdok.nl/kadaster/bag/ogc/v2/collections/pand/items/${uuid}?f=json`, path.join(BAG_DIR, `pand-${uuid}.json`), PDOK_DELAY_MS);
      idByUuid.set(uuid, String(item.properties?.identificatie));
    }
    if (idByUuid.get(uuid) === pand) units.push(unit);
  }
  return { units, url, footprintBbox };
}

function summariseBag(units: Unit[]): { address: string | null; function: string | null } {
  if (!units.length) return { address: null, function: null };
  const byStreet = new Map<string, number[]>();
  for (const u of units) byStreet.set(u.street, [...(byStreet.get(u.street) ?? []), u.number]);
  const [street, numbers] = [...byStreet.entries()].sort((a, b) => b[1].length - a[1].length)[0];
  const sorted = [...new Set(numbers)].sort((a, b) => a - b);
  const range = sorted.length > 1 ? `${sorted[0]}–${sorted.at(-1)}` : `${sorted[0]}`;
  const counts = new Map<string, number>();
  for (const u of units) for (const use of u.uses) counts.set(use, (counts.get(use) ?? 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([u]) => u);
  return { address: `${street} ${range}`, function: top.length ? top.join(', ') : null };
}

// ---------- Monuments ----------

function loadMonuments(): Monument[] {
  const json = JSON.parse(readFileSync(MONUMENTS, 'utf8'));
  return json.monuments.map((m: any[]) => ({
    number: m[0] === null || m[0] === '' ? null : Number(m[0]), status: m[1], name: m[2], architect: m[3],
    yearFrom: m[4], yearTo: m[5], fn: m[6], panden: m[7],
  }));
}

// ---------- Wikipedia lookup (Dutch, geosearch within 20 m, building summaries only) ----------

const BUILDING_WORDS = /\b(gebouw|kerk|pand|complex|toren|school|museum|hotel|kantoor|winkel|warenhuis|fabriek|station|theater|paleis|kazerne|bioscoop|ziekenhuis|universiteit|bibliotheek|bedrijfsverzamelgebouw|hal|markthal|poort)\b/i;

async function wikiLookup(center: LngLat, street: string | null): Promise<{ name: string; url: string } | null> {
  const geoUrl = `https://nl.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${center[1]}|${center[0]}&gsradius=30&gslimit=10&format=json&origin=*`;
  const geo: any = await cachedJson(geoUrl, path.join(WIKI_DIR, `geo-${hash(geoUrl)}.json`), WIKI_DELAY_MS);
  for (const hit of geo.query?.geosearch ?? []) {
    if (hit.dist > 20) continue;
    if (street && hit.title.toLowerCase() === street.toLowerCase()) continue;
    const sumUrl = `https://nl.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(hit.title.replace(/ /g, '_'))}`;
    const summary: any = await cachedJson(sumUrl, path.join(WIKI_DIR, `sum-${hash(sumUrl)}.json`), WIKI_DELAY_MS);
    if (summary.type !== 'standard' || !BUILDING_WORDS.test(String(summary.extract ?? '').slice(0, 400))) continue;
    return { name: summary.title ?? hit.title, url: summary.content_urls?.desktop?.page ?? `https://nl.wikipedia.org/wiki/${encodeURIComponent(hit.title)}` };
  }
  return null;
}

// ---------- Main ----------

const backlog: Backlog = JSON.parse(readFileSync(BACKLOG, 'utf8'));
const top = [...backlog.candidates]
  .sort((a, b) => (b.rideVisibility.score - a.rideVisibility.score) || (a.rideVisibility.rank - b.rideVisibility.rank))
  .slice(0, TOP);
console.log(`top ${top.length} by rideVisibility (score desc, rank asc)`);

const osm = prepareOsm();
console.log('streaming OSM buildings and named features near the candidates');
const { buildings, named } = await streamOsm([osm.buildings, osm.named], top);
console.log(`  ${buildings.length} building features, ${named.length} named features in the search boxes`);

const monuments = loadMonuments();
const index: Record<string, unknown> = {};

for (const [i, c] of top.entries()) {
  delete (c as Record<string, unknown>).lookup;
  const pand = pandCode(c.id);
  const center = c.center;

  // Footprint: the OSM building that carries ref:bag = pand, else the one containing the centre.
  const bldRef = buildings.find(b => b.tags['ref:bag'] === pand && b.polygon);
  const bldAt = buildings.find(b => b.polygon && inside(center, b.polygon));
  const footprint = bldRef ?? bldAt ?? null;
  const footprintBbox = footprint ? footprint.bbox : null;

  // BAG
  let bag: BagResult | null = null;
  try { bag = await bagFor(pand, footprintBbox, center); }
  catch (error) { console.warn(`  BAG failed for ${pand}: ${(error as Error).stack?.split('\n').slice(0, 3).join(' | ')}`); }
  const bagSummary = summariseBag(bag?.units ?? []);

  // Monument
  const monument = monuments.find(m => m.panden.includes(pand) && m.name);

  // OSM name: ref:bag or inside footprint, else within 15 m of the centre for POI-type features.
  const inFootprint = (n: Named) => (footprint ? n.tags['ref:bag'] === pand || inside(n.rep, footprint.polygon) : metresBetween(n.rep, center) <= 15);
  // Only the building itself names the building: the footprint way, a building-tagged part, or a ref:bag match.
  // Tenant POIs (shops, restaurants, offices inside a larger block) are recorded but never name the pand.
  const isBuilding = (n: Named) => (footprint && n.id === footprint.id) || (n.tags.building !== undefined && inFootprint(n));
  const candidates = named.filter(n => inFootprint(n) && isBuilding(n));
  const tenants = named.filter(n => inFootprint(n) && !isBuilding(n) && n.tags.name).map(n => n.tags.name).slice(0, 5);
  const withName = candidates.find(n => n.tags.name && n.tags['ref:bag'] === pand) ?? candidates.find(n => n.tags.name);
  const operator = candidates.find(n => !n.tags.name && n.tags.operator);

  const osmUrl = (n: Named) => `https://www.openstreetmap.org/${n.kind}/${n.osmId}`;
  const osmObject = (n: Named) => `${n.kind}/${n.osmId}`;
  const row = c as Candidate & Record<string, any>;
  row.function = bagSummary.function;
  row.address = bagSummary.address;
  row.identity = {
    bagUnits: bag?.units.length ?? 0,
    bagUrl: bag?.url ?? null,
    osmFootprint: footprint ? footprint.id : null,
    osmObject: null as string | null,
    sharedWith: null as number | null,
    tenantNames: tenants,
    monument: monument ? { number: monument.number, architect: monument.architect || null, yearFrom: monument.yearFrom || null, status: monument.status } : null,
  };

  if (monument) {
    row.name = monument.name;
    row.nameSource = 'monument';
    row.confidence = 1.0;
    row.sourceUrl = monument.number ? `https://monumentenregister.cultureelerfgoed.nl/monumenten/${monument.number}` : 'https://api.data.amsterdam.nl/v1/monumenten/monumenten/';
  } else if (withName) {
    row.name = withName.tags.name;
    row.nameSource = 'osm';
    row.confidence = 1.0;
    row.sourceUrl = osmUrl(withName);
    row.identity.osmObject = osmObject(withName);
    row.identity.osmTags = { amenity: withName.tags.amenity, building: withName.tags.building, operator: withName.tags.operator };
  } else if (operator) {
    row.name = operator.tags.operator;
    row.nameSource = 'osm';
    row.confidence = 0.6;
    row.sourceUrl = osmUrl(operator);
    row.identity.osmObject = osmObject(operator);
    row.identity.operatorOnly = true;
  } else if (bagSummary.address) {
    row.name = null;
    row.nameSource = 'bag-address';
    row.confidence = 0.3;
    row.sourceUrl = bag?.url ?? c.sourceUrl ?? null;
  } else {
    row.name = null;
    row.nameSource = null;
    row.confidence = 0;
  }
  index[c.id] = { row: i + 1, nameSource: row.nameSource, confidence: row.confidence, osmFootprint: row.identity.osmFootprint, bagUnits: row.identity.bagUnits };
}

// sharedWith: how many backlog rows in this run took their name from the same OSM object
const sharedCount = new Map<string, number>();
for (const c of top as Array<Candidate & Record<string, any>>) if (c.nameSource === 'osm' && c.identity.osmObject) sharedCount.set(c.identity.osmObject, (sharedCount.get(c.identity.osmObject) ?? 0) + 1);
for (const c of top as Array<Candidate & Record<string, any>>) if (c.nameSource === 'osm' && c.identity.osmObject) c.identity.sharedWith = sharedCount.get(c.identity.osmObject);

// Lookup pass
const streetOf = (c: Candidate) => ((c as any).address as string | null)?.replace(/ \d.*$/, '') ?? null;
let found = 0, none = 0;
if (DO_LOOKUP && !NO_NETWORK) {
  for (const c of top as Array<Candidate & Record<string, any>>) {
    if (c.confidence >= 0.7) continue;
    try {
      const hit = await wikiLookup(c.center, streetOf(c));
      if (hit) {
        c.name = hit.name;
        c.nameSource = 'wikipedia';
        c.confidence = 0.7;
        c.sourceUrl = hit.url;
        c.lookup = `wikipedia hit ${TODAY}`;
        found++;
      } else {
        c.lookup = `none found ${TODAY}`;
        none++;
      }
    } catch (error) {
      c.lookup = `none found ${TODAY}`;
      console.warn(`  lookup failed for ${c.id}: ${(error as Error).message}`);
      none++;
    }
    (index[c.id] as Record<string, unknown>).lookup = c.lookup;
  }
  console.log(`lookup: ${found} named from Wikipedia, ${none} none found`);
}

// Write back into the backlog (the top rows were edited in place)
writeFileSync(BACKLOG, `${JSON.stringify(backlog, null, 2)}\n`);
writeFileSync(INDEX, `${JSON.stringify({ version: 1, date: TODAY, pbf: path.basename(PBF), rows: index }, null, 1)}\n`);

// Table
const tally = (rows: Array<Candidate & Record<string, any>>) => {
  const named = rows.filter(r => r.name);
  const bySource = Object.fromEntries(['monument', 'osm', 'wikipedia'].map(s => [s, named.filter(r => r.nameSource === s).length]));
  const withUrl = named.filter(r => r.sourceUrl).length;
  return { named: named.length, bySource, withUrl, addressOnly: rows.filter(r => !r.name && r.address).length, none: rows.filter(r => !r.address && !r.name).length };
};
const rows = top as Array<Candidate & Record<string, any>>;
const t250 = tally(rows.slice(0, 250)), t600 = tally(rows);
console.log('\n| set | named | monument | osm | wikipedia | named with URL | address only | nothing |');
console.log('|---|---|---|---|---|---|---|---|');
console.log(`| top 250 | ${t250.named} (${(100 * t250.named / 250).toFixed(0)} %) | ${t250.bySource.monument} | ${t250.bySource.osm} | ${t250.bySource.wikipedia} | ${t250.withUrl} | ${t250.addressOnly} | ${t250.none} |`);
console.log(`| top 600 | ${t600.named} (${(100 * t600.named / 600).toFixed(0)} %) | ${t600.bySource.monument} | ${t600.bySource.osm} | ${t600.bySource.wikipedia} | ${t600.withUrl} | ${t600.addressOnly} | ${t600.none} |`);
const unnamedWithoutUrl = rows.filter(r => r.name && !r.sourceUrl).length;
console.log(`names without a URL: ${unnamedWithoutUrl}`);
