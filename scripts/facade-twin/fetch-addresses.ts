/**
 * An address for every building, so a person can say which house this is.
 *
 * The pilot has been keyed on BAG `pand_id` throughout, which is correct —
 * it is the only stable identity a Dutch building has, and addresses are
 * attached to dwellings rather than to buildings, so a canal house that has
 * been split into four flats has four of them. But `0363100012164989` cannot be
 * checked by a human, cannot be looked up on a listing site, and cannot be
 * walked to. Every review task this project needs starts with knowing that it
 * is Herengracht 270.
 *
 * `pand_id` stays canonical. The address is a label on top of it, and where a
 * building has several the shortest street-and-number is used, with the count
 * kept so the panel can say "and 3 more".
 *
 * PDOK's Locatieserver is the same public service the coordinate fixtures came
 * from. Results are cached, because this is 3,025 requests and none of them
 * will change.
 *
 * Usage: npx tsx scripts/facade-twin/fetch-addresses.ts [--limit=N] [--force]
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { AMSTERDAM_GRACHTENGORDEL_WEST as AREA } from '../../src/canalRecall/facade/areas.ts';
import { RD_NEW } from '../../src/canalRecall/facade/sources/netherlands.ts';
import type { LngLat } from '../../src/canalRecall/facade/sources.ts';

const CACHE = path.resolve('.cache/facade-twin');
const STAGING = path.resolve('public/data/extracts/amsterdam/staging/facade-twin', AREA.areaId);
const FILE = path.join(CACHE, 'addresses.json');
const arg = (name: string) => process.argv.find(v => v.startsWith(`--${name}=`))?.slice(name.length + 3);
const ENDPOINT = 'https://api.pdok.nl/bzk/locatieserver/search/v3_1';

interface Address {
  pandId: string; label: string; street: string; number: string;
  postcode: string | null;
  /** Other addresses inside this same footprint — the house is flats. */
  others: number;
  /** False when no address point fell inside the footprint and the nearest was
   *  taken instead, so the label may be the neighbour's. */
  exact: boolean;
}

const registry = JSON.parse(await readFile(path.join(CACHE, `${AREA.areaId}-registry.json`), 'utf8')).data as
  Array<{ buildingId: string; footprintLngLat: LngLat[] }>;

const centroids = new Map<string, LngLat>();
for (const entry of registry) {
  if (centroids.has(entry.buildingId)) continue;
  const points = entry.footprintLngLat;
  let x = 0, y = 0;
  for (const p of points) { x += p[0]; y += p[1]; }
  centroids.set(entry.buildingId, [x / points.length, y / points.length]);
}

let known: Record<string, Address> = {};
if (!process.argv.includes('--force')) {
  try { known = JSON.parse(await readFile(FILE, 'utf8')).addresses; } catch { /* first run */ }
}

/**
 * The addresses on a building, by asking what is inside its footprint.
 *
 * Reverse geocoding a centroid returns the nearest address, which on a terrace
 * of five-metre plots is often the neighbour's. Querying by the building's own
 * `pandid` would be exact, but Locatieserver does not index that field — it
 * returns "undefined field pandid". So: a small radius search around the
 * centroid, then keep the addresses whose own point falls inside this
 * building's footprint, which the registry gave us exactly.
 */
async function addressesFor(pandId: string, centre: LngLat, ring: LngLat[]): Promise<Address | null> {
  // `reverse` is the only endpoint that takes a point — the free endpoint
  // rejects `pt` outright, and Locatieserver does not index `pandid`, so the
  // building cannot be asked for its own addresses directly. Ask for the
  // nearest two dozen and keep the ones that land inside this footprint, which
  // the registry gave us exactly. On a terrace of five-metre plots the nearest
  // address is frequently the neighbour's, so "nearest" is not good enough.
  const url = `${ENDPOINT}/reverse?lat=${centre[1]}&lon=${centre[0]}&type=adres&rows=25`
    + `&fl=weergavenaam,straatnaam,huisnummer,huisletter,huisnummertoevoeging,postcode,centroide_ll,afstand`;
  let docs: any[];
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) return null;
    docs = (await response.json())?.response?.docs ?? [];
  } catch { return null; }
  if (!docs.length) return null;

  const inside = (point: LngLat) => {
    let within = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((yi > point[1]) !== (yj > point[1])
        && point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi) within = !within;
    }
    return within;
  };

  const parsed = docs.map(doc => {
    const m = /POINT\(([-\d.]+) ([-\d.]+)\)/.exec(doc.centroide_ll ?? '');
    return { doc, point: m ? ([Number(m[1]), Number(m[2])] as LngLat) : null };
  }).filter((p): p is { doc: any; point: LngLat } => p.point !== null);

  let hits = parsed.filter(p => inside(p.point));
  let exact = true;
  if (!hits.length) {
    // No address point inside the footprint: a warehouse, a church, a coach
    // house, or an address point placed just outside its own building. Fall
    // back to the nearest and mark it approximate, so a reviewer knows the
    // label may belong to next door.
    exact = false;
    hits = parsed.slice(0, 1);
    if (!hits.length) return null;
  }
  // Several addresses means the house is flats. The shortest label is the plain
  // street-and-number; keep that and count the rest.
  const best = hits.map(h => h.doc).sort((a, b) =>
    String(a.weergavenaam).length - String(b.weergavenaam).length)[0];
  return {
    pandId,
    label: String(best.weergavenaam),
    street: String(best.straatnaam ?? ''),
    number: `${best.huisnummer ?? ''}${best.huisletter ?? ''}${best.huisnummertoevoeging ? '-' + best.huisnummertoevoeging : ''}`,
    postcode: best.postcode ?? null,
    others: Math.max(0, hits.length - 1),
    exact,
  };
}

const rings = new Map<string, LngLat[]>();
for (const entry of registry) if (!rings.has(entry.buildingId)) rings.set(entry.buildingId, entry.footprintLngLat);

const limit = Number(arg('limit') ?? 0);
const all = [...centroids.keys()].sort();
const queue = (limit ? all.slice(0, limit) : all).filter(id => !known[id]);
console.log(`${all.length} buildings, ${Object.keys(known).length} already known, ${queue.length} to fetch`);

let found = 0, missed = 0;
const CONCURRENCY = 6;
for (let i = 0; i < queue.length; i += CONCURRENCY) {
  const batch = queue.slice(i, i + CONCURRENCY);
  const results = await Promise.all(batch.map(id =>
    addressesFor(id, centroids.get(id)!, rings.get(id)!)));
  for (const result of results) {
    if (result) { known[result.pandId] = result; found++; } else missed++;
  }
  if ((i / CONCURRENCY) % 20 === 0) {
    process.stdout.write(`\r  ${found + missed}/${queue.length}`);
    await writeFile(FILE, JSON.stringify({ generatedAt: new Date().toISOString(), addresses: known }, null, 1));
  }
}
process.stdout.write('\n');
await mkdir(CACHE, { recursive: true });
await writeFile(FILE, JSON.stringify({
  generatedAt: new Date().toISOString(),
  source: 'PDOK Locatieserver (BAG), public service',
  note: 'A label on top of pand_id, which stays canonical. Addresses belong to dwellings, '
    + 'so a canal house split into flats has several; the shortest is kept and the rest counted.',
  addresses: known,
}, null, 1));

const streets = new Map<string, number>();
for (const a of Object.values(known)) streets.set(a.street, (streets.get(a.street) ?? 0) + 1);
console.log(`${Object.keys(known).length} addressed, ${missed} without one`);
const approx = Object.values(known).filter(a => !a.exact).length;
console.log(`  ${Object.keys(known).length - approx} exact (address point inside the footprint), ${approx} approximate`);
console.log('top streets: ' + [...streets].sort((a, b) => b[1] - a[1]).slice(0, 6)
  .map(([s, n]) => `${s} ${n}`).join(', '));
