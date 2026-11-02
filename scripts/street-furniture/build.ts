// Street-furniture extract (lane #170): raw cache (fetch.ts) → staging → versioned extract.
//
//   npx tsx scripts/street-furniture/build.ts             # write artifacts/street-furniture/staging/ and print coverage
//   npx tsx scripts/street-furniture/build.ts --publish   # also copy staging into public/data/extracts/amsterdam/street-furniture/
//
// One record per object: id, kind, subtype, lng/lat (7 dp), heading (kerb axis, compass degrees 0-180, from the
// nearest street centreline), facing (compass bearing from the object to that street), road (its OSM highway class),
// cluster (containers: the municipal clusterId), fraction (containers), volume (containers, m3).
// The sources carry no orientation; heading/facing are derived from streets-routing.json and are a documented prior.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, cpSync, statSync, writeFileSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
import proj4 from 'proj4';
import { AMS, BGT, CONTAINER_FIELDS, RAW } from './fetch.ts';
import { CITY_BOX, FURNITURE_ZOOM, tileKeyOf, type FurnitureRecord, BGT_KIND, containerSubtype, insideBox } from '../../src/canalRecall/streetFurniture/extract.ts';
import { CARRIAGEWAY_HIGHWAYS, StreetIndex, type StreetLine } from '../../src/canalRecall/streetFurniture/streetIndex.ts';

export const STAGING = 'artifacts/street-furniture/staging';
export const PUBLISHED = 'public/data/extracts/amsterdam/street-furniture';
const RD = '+proj=sterea +lat_0=52.15616055555555 +lon_0=5.38763888888889 +k=0.9999079 +x_0=155000 +y_0=463000 +ellps=bessel +towgs84=565.4171,50.3319,465.5524,-0.398957,0.343988,-1.8774,4.0725 +units=m +no_defs';

const gz = (f: string) => JSON.parse(gunzipSync(readFileSync(f)).toString());
const amsRows = (name: string): any[] => readdirSync(`${RAW}/amsterdam/${name}`).sort((a, b) => parseInt(a.slice(5)) - parseInt(b.slice(5))).flatMap(f => gz(`${RAW}/amsterdam/${name}/${f}`)._embedded[name]);
const r7 = (v: number) => Math.round(v * 1e7) / 1e7;

export function buildRecords(): { records: FurnitureRecord[]; rejected: Record<string, number>; skippedTypes: Record<string, number> } {
  const rejected: Record<string, number> = {}, skippedTypes: Record<string, number> = {};
  const reject = (why: string) => { rejected[why] = (rejected[why] ?? 0) + 1; };
  const lines = JSON.parse(readFileSync('public/data/extracts/amsterdam/streets-routing.json', 'utf8')) as StreetLine[];
  // A carriageway within 20 m wins over a nearer separate cycle track or footway (their classes say nothing of the street).
  const carriageways = new StreetIndex(lines, CARRIAGEWAY_HIGHWAYS), streets = new StreetIndex(lines);
  const out: FurnitureRecord[] = [];
  const orient = (r: FurnitureRecord) => {
    const s = carriageways.nearest(r.lng, r.lat, 20) ?? streets.nearest(r.lng, r.lat, 30);
    if (s) { r.heading = Math.round(s.axisDeg); r.facing = Math.round(s.towardDeg); r.road = s.highway; }
  };
  // Containers
  const types = new Map(amsRows('containertype').map((t: any) => [t.id, t]));
  for (const c of amsRows('container')) {
    if (c.status === 0) { reject('container: inactive (status 0, removed or replaced)'); continue; }
    if (c.status === 2) { reject('container: planned (status 2)'); continue; }
    if (c.geometrie?.type !== 'Point') { reject('container: no geometry'); continue; }
    const t = types.get(c.typeId);
    if (t?.containertypeContainerType !== 'UNDERGROUND') { reject(`container: ${t?.containertypeContainerType ?? 'unknown type'} (not an underground container top)`); continue; }
    const [lng, lat] = proj4(RD, 'EPSG:4326', c.geometrie.coordinates).map(r7);
    if (!insideBox(lng, lat)) { reject('container: outside the city box'); continue; }
    const r: FurnitureRecord = { id: `afval-${c.id}`, kind: 'container', subtype: containerSubtype(c.fractieOmschrijving), lng, lat, cluster: c.clusterId ?? `loc-${c.locatieId}`, fraction: c.fractieOmschrijving ?? null, volume: Number.isFinite(t.volumeM3) ? t.volumeM3 : null };
    orient(r); out.push(r);
  }
  // Row direction: a cluster of two or more lies along its own principal axis (the measured positions), not the street's.
  const clusters = new Map<string, FurnitureRecord[]>();
  for (const r of out) if (r.cluster) (clusters.get(r.cluster) ?? clusters.set(r.cluster, []).get(r.cluster)!).push(r);
  for (const rows of clusters.values()) {
    if (rows.length < 2) continue;
    const kx = 111320 * Math.cos(rows[0].lat * Math.PI / 180), ky = 110540;
    const mx = rows.reduce((s, r) => s + r.lng, 0) / rows.length, my = rows.reduce((s, r) => s + r.lat, 0) / rows.length;
    let sxx = 0, syy = 0, sxy = 0;
    for (const r of rows) { const x = (r.lng - mx) * kx, y = (r.lat - my) * ky; sxx += x * x; syy += y * y; sxy += x * y; }
    if (sxx + syy < 0.25) continue; // coincident: keep the street axis
    const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy); // from east, counter-clockwise
    const compass = ((90 - angle * 180 / Math.PI) % 180 + 180) % 180;
    for (const r of rows) r.heading = Math.round(compass);
  }
  // BGT. A grid of the register's containers, to drop the BGT points that mark the same sites.
  const KX = 111320 * Math.cos(52.37 * Math.PI / 180), KY = 110540, grid = new Map<string, [number, number][]>();
  for (const r of out) { const x = r.lng * KX, y = r.lat * KY, k = `${Math.floor(x / 5)},${Math.floor(y / 5)}`; (grid.get(k) ?? grid.set(k, []).get(k)!).push([x, y]); }
  const nearContainer = (lng: number, lat: number, m: number) => {
    const x = lng * KX, y = lat * KY, gx = Math.floor(x / 5), gy = Math.floor(y / 5);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const q of grid.get(`${gx + i},${gy + j}`) ?? []) if (Math.hypot(x - q[0], y - q[1]) < m) return true;
    return false;
  };
  for (const collection of ['paal', 'bak', 'straatmeubilair']) {
    const seen = new Set<string>();
    for (const f of readdirSync(`${RAW}/bgt/${collection}`)) for (const x of gz(`${RAW}/bgt/${collection}/${f}`)) {
      const p = x.properties, id = p.lokaal_id ?? x.id;
      if (seen.has(id)) continue; seen.add(id);
      // PDOK serves ended object versions too: those are history, not furniture that stands today.
      if (p.eind_registratie) { reject(`${collection}: an ended BGT registration (an older version)`); continue; }
      const kind = BGT_KIND[collection]?.[p.plus_type ?? ''];
      if (!kind) { skippedTypes[`${collection}/${p.plus_type ?? 'null'}`] = (skippedTypes[`${collection}/${p.plus_type ?? 'null'}`] ?? 0) + 1; continue; }
      if (p.status && p.status !== 'bestaand') { reject(`${kind}: status ${p.status}`); continue; }
      if (x.geometry?.type !== 'Point') { reject(`${kind}: not a point`); continue; }
      const [lng, lat] = x.geometry.coordinates.map(r7);
      if (!insideBox(lng, lat)) { reject(`${kind}: outside the city box`); continue; }
      const r: FurnitureRecord = { id: `bgt-${id}`, kind, subtype: kind === 'container' ? 'unknown' : p.plus_type, lng, lat };
      if (kind === 'container') {
        // BGT `afvalbak` rows are underground-container columns (16 of 16 panorama views, sample-bin*.jpg), mostly
        // housing-corporation sites the municipal register does not list. One within 5 m of a register container is that one.
        if (nearContainer(lng, lat, 5)) { reject('container (BGT afvalbak): within 5 m of a register container'); continue; }
        r.cluster = `bgt-${id}`; r.fraction = null;
      }
      orient(r);
      out.push(r);
    }
  }
  // Lamp subtype from the street it lights (documented prior, lamps.ts lampStyle).
  return { records: out, rejected, skippedTypes };
}

async function main(): Promise<void> {
  const publish = process.argv.includes('--publish');
  const { records, rejected, skippedTypes } = buildRecords();
  const { finishRecords } = await import('../../src/canalRecall/streetFurniture/extract.ts');
  finishRecords(records, JSON.parse(readFileSync('public/data/extracts/amsterdam/boundaries.json', 'utf8')));
  const tiles = new Map<string, FurnitureRecord[]>();
  for (const r of records.sort((a, b) => a.id.localeCompare(b.id))) { const k = tileKeyOf(r.lng, r.lat); (tiles.get(k) ?? tiles.set(k, []).get(k)!).push(r); }
  rmSync(STAGING, { recursive: true, force: true });
  mkdirSync(`${STAGING}/tiles`, { recursive: true });
  const list: { key: string; url: string; count: number; bytes: number }[] = [];
  for (const [key, items] of [...tiles].sort((a, b) => a[0].localeCompare(b[0]))) {
    const file = `${key.replaceAll('/', '-')}.json.gz`, bytes = gzipSync(JSON.stringify({ version: 1, key, items }), { level: 9 });
    writeFileSync(`${STAGING}/tiles/${file}`, bytes);
    list.push({ key, url: `tiles/${file}`, count: items.length, bytes: bytes.length });
  }
  const counts: Record<string, Record<string, number>> = {};
  for (const r of records) { const k = counts[r.kind] ??= {}; k[r.subtype] = (k[r.subtype] ?? 0) + 1; }
  const index = {
    version: 1, zoom: FURNITURE_ZOOM,
    source: 'Gemeente Amsterdam huishoudelijkafval (underground containers) and BGT via PDOK (paal, bak, straatmeubilair)',
    sourceUrl: 'https://api.data.amsterdam.nl/v1/docs/datasets/huishoudelijkafval.html',
    sources: {
      containers: { apiUrl: `${AMS}/container/?_format=json&_pageSize=5000&_fields=${CONTAINER_FIELDS}`, typesUrl: `${AMS}/containertype/?_format=json&_pageSize=5000`, licence: 'Openbaar, tenzij anders aangegeven / behoudens uitzonderingen', owner: 'Gemeente Amsterdam, Directie Afval en Grondstoffen' },
      bgt: { apiUrl: `${BGT}/{paal,bak,straatmeubilair}/items?f=json&limit=1000&bbox=<1 km own-ground cell>`, licence: 'CC0 1.0', owner: 'Kadaster / bronhouders, Basisregistratie Grootschalige Topografie' },
      streets: { file: 'public/data/extracts/amsterdam/streets-routing.json', use: 'heading/facing/road: the nearest street centreline within 30 m (a prior; the registers carry no orientation)' },
    },
    licence: 'Containers: openbaar, tenzij anders aangegeven; BGT: CC0 1.0',
    retrievedAt: new Date(Math.max(...readdirSync(`${RAW}/amsterdam/container`).map(f => statSync(`${RAW}/amsterdam/container/${f}`).mtimeMs))).toISOString(),
    cityBox: CITY_BOX,
    headingMeaning: 'heading = kerb axis (compass degrees, 0-180) of the nearest street centreline, or a container cluster\'s own principal axis; facing = compass bearing from the object to that street. Absent when no street lies within 30 m.',
    lampMeaning: 'Lamp subtype is a documented prior (src/canalRecall/streetFurniture/extract.ts lampStyle): the classic hooked mast inside stadsdeel Centrum on residential/living/pedestrian/service streets, the straight modern pole elsewhere; lamp height comes from the road class (models.ts LAMP_HEIGHT_BY_ROAD).',
    total: records.length, counts, rejected, skippedTypes,
    tiles: list,
  };
  writeFileSync(`${STAGING}/index.json`, JSON.stringify(index, null, 2) + '\n');
  console.log(JSON.stringify({ total: records.length, tiles: list.length, bytes: list.reduce((s, t) => s + t.bytes, 0), counts, rejected, skippedTypes }, null, 2));
  if (publish) {
    rmSync(PUBLISHED, { recursive: true, force: true });
    cpSync(STAGING, PUBLISHED, { recursive: true });
    console.log(`published ${PUBLISHED}`);
  } else if (existsSync(`${PUBLISHED}/index.json`)) {
    const old = JSON.parse(readFileSync(`${PUBLISHED}/index.json`, 'utf8'));
    console.log(`diff vs published: total ${old.total} -> ${records.length}, tiles ${old.tiles.length} -> ${list.length}`);
  }
}

if (process.argv[1]?.endsWith('build.ts')) void main();
