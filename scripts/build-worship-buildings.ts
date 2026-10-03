/**
 * Places of worship: which building footprints are churches, mosques, synagogues and temples,
 * and how each renders today, so a worship building with no hand-modelled kit stops taking a
 * canal-house front (user 2026-10-03, on a church in house windows: "why does it have windows???").
 *
 *   npx tsx scripts/build-worship-buildings.ts            # fetch (or reuse), write staging, report
 *   npx tsx scripts/build-worship-buildings.ts --publish  # also write src/canalRecall/worshipBuildingData.ts
 *
 * Sources: OSM amenity=place_of_worship and building=church|chapel|cathedral|mosque|synagogue|
 * temple|shrine|religious (Overpass, through the maps.mail.ru mirror; every answer is kept in the
 * scrape store, one record per query, and reused), and the landmark extract's names (kerk, moskee,
 * synagoge, tempel, kapel...). A worship *building* is an OSM way that is a building (a worship
 * building tag, or amenity=place_of_worship on a building=* way); a tile footprint is that building
 * when at least 60% of it lies inside the way. Nodes are only reported: a node is as often a
 * prayer room in the ground floor of a block of flats, which must keep its flats' front.
 *
 * Each footprint is reported with its height (tile), BAG year (building facts), area, and how it
 * renders now: `kit` (hand modelled), `landmark-house` (an old landmark up to 26 m takes the
 * generic period front), `landmark-box` (a bigger landmark stays a bare box), or `generic` (not a
 * landmark: the generic house front and roof). Publishing writes the generic-treatment list.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { readScrape, writeScrape } from './lib/scrapeStore.ts';
import { loadGroundBuildings, local } from './lib/groundBuildings.ts';
import { HAND_KIT_IDS } from '../src/canalRecall/landmarkKits.ts';
import { planWorship, type WorshipPlan } from '../src/canalRecall/worshipBuildings.ts';
import { FRONT_PART_IDS } from '../src/canalRecall/landmarkFrontData.ts';
import { OLD_LANDMARK_MAX_M, fitRect } from '../src/canalRecall/roofMesh.ts';
import { shortBuildingId } from '../src/canalRecall/buildingFacts.ts';

const BBOX = '52.28,4.75,52.43,5.05';
const WORSHIP_BUILDING = 'church|chapel|cathedral|mosque|synagogue|temple|shrine|religious';
const QUERIES = [
  `[out:json][timeout:90];(node["amenity"="place_of_worship"](${BBOX});relation["amenity"="place_of_worship"](${BBOX}););out center tags;`,
  `[out:json][timeout:90];(way["amenity"="place_of_worship"](${BBOX});way["building"~"^(${WORSHIP_BUILDING})$"](${BBOX}););out tags geom;`,
];
const ENDPOINT = 'https://maps.mail.ru/osm/tools/overpass/api/interpreter';
const STAGING = 'tmp/worship/worship-buildings.json', PUBLISHED = 'src/canalRecall/worshipBuildingData.ts';
const EXTRACT = 'public/data/extracts/amsterdam';

type Element = { type: 'node' | 'way' | 'relation'; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; geometry?: { lat: number; lon: number }[]; tags: Record<string, string> };
async function overpass(query: string): Promise<Element[]> {
  const key = new URL(`${ENDPOINT}#body=${encodeURIComponent(new URLSearchParams({ data: query }).toString())}`);
  const stored = await readScrape<{ elements: Element[] }>(key);
  if (stored) return stored.body.elements;
  let last: Error | null = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'map-recall/1.0 (Canal Recall places of worship)' }, body: new URLSearchParams({ data: query }) });
      if (!response.ok) throw new Error(`Overpass ${response.status}`);
      const json = await response.json() as { elements: Element[] };
      await writeScrape(key, json);
      return json.elements;
    } catch (error) {
      last = error as Error;
      console.warn(`  ${last.message}; retrying`);
      await new Promise(resolve => setTimeout(resolve, 5000 * (attempt + 1)));
    }
  }
  throw last ?? new Error('Overpass unavailable');
}

export type WorshipKind = 'church' | 'mosque' | 'synagogue' | 'temple';
function kindOf(tags: Record<string, string>, name = ''): WorshipKind {
  const r = tags.religion ?? '', b = tags.building ?? '', n = `${name} ${tags.name ?? ''}`.toLowerCase();
  if (r === 'muslim' || b === 'mosque' || /moskee|mosque|camii|masjid/.test(n)) return 'mosque';
  if (r === 'jewish' || b === 'synagogue' || /synago|sjoel/.test(n)) return 'synagogue';
  if (['buddhist', 'hindu', 'sikh', 'taoist', 'jain'].includes(r) || b === 'temple' || /tempel|temple|mandir|gurdwara/.test(n)) return 'temple';
  return 'church';
}

const contains = (ring: [number, number][], x: number, y: number) => { let inside = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside; } return inside; };
const areaOf = (ring: [number, number][]) => { let a = 0; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1]; return Math.abs(a / 2); };
/** Share of `ring`'s area (sampled on a grid about `step` metres) that falls inside `other`. */
function shareInside(ring: [number, number][], other: [number, number][], step = 1): number {
  const xs = ring.map(p => p[0]), ys = ring.map(p => p[1]);
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  const s = Math.max(step, span / 120);
  let n = 0, hit = 0;
  for (let x = Math.min(...xs) + s / 2; x < Math.max(...xs); x += s) for (let y = Math.min(...ys) + s / 2; y < Math.max(...ys); y += s) {
    if (!contains(ring, x, y)) continue;
    n++; if (contains(other, x, y)) hit++;
  }
  return n ? hit / n : 0;
}

// --- Tile heights and BAG years -------------------------------------------------------------
const heights = new Map<string, { height: number; tile: string; roofHeight?: number }>();
const tileRoot = `${EXTRACT}/building-tiles/14`;
for (const x of fs.readdirSync(tileRoot)) for (const f of fs.readdirSync(path.join(tileRoot, x))) {
  const bytes = fs.readFileSync(path.join(tileRoot, x, f));
  for (const feature of JSON.parse((bytes[0] === 0x1f ? zlib.gunzipSync(bytes) : bytes).toString()).features) {
    if (Number(feature.properties.minHeight) > 2) continue;
    heights.set(String(feature.properties.id), { height: Number(feature.properties.height), tile: `${x}/${f.replace(/\.geojson(\.gz)?$/, '')}`, roofHeight: Number(feature.properties.roofHeight) || undefined });
  }
}
const years = new Map<string, number>();
const factRoot = `${EXTRACT}/building-facts/14`;
for (const x of fs.readdirSync(factRoot)) for (const f of fs.readdirSync(path.join(factRoot, x))) {
  const bytes = fs.readFileSync(path.join(factRoot, x, f));
  const rows = JSON.parse((bytes[0] === 0x1f ? zlib.gunzipSync(bytes) : bytes).toString()).buildings as Record<string, number[]>;
  for (const [id, row] of Object.entries(rows)) if (row[0] >= 1200 && row[0] <= 2030) years.set(id, row[0]);
}
const yearOf = (id: string) => years.get(shortBuildingId(id)) ?? null;

// --- Landmarks ------------------------------------------------------------------------------
const landmarkBuildings = JSON.parse(fs.readFileSync(`${EXTRACT}/landmark-buildings.json`, 'utf8')).buildings as Record<string, string[]>;
const landmarkIds = new Set(Object.values(landmarkBuildings).flat().map(String));
const listed = new Set<string>(JSON.parse(fs.readFileSync(`${EXTRACT}/monument-gables.json`, 'utf8')).listedLandmarks ?? []);
const landmarks = JSON.parse(fs.readFileSync(`${EXTRACT}/landmarks.json`, 'utf8')) as { id: string; name: string }[];
const WORSHIP_NAME = /kerk|church|kapel|chapel|basiliek|kathedra|moskee|mosque|camii|masjid|synago|sjoel|tempel|temple|klooster|abdij/i;

function treatment(id: string): 'kit' | 'landmark-house' | 'landmark-box' | 'generic' {
  if (HAND_KIT_IDS.has(id) || FRONT_PART_IDS.has(id)) return 'kit';
  if (!landmarkIds.has(id)) return 'generic';
  const h = heights.get(id)?.height ?? NaN, y = yearOf(id);
  return y !== null && y < 1945 && h <= OLD_LANDMARK_MAX_M ? 'landmark-house' : 'landmark-box';
}

// --- Match ----------------------------------------------------------------------------------
const elements = new Map<string, Element>();
for (const query of QUERIES) for (const e of await overpass(query)) elements.set(`${e.type}/${e.id}`, e);
const { byId, near, hostOf } = loadGroundBuildings();

type Row = { id: string; name: string; kind: WorshipKind; source: string; how: string; buildingTag: string; height: number; year: number | null; areaM2: number; tile: string; treatment: string; landmark: boolean; listed: boolean };
const rows = new Map<string, Row>();
const add = (id: string, name: string, kind: WorshipKind, source: string, how: string, buildingTag = '') => {
  const b = byId.get(id), h = heights.get(id);
  if (!b || !h || rows.has(id)) return;
  rows.set(id, { id, name, kind, source, how, buildingTag, height: Math.round(h.height * 10) / 10, year: yearOf(id), areaM2: Math.round(areaOf(b.ring)), tile: h.tile, treatment: treatment(id), landmark: landmarkIds.has(id), listed: listed.has(id) });
};

const nodes: { e: Element; host: string | null; hostArea: number }[] = [];
let siteWays = 0, buildingWays = 0, unmatchedWays: string[] = [];
for (const e of elements.values()) {
  const name = e.tags.name ?? e.tags['name:nl'] ?? '';
  const kind = kindOf(e.tags);
  if (e.type === 'way' && e.geometry?.length) {
    const isBuilding = !!e.tags.building && e.tags.building !== 'no' && !/^(apartments|residential|house|terrace|commercial|retail|office|school|yes_apartments)$/.test(e.tags.building);
    if (!isBuilding) { siteWays++; continue; }
    buildingWays++;
    const ring = e.geometry.map(g => local(g.lon, g.lat));
    // The tile carries the way itself (OSM building) or BAG footprints under it.
    if (byId.has(`w${e.id}`)) { add(`w${e.id}`, name, kind, `way/${e.id}`, 'same way', e.tags.building); continue; }
    const xs = ring.map(p => p[0]), ys = ring.map(p => p[1]);
    const cands = new Set<string>();
    for (let x = Math.min(...xs); x <= Math.max(...xs) + 50; x += 50) for (let y = Math.min(...ys); y <= Math.max(...ys) + 50; y += 50) for (const b of near(x, y)) cands.add(b.id);
    let hit = 0;
    for (const id of cands) {
      const b = byId.get(id)!;
      if (areaOf(b.ring) < 30) continue;
      if (shareInside(b.ring, ring) >= 0.6) { add(id, name, kind, `way/${e.id}`, 'footprint inside way', e.tags.building); hit++; }
    }
    if (!hit) unmatchedWays.push(`way/${e.id} ${name}`);
  } else {
    const lat = e.lat ?? e.center?.lat, lon = e.lon ?? e.center?.lon;
    if (lat === undefined || lon === undefined) continue;
    const [x, y] = local(lon, lat), host = hostOf(x, y, 5);
    nodes.push({ e, host: host?.b.id ?? null, hostArea: host ? Math.round(areaOf(host.b.ring)) : 0 });
  }
}
// Landmarks whose name says worship: every building the landmark resolves to.
for (const l of landmarks) if (WORSHIP_NAME.test(l.name)) for (const id of landmarkBuildings[l.id] ?? []) add(String(id), l.name, kindOf({}, l.name), l.id, 'landmark name', 'landmark');

// --- Report ---------------------------------------------------------------------------------
const all = [...rows.values()].sort((a, b) => b.height * Math.sqrt(b.areaM2) - a.height * Math.sqrt(a.areaM2));
fs.mkdirSync(path.dirname(STAGING), { recursive: true });
fs.writeFileSync(STAGING, JSON.stringify({ generated: new Date().toISOString(), rows: all, nodes: nodes.map(n => ({ osm: `${n.e.type}/${n.e.id}`, name: n.e.tags.name ?? '', kind: kindOf(n.e.tags), host: n.host, hostArea: n.hostArea, hostTreatment: n.host ? treatment(n.host) : null, inRows: !!(n.host && rows.has(n.host)) })) }, null, 1));
const count = (f: (r: Row) => boolean) => all.filter(f).length;
console.log(`${elements.size} OSM elements: ${buildingWays} worship building ways, ${siteWays} site/non-building ways, ${nodes.length} nodes/relations (reported, not applied)`);
console.log(`${all.length} worship footprints: ${count(r => r.treatment === 'kit')} kit, ${count(r => r.treatment === 'landmark-house')} landmark period house front, ${count(r => r.treatment === 'landmark-box')} landmark bare box, ${count(r => r.treatment === 'generic')} generic house front`);
for (const k of ['church', 'mosque', 'synagogue', 'temple'] as const) console.log(`  ${k.padEnd(10)} ${count(r => r.kind === k)}`);
const nodesInRows = nodes.filter(n => n.host && rows.has(n.host)).length;
console.log(`nodes: ${nodesInRows} already on a worship building, ${nodes.filter(n => n.host && !rows.has(n.host)).length} on another footprint (left as is), ${nodes.filter(n => !n.host).length} on none`);
if (unmatchedWays.length) console.log(`ways with no footprint >= 60% inside: ${unmatchedWays.length}\n  ${unmatchedWays.slice(0, 20).join('\n  ')}`);
console.log('\nlargest (height x sqrt area):');
for (const r of all.slice(0, Number(process.env.TOP ?? 60))) console.log(`  ${r.treatment.padEnd(14)} ${r.kind.padEnd(9)} ${String(r.height).padStart(5)} m ${String(r.year ?? '?').padStart(4)} ${String(r.areaM2).padStart(5)} m2 ${r.tile.padEnd(9)} ${r.id.padEnd(30)} ${r.buildingTag.padEnd(9)} ${r.name}`);

// --- The generic treatment ----------------------------------------------------------------
// Applied to OSM worship buildings and worship-named landmark buildings (up to 4000 m2: the OLVG
// hospital resolves from "Onze Lieve Vrouwe Kapel") that no hand-modelled kit claims. Not to
// building=yes ways: those are as often a converted shop, school or garage, whose walls are not
// a church's. EXCLUDED lists footprints checked by hand and left alone.
const WORSHIP_TAG = new RegExp(`^(${WORSHIP_BUILDING})$`);
const EXCLUDED: Record<string, string> = {
  'NL.IMBAG.Pand.0363100012155412': 'de Appel arts centre, named "Tempel" in the landmark list',
  'NL.IMBAG.Pand.0363100012177995': 'a 1718 canal house next to the Fo Guang Shan temple (landmark resolver)',
};
const eligible = (r: Row) => r.treatment !== 'kit' && !EXCLUDED[r.id] && (WORSHIP_TAG.test(r.buildingTag) || (r.buildingTag === 'landmark' && r.areaM2 <= 4000));
const plans = new Map<string, WorshipPlan>();
for (const r of all.filter(eligible)) {
  const rect = fitRect(byId.get(r.id)!.ring, 200);
  plans.set(r.id, planWorship({ heightM: r.height, year: r.year, areaM2: r.areaM2, rect, osmPart: /^w\d+$/.test(r.id), roofHeightM: heights.get(r.id)?.roofHeight }));
}
const applied = all.filter(r => plans.has(r.id));
const modeCount = (m: string) => applied.filter(r => plans.get(r.id)!.mode === m).length;
console.log(`\ngeneric treatment: ${applied.length} footprints (${modeCount('h')} roofed halls with windows, ${modeCount('w')} walled with windows under their flat lid, ${modeCount('b')} plain bodies); was ${['generic', 'landmark-house', 'landmark-box'].map(t => `${applied.filter(r => r.treatment === t).length} ${t}`).join(', ')}`);
console.log(`left alone: ${all.filter(r => r.treatment !== 'kit' && !plans.has(r.id)).length} (building=yes ways, excluded, oversized landmark matches)`);

if (process.argv.includes('--publish')) {
  const KIND_CODE: Record<WorshipKind, string> = { church: 'c', mosque: 'm', synagogue: 's', temple: 't' };
  const lines = applied.sort((a, b) => a.id.localeCompare(b.id)).map(r => {
    const p = plans.get(r.id)!;
    return `  ['${r.id}', '${KIND_CODE[r.kind]}', '${p.mode}', ${p.eavesM}, ${p.riseM}, '${p.era}'], // ${r.name.replace(/[\r\n'\\]/g, ' ').slice(0, 50) || '(unnamed)'}${r.year ? `, ${r.year}` : ''}, ${r.height} m, ${r.areaM2} m2`;
  });
  const text = `// Generated by scripts/build-worship-buildings.ts --publish. Do not edit by hand.
// Worship building footprints (OSM worship building ways and worship-named landmarks) that no
// hand-modelled kit claims, with their generic plan (worshipBuildings.ts planWorship): mode h a
// roofed hall with windows, w windowed walls under the flat lid, b plain walls and a flat lid;
// eaves and roof rise in metres; era o before 1900, e 1900-1959, m 1960 on. Kind: c church,
// m mosque, s synagogue, t temple.
export type WorshipEntry = readonly [id: string, kind: 'c' | 'm' | 's' | 't', mode: 'h' | 'w' | 'b', eavesM: number, riseM: number, era: 'o' | 'e' | 'm'];
export const WORSHIP_BUILDINGS: readonly WorshipEntry[] = [
${lines.join('\n')}
];
`;
  fs.writeFileSync(PUBLISHED, text);
  console.log(`published ${applied.length} footprints -> ${PUBLISHED}`);
}
