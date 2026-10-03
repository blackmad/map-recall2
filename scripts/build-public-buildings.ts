/**
 * Public buildings the generic house generator draws wrongly: large cinemas and theatres, schools
 * (and, when time allows, fire stations, police stations, hospitals and civic offices). Before
 * this every non-landmark building took a house facade (canal gable or period bays, house windows,
 * stoops), so Pathe City (24 m, 1,222 m2) wore a canal front and a 1920s school a row of stoops.
 *
 *   npx tsx scripts/build-public-buildings.ts            # fetch (or reuse), write staging, report
 *   npx tsx scripts/build-public-buildings.ts --publish  # also write src/canalRecall/publicBuildingData.ts
 *
 * Sources: OSM amenity=cinema|theatre|school|fire_station|police|hospital|townhall (Overpass through
 * the maps.mail.ru mirror; every answer kept in the scrape store, one record per query), the
 * building facts' OSM building=school|theatre|hospital|civic|government tags, and the landmark
 * extract (type cinema / music venue, theatre names). An OSM way is matched to the tile footprints
 * at least 60% inside it; a node to the footprint containing it (or within 5 m). A school or
 * theatre *site* polygon (no building tag) is matched to its biggest tagged footprints only.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { readScrape, writeScrape } from './lib/scrapeStore.ts';
import { loadGroundBuildings, local } from './lib/groundBuildings.ts';
import { HAND_KIT_IDS } from '../src/canalRecall/landmarkKits.ts';
import { FRONT_PART_IDS } from '../src/canalRecall/landmarkFrontData.ts';
import { fitRect } from '../src/canalRecall/roofMesh.ts';
import { shortBuildingId, BUILDING_TYPES } from '../src/canalRecall/buildingFacts.ts';
import { WORSHIP_BUILDINGS } from '../src/canalRecall/worshipBuildingData.ts';
import { planPublic, type PublicKind, type PublicPlan } from '../src/canalRecall/publicBuildings.ts';

const BBOX = '52.28,4.75,52.43,5.05';
const AMENITIES = ['cinema', 'theatre', 'school', 'fire_station', 'police', 'hospital', 'townhall'] as const;
const ENDPOINT = 'https://maps.mail.ru/osm/tools/overpass/api/interpreter';
const STAGING = 'tmp/public/public-buildings.json', PUBLISHED = 'src/canalRecall/publicBuildingData.ts';
const EXTRACT = 'public/data/extracts/amsterdam';

type Element = { type: 'node' | 'way' | 'relation'; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; geometry?: { lat: number; lon: number }[]; tags: Record<string, string> };
async function overpass(amenity: string): Promise<Element[]> {
  const query = `[out:json][timeout:90];(nwr["amenity"="${amenity}"](${BBOX}););out center tags geom;`;
  const key = new URL(`${ENDPOINT}#body=${encodeURIComponent(new URLSearchParams({ data: query }).toString())}`);
  const stored = await readScrape<{ elements: Element[] }>(key);
  if (stored) return stored.body.elements;
  let last: Error | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const response = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'map-recall/1.0 (Canal Recall public buildings)' }, body: new URLSearchParams({ data: query }) });
      if (!response.ok) throw new Error(`Overpass ${response.status}`);
      const json = await response.json() as { elements: Element[] };
      await writeScrape(key, json);
      return json.elements;
    } catch (error) {
      last = error as Error;
      console.warn(`  ${amenity}: ${last.message}; retrying`);
      await new Promise(resolve => setTimeout(resolve, 4000 * (attempt + 1)));
    }
  }
  throw last ?? new Error('Overpass unavailable');
}

const contains = (ring: [number, number][], x: number, y: number) => { let inside = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside; } return inside; };
const areaOf = (ring: [number, number][]) => { let a = 0; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1]; return Math.abs(a / 2); };
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

// --- Tile heights, BAG years, OSM building types ---------------------------------------------
const tiles = new Map<string, { height: number; tile: string; roofShape?: string }>();
const tileRoot = `${EXTRACT}/building-tiles/14`;
for (const x of fs.readdirSync(tileRoot)) for (const f of fs.readdirSync(path.join(tileRoot, x))) {
  const bytes = fs.readFileSync(path.join(tileRoot, x, f));
  for (const feature of JSON.parse((bytes[0] === 0x1f ? zlib.gunzipSync(bytes) : bytes).toString()).features) {
    if (Number(feature.properties.minHeight) > 2) continue;
    tiles.set(String(feature.properties.id), { height: Number(feature.properties.height), tile: `${x}/${f.replace(/\.geojson(\.gz)?$/, '')}`, roofShape: feature.properties.roofShape });
  }
}
const years = new Map<string, number>(), types = new Map<string, string>();
const factRoot = `${EXTRACT}/building-facts/14`;
for (const x of fs.readdirSync(factRoot)) for (const f of fs.readdirSync(path.join(factRoot, x))) {
  const bytes = fs.readFileSync(path.join(factRoot, x, f));
  const rows = JSON.parse((bytes[0] === 0x1f ? zlib.gunzipSync(bytes) : bytes).toString()).buildings as Record<string, number[]>;
  for (const [id, row] of Object.entries(rows)) {
    if (row[0] >= 1200 && row[0] <= 2030) years.set(id, row[0]);
    if (row[1] >= 0) types.set(id, BUILDING_TYPES[row[1]]);
  }
}
const yearOf = (id: string) => years.get(shortBuildingId(id)) ?? null;
const typeOf = (id: string) => types.get(shortBuildingId(id)) ?? '';

// --- Landmarks ---------------------------------------------------------------------------------
const landmarkBuildings = JSON.parse(fs.readFileSync(`${EXTRACT}/landmark-buildings.json`, 'utf8')).buildings as Record<string, string[]>;
const landmarks = JSON.parse(fs.readFileSync(`${EXTRACT}/landmarks.json`, 'utf8')) as { id: string; name: string; type: string }[];
const landmarkIds = new Set(Object.values(landmarkBuildings).flat().map(String));
const STAGE_NAME = /theat|bioscoop|cinema|film|path[eé]|kriterion|rialto|lab111|studio\/k|vue\b|the movies|ketelhuis|uitkijk|cavia/i;

const { byId, near, hostOf } = loadGroundBuildings();
type Row = { id: string; name: string; kind: PublicKind; source: string; how: string; height: number; year: number | null; areaM2: number; tile: string; osmType: string; roofShape?: string; landmark: boolean };
const rows = new Map<string, Row>();
const SKIP_TYPES = new Set(['apartments', 'residential', 'house', 'terrace', 'detached', 'semidetached_house', 'dormitory']);
const add = (id: string, name: string, kind: PublicKind, source: string, how: string) => {
  const b = byId.get(id), t = tiles.get(id);
  if (!b || !t || rows.has(id) || HAND_KIT_IDS.has(id) || FRONT_PART_IDS.has(id)) return;
  rows.set(id, { id, name, kind, source, how, height: Math.round(t.height * 10) / 10, year: yearOf(id), areaM2: Math.round(areaOf(b.ring)), tile: t.tile, osmType: typeOf(id), roofShape: t.roofShape, landmark: landmarkIds.has(id) });
};
const KIND_OF: Record<string, PublicKind> = { cinema: 'c', theatre: 'c', school: 's', fire_station: 'f', police: 'p', hospital: 'h', townhall: 'o' };

const nodeReport: { osm: string; name: string; amenity: string; host: string | null; hostArea: number }[] = [];
for (const amenity of AMENITIES) {
  const kind = KIND_OF[amenity];
  for (const e of await overpass(amenity)) {
    const name = e.tags.name ?? e.tags['name:nl'] ?? '';
    if (e.type === 'way' && e.geometry?.length) {
      const bt = e.tags.building;
      const isBuilding = !!bt && bt !== 'no' && !SKIP_TYPES.has(bt);
      const ring = e.geometry.map(g => local(g.lon, g.lat));
      if (byId.has(`w${e.id}`)) { add(`w${e.id}`, name, kind, `way/${e.id}`, 'same way'); continue; }
      const xs = ring.map(p => p[0]), ys = ring.map(p => p[1]);
      const cands = new Set<string>();
      for (let x = Math.min(...xs); x <= Math.max(...xs) + 50; x += 50) for (let y = Math.min(...ys); y <= Math.max(...ys) + 50; y += 50) for (const b of near(x, y)) cands.add(b.id);
      const inside = [...cands].filter(id => areaOf(byId.get(id)!.ring) >= 30 && shareInside(byId.get(id)!.ring, ring) >= 0.6);
      if (isBuilding) { for (const id of inside) add(id, name, kind, `way/${e.id}`, 'footprint inside building way'); continue; }
      // A site polygon: only the footprints OSM itself types as this use, or the biggest one when it is a school-sized block.
      for (const id of inside) {
        const ty = typeOf(id);
        const own = (amenity === 'school' && ty === 'school') || (amenity === 'hospital' && ty === 'hospital') || ((amenity === 'cinema' || amenity === 'theatre') && ty === 'theatre');
        if (own) add(id, name, kind, `site/${e.id}`, 'typed footprint in site');
      }
    } else {
      const lat = e.lat ?? e.center?.lat, lon = e.lon ?? e.center?.lon;
      if (lat === undefined || lon === undefined) continue;
      const [x, y] = local(lon, lat), host = hostOf(x, y, 5);
      nodeReport.push({ osm: `${e.type}/${e.id}`, name, amenity, host: host?.b.id ?? null, hostArea: host ? Math.round(areaOf(host.b.ring)) : 0 });
      if (host && !SKIP_TYPES.has(typeOf(host.b.id))) add(host.b.id, name, kind, `${e.type}/${e.id}`, `node ${host.how}`);
    }
  }
}
// OSM building=school|theatre|hospital|civic|government footprints with no amenity tag of their own.
for (const [id] of byId) {
  const ty = typeOf(id);
  const kind: PublicKind | null = ty === 'school' ? 's' : ty === 'theatre' ? 'c' : ty === 'hospital' ? 'h' : ty === 'civic' || ty === 'government' ? 'o' : null;
  if (kind) add(id, '', kind, 'building tag', ty);
}
for (const l of landmarks) if (l.type === 'cinema' || l.type === 'music venue' || STAGE_NAME.test(l.name)) for (const id of landmarkBuildings[l.id] ?? []) add(String(id), l.name, 'c', l.id, `landmark ${l.type}`);

const all = [...rows.values()].sort((a, b) => b.areaM2 - a.areaM2);

// --- The treatment -----------------------------------------------------------------------------
// EXCLUDED lists footprints checked by hand and left alone.
const EXCLUDED: Record<string, string> = {
  'w754269611': 'Concertgebouw: a concert hall with a monumental front, not a film house',
  'w754269604': 'Concertgebouw part', 'w754269606': 'Concertgebouw part', 'w754269607': 'Concertgebouw part',
  'NL.IMBAG.Pand.0363100012168738': 'Stadsschouwburg: Neo-Renaissance front, kept as the landmark box',
  'NL.IMBAG.Pand.0363100012173457': 'Stadsschouwburg annex',
  'w755464132': 'Muziekgebouw aan het IJ: glass and aluminium concert hall',
  'w751559658': 'Stopera (Opera & Ballet): a town hall complex',
  'NL.IMBAG.Pand.0363100012168465': 'Frascati: a block of canal houses on the Nes with a theatre inside',
  'NL.IMBAG.Pand.0363100012154874': 'Het Sieraad: an events venue in the 1924 Postjesgebouw, not a school',
};
const WORSHIP_IDS = new Set(WORSHIP_BUILDINGS.map(e => e[0]));
// A shop, office or warehouse that merely holds a school or theatre keeps its own front.
const HOST_OTHER_USE = /^(retail|commercial|office|hotel|warehouse|industrial|church|chapel|cathedral|mosque|synagogue|temple|university|college)$/;
const plans = new Map<string, PublicPlan>();
for (const r of all) {
  if (EXCLUDED[r.id] || WORSHIP_IDS.has(r.id)) continue;
  if (r.how.startsWith('node') && !r.landmark && HOST_OTHER_USE.test(r.osmType)) continue;
  const rect = fitRect(byId.get(r.id)!.ring, 200);
  const plan = planPublic({ kind: r.kind, heightM: r.height, year: r.year, areaM2: r.areaM2, rect, roofShape: r.roofShape, osmPart: /^w\d+$/.test(r.id) });
  if (plan) plans.set(r.id, plan);
}
const applied = all.filter(r => plans.has(r.id));
fs.mkdirSync(path.dirname(STAGING), { recursive: true });
fs.writeFileSync(STAGING, JSON.stringify({ generated: new Date().toISOString(), rows: all.map(r => ({ ...r, plan: plans.get(r.id) ?? null })), nodes: nodeReport }, null, 1));

const KIND_NAME: Record<PublicKind, string> = { c: 'cinema/theatre', s: 'school', f: 'fire station', p: 'police', h: 'hospital', o: 'civic office' };
console.log(`${all.length} public footprints matched; ${applied.length} get the treatment`);
for (const k of Object.keys(KIND_NAME) as PublicKind[]) {
  const m = all.filter(r => r.kind === k), a = m.filter(r => plans.has(r.id));
  console.log(`  ${KIND_NAME[k].padEnd(15)} ${String(m.length).padStart(4)} matched, ${String(a.length).padStart(4)} treated (${a.filter(r => r.landmark).length} landmark) ${['p', 'f', 'h'].map(mode => `${a.filter(r => plans.get(r.id)!.mode === mode).length} ${mode}`).join(', ')}`);
}
const list = process.env.LIST;
if (list) for (const r of all.filter(r => r.kind === list)) {
  const p = plans.get(r.id);
  console.log(`  ${p ? `${p.mode} ${p.era}` : '-  -'} ${String(r.height).padStart(5)} m ${String(r.year ?? '?').padStart(4)} ${String(r.areaM2).padStart(5)} m2 ${r.tile.padEnd(9)} ${r.id.slice(-22)} ${r.osmType.padEnd(8)} ${r.roofShape ?? ''} ${r.landmark ? 'LM' : '  '} ${r.name} (${r.how})`);
}

if (process.argv.includes('--publish')) {
  const lines = applied.sort((a, b) => a.id.localeCompare(b.id)).map(r => {
    const p = plans.get(r.id)!;
    return `  ['${r.id}', '${r.kind}', '${p.mode}', ${p.eavesM}, ${p.riseM}, '${p.era}'], // ${r.name.replace(/[\r\n'\\]/g, ' ').slice(0, 50) || '(unnamed)'}${r.year ? `, ${r.year}` : ''}, ${r.height} m, ${r.areaM2} m2`;
  });
  const text = `// Generated by scripts/build-public-buildings.ts --publish. Do not edit by hand.
// Public building footprints (cinemas and theatres, schools, fire and police stations, hospitals,
// civic offices) with their generic plan (publicBuildings.ts planPublic): mode p plain walls and a
// flat lid, f large classroom windows under a flat lid, h the same under a fitted pitched roof;
// eaves and roof rise in metres; era o before 1930, e 1930-1959, m 1960 on. Kind: c cinema or
// theatre, s school, f fire station, p police, h hospital, o civic office.
export type PublicEntry = readonly [id: string, kind: 'c' | 's' | 'f' | 'p' | 'h' | 'o', mode: 'p' | 'f' | 'h', eavesM: number, riseM: number, era: 'o' | 'e' | 'm'];
export const PUBLIC_BUILDINGS: readonly PublicEntry[] = [
${lines.join('\n')}
];
`;
  fs.writeFileSync(PUBLISHED, text);
  console.log(`published ${applied.length} footprints -> ${PUBLISHED}`);
}
