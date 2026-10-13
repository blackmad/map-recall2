/**
 * Every BAG pand with a current address on one street: the denominator for the
 * street-survey coverage table (street-surveys.html).
 *
 *   node --import tsx scripts/street-surveys/street-pands.ts --street=Bilderdijkstraat
 *
 * Source: PDOK BAG OGC API v2 (verblijfsobject in a bbox around the street's
 * centreline from streets-routing.json, then each unit's pand). Responses are
 * cached under .cache/pand-reference. Writes (committed, small)
 * scripts/street-surveys/streets/<street>.json.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {cachedJson} from '../pand-reference/core.ts';
import {lngLatToRd} from '../../src/canalRecall/facade/rdNew.ts';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const street = arg('street') ?? 'Bilderdijkstraat';
const CRS = 'http://www.opengis.net/def/crs/EPSG/0/28992';
const BUFFER = 45;

type Unit = {address: string; number: number; letter: string | null; suffix: string | null; use: string; pandHref: string};

const streets = JSON.parse(await fs.readFile('public/data/extracts/amsterdam/streets-routing.json', 'utf8')) as {name: string; path?: [number, number][]; paths?: [number, number][][]}[];
const paths = streets.filter(s => s.name === street).flatMap(s => s.paths ?? (s.path ? [s.path] : []));
if (!paths.length) throw new Error(`No centreline for ${street}`);
// streets-routing paths are [lat, lng].
const rd = paths.flat().map(([lat, lng]) => lngLatToRd([lng, lat]));
const min = [Math.min(...rd.map(p => p.x)) - BUFFER, Math.min(...rd.map(p => p.y)) - BUFFER];
const max = [Math.max(...rd.map(p => p.x)) + BUFFER, Math.max(...rd.map(p => p.y)) + BUFFER];

const units: Unit[] = [];
let url: string | null = `https://api.pdok.nl/kadaster/bag/ogc/v2/collections/verblijfsobject/items?bbox=${min[0].toFixed(0)},${min[1].toFixed(0)},${max[0].toFixed(0)},${max[1].toFixed(0)}&bbox-crs=${CRS}&crs=${CRS}&f=json&limit=1000`;
for (let page = 0; url && page < 30; page++) {
  const json: any = await cachedJson(url);
  for (const f of json.features ?? []) {
    const p = f.properties;
    if (p.openbare_ruimte_naam !== street || /ingetrokken|niet gerealiseerd/i.test(String(p.status))) continue;
    const href = (p['pand.href'] ?? [])[0];
    if (!href) continue;
    const address = `${street} ${p.huisnummer}${p.huisletter ?? ''}${p.toevoeging ? `-${p.toevoeging}` : ''}`;
    units.push({address, number: p.huisnummer, letter: p.huisletter ?? null, suffix: p.toevoeging ?? null, use: String(p.gebruiksdoel ?? ''), pandHref: href});
  }
  url = json.links?.find((l: any) => l.rel === 'next')?.href ?? null;
}

const byHref = new Map<string, Unit[]>();
for (const u of units) byHref.set(u.pandHref, [...(byHref.get(u.pandHref) ?? []), u]);
const pands = [];
for (const [href, list] of byHref) {
  const item: any = await cachedJson(`${href}${href.includes('?') ? '&' : '?'}f=json`);
  const numbers = [...new Set(list.map(u => u.number))].sort((a, b) => a - b);
  pands.push({
    pandId: String(item.properties.identificatie), buildYear: item.properties.bouwjaar ?? null, status: item.properties.status,
    numbers, label: numbers.length > 1 ? `${street} ${numbers[0]}–${numbers.at(-1)}` : `${street} ${numbers[0]}`,
    units: list.length, groundUses: [...new Set(list.filter(u => u.suffix === 'H' || !u.suffix).map(u => u.use))],
  });
}
pands.sort((a, b) => a.numbers[0] - b.numbers[0]);
const out = path.join('scripts/street-surveys/streets', `${street.toLowerCase()}.json`);
await fs.mkdir(path.dirname(out), {recursive: true});
await fs.writeFile(out, JSON.stringify({street, source: 'PDOK BAG OGC API v2 (verblijfsobject + pand), CC0', fetchedAt: new Date().toISOString().slice(0, 10), pands}, null, 1) + '\n');
console.log(`${pands.length} pands with a current ${street} address -> ${out}`);
