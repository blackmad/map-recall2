/**
 * Every address in the boundary, with its own point, keyed to its pand.
 *
 * `fetch-addresses.ts` answers "what is this building called", and keeps one
 * label per pand plus a count of the others. That is the right shape for a
 * caption and the wrong shape for evidence: to check a house number read off a
 * photograph you need the whole set a pand carries, and to place that number in
 * the world you need its own coordinate, not the building's centroid.
 *
 * Locatieserver does not index `pandid`, so a building cannot be asked for its
 * addresses directly. Instead the boundary is covered with a grid of reverse
 * queries — 100 rows reaches about 59 m even in the densest canal terrace, so a
 * 35 m grid leaves no gap — and every address point returned is then assigned to
 * the footprint that contains it. Address points that fall in no footprint are
 * kept and marked: a coach house, a courtyard entrance or a point placed just
 * outside its own wall is not an error to be discarded, and the OCR matcher
 * needs to know they exist before it claims a number belongs to the neighbour.
 *
 * Usage: npx tsx scripts/facade-twin/fetch-address-points.ts [--spacing=35]
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { AMSTERDAM_GRACHTENGORDEL_WEST as AREA } from '../../src/canalRecall/facade/areas.ts';
import { RD_NEW } from '../../src/canalRecall/facade/sources/netherlands.ts';
import type { LngLat } from '../../src/canalRecall/facade/sources.ts';

const ENDPOINT = 'https://api.pdok.nl/bzk/locatieserver/search/v3_1';
const CACHE = path.resolve('.cache/facade-twin');
const arg = (n: string) => process.argv.find(v => v.startsWith(`--${n}=`))?.slice(n.length + 3);
const SPACING = Number(arg('spacing') ?? 35);

const registry = JSON.parse(await readFile(path.join(CACHE, `${AREA.areaId}-registry.json`), 'utf8')).data as
  Array<{ buildingId: string; footprintLngLat: LngLat[] }>;

const rings = new Map<string, LngLat[]>();
for (const e of registry) if (!rings.has(e.buildingId)) rings.set(e.buildingId, e.footprintLngLat);

let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;
for (const ring of rings.values()) for (const [x, y] of ring) {
  west = Math.min(west, x); east = Math.max(east, x);
  south = Math.min(south, y); north = Math.max(north, y);
}

const M_PER_DEG_LAT = 111_320;
const mPerDegLon = M_PER_DEG_LAT * Math.cos(((south + north) / 2) * Math.PI / 180);
const stepLat = SPACING / M_PER_DEG_LAT, stepLon = SPACING / mPerDegLon;

interface AddressPoint {
  nummeraanduidingId: string;
  street: string;
  houseNumber: number;
  letter: string | null;
  suffix: string | null;
  /** As written on a doorplate: the number, then any letter. */
  display: string;
  postcode: string | null;
  lngLat: LngLat;
  pandId: string | null;
}

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const found = new Map<string, AddressPoint>();
const centres: LngLat[] = [];
for (let lat = south; lat <= north + stepLat; lat += stepLat)
  for (let lng = west; lng <= east + stepLon; lng += stepLon) centres.push([lng, lat]);

console.log(`${centres.length} reverse queries on a ${SPACING} m grid over ${(east - west) * mPerDegLon | 0} × ${(north - south) * M_PER_DEG_LAT | 0} m`);
let done = 0, failures = 0;
for (const [lng, lat] of centres) {
  const url = `${ENDPOINT}/reverse?lat=${lat.toFixed(7)}&lon=${lng.toFixed(7)}&type=adres&rows=100`
    + `&fl=weergavenaam,straatnaam,huisnummer,huisletter,huisnummertoevoeging,postcode,centroide_ll,nummeraanduiding_id`;
  let docs: any[] | null = null;
  for (let attempt = 0; attempt < 4 && docs === null; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (response.ok) docs = (await response.json())?.response?.docs ?? [];
      else if (response.status < 500 && response.status !== 429) break;
    } catch { /* retry */ }
    if (docs === null) await wait(500 * 2 ** attempt);
  }
  if (docs === null) { failures++; continue; }
  for (const doc of docs) {
    const id = doc.nummeraanduiding_id;
    if (!id || found.has(id)) continue;
    const m = /POINT\(([-\d.]+) ([-\d.]+)\)/.exec(doc.centroide_ll ?? '');
    if (!m) continue;
    const point: LngLat = [Number(m[1]), Number(m[2])];
    if (point[0] < west - stepLon || point[0] > east + stepLon
      || point[1] < south - stepLat || point[1] > north + stepLat) continue;
    const letter = doc.huisletter ?? null;
    found.set(id, {
      nummeraanduidingId: id,
      street: doc.straatnaam ?? '',
      houseNumber: Number(doc.huisnummer),
      letter,
      suffix: doc.huisnummertoevoeging ?? null,
      display: `${doc.huisnummer}${letter ?? ''}`,
      postcode: doc.postcode ?? null,
      lngLat: point,
      pandId: null,
    });
  }
  done++;
  if (done % 25 === 0) process.stdout.write(`\r  ${done}/${centres.length} — ${found.size} addresses`);
}
process.stdout.write(`\r  ${done}/${centres.length} — ${found.size} addresses\n`);
if (failures) console.log(`  ${failures} grid cells failed after retries`);

// ---- assign each address point to the footprint that contains it ----------

const inside = (point: LngLat, ring: LngLat[]) => {
  let within = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > point[1]) !== (yj > point[1])
      && point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi) within = !within;
  }
  return within;
};

// Bucket footprints by their bounding box so this is not 15,000 × 3,000 tests.
const CELL = 0.0006;                                   // roughly 40 m
const buckets = new Map<string, string[]>();
const boxes = new Map<string, [number, number, number, number]>();
for (const [pandId, ring] of rings) {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const [x, y] of ring) { w = Math.min(w, x); e = Math.max(e, x); s = Math.min(s, y); n = Math.max(n, y); }
  boxes.set(pandId, [w, s, e, n]);
  for (let cx = Math.floor(w / CELL); cx <= Math.floor(e / CELL); cx++)
    for (let cy = Math.floor(s / CELL); cy <= Math.floor(n / CELL); cy++) {
      const k = `${cx}:${cy}`;
      (buckets.get(k) ?? buckets.set(k, []).get(k)!).push(pandId);
    }
}

let assigned = 0, orphaned = 0;
for (const address of found.values()) {
  const [x, y] = address.lngLat;
  const candidates = buckets.get(`${Math.floor(x / CELL)}:${Math.floor(y / CELL)}`) ?? [];
  for (const pandId of candidates) {
    const box = boxes.get(pandId)!;
    if (x < box[0] || x > box[2] || y < box[1] || y > box[3]) continue;
    if (!inside(address.lngLat, rings.get(pandId)!)) continue;
    address.pandId = pandId;
    break;
  }
  if (address.pandId) assigned++; else orphaned++;
}

const byPand = new Map<string, number>();
for (const a of found.values()) if (a.pandId) byPand.set(a.pandId, (byPand.get(a.pandId) ?? 0) + 1);
const rd = [...found.values()].map(a => ({ ...a, rd: RD_NEW.fromLngLat(a.lngLat) }));

const out = path.join(CACHE, 'address-points.json');
await writeFile(out, JSON.stringify({
  metadata: {
    generatedAt: new Date().toISOString(),
    generator: 'scripts/facade-twin/fetch-address-points.ts',
    source: 'PDOK Locatieserver v3_1 reverse, type=adres',
    gridSpacingM: SPACING,
    queries: centres.length,
    failedQueries: failures,
    note: 'Every address point in the boundary, keyed to the footprint containing it. '
      + 'pandId is null where the point falls outside every footprint — a coach house, a '
      + 'courtyard entrance, or a point placed just outside its own wall. Those are kept, not '
      + 'discarded: a matcher that does not know they exist will hand their number to a neighbour.',
  },
  counts: { addresses: found.size, assigned, orphaned, pandenWithAddresses: byPand.size },
  addresses: rd,
}, null, 1));

console.log(`\n${found.size} addresses — ${assigned} inside a footprint, ${orphaned} outside any`);
console.log(`${byPand.size} panden carry at least one; median ${[...byPand.values()].sort((a, b) => a - b)[Math.floor(byPand.size / 2)]} per pand`);
console.log(`→ ${path.relative(process.cwd(), out)}`);
