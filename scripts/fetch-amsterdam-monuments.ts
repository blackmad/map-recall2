/**
 * Snapshot Amsterdam's monument register (municipal data API, `monumenten`)
 * for the clicked-building card: status, name, architect, construction years,
 * original function, and the BAG panden each monument is. The long Dutch
 * descriptions (median 4.5k characters of architectural prose) are left out
 * until there is a reviewed way to shorten and translate them.
 *
 * Writes `scripts/data/amsterdam-monuments.json` (committed, so the building
 * facts rebuild without the network) and reports coverage.
 *
 * Usage: npm run fetch:amsterdam-monuments
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const FIELDS = 'identificatie,monumentnummer,naam,status,type,architectOntwerp,jaarBeginVan,jaarBeginTot,oorspronkelijkeFunctie,datumAfvoeren,betreftBagPand';
let url: string | undefined = `https://api.data.amsterdam.nl/v1/monumenten/monumenten/?_format=json&_pageSize=2000&_fields=${FIELDS}`;
interface Record_ {
  monumentnummer: number; naam: string | null; status: string; type: string;
  architectOntwerp: string | null; jaarBeginVan: string | null; jaarBeginTot: string | null;
  oorspronkelijkeFunctie: string | null; datumAfvoeren: string | null;
  _links?: { betreftBagPand?: Array<{ identificatie: string }> };
}
const records: Record_[] = [];
while (url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`monumenten: HTTP ${response.status}`);
  const page = await response.json() as { _embedded: { monumenten: Record_[] }; _links: { next?: { href: string } } };
  records.push(...page._embedded.monumenten);
  url = page._links.next?.href;
}

// [number, status, name, architect, yearFrom, yearTo, function, pand ids]
const monuments = records
  .filter(record => !record.datumAfvoeren)
  .map(record => [
    record.monumentnummer, record.status, record.naam ?? '', record.architectOntwerp ?? '',
    record.jaarBeginVan ?? '', record.jaarBeginTot ?? '', record.oorspronkelijkeFunctie ?? '',
    (record._links?.betreftBagPand ?? []).map(pand => pand.identificatie),
  ])
  .sort((a, b) => (a[0] as number) - (b[0] as number));
const out = path.resolve('scripts/data/amsterdam-monuments.json');
await mkdir(path.dirname(out), { recursive: true });
await writeFile(out, `${JSON.stringify({
  source: 'Gemeente Amsterdam, monumenten (api.data.amsterdam.nl/v1/monumenten)',
  fetched: new Date().toISOString().slice(0, 10),
  fields: ['number', 'status', 'name', 'architect', 'yearFrom', 'yearTo', 'function', 'panden'],
  monuments,
})}\n`);
const withPand = monuments.filter(m => (m[7] as string[]).length).length;
process.stdout.write(`${monuments.length} monuments (${withPand} with BAG panden) → scripts/data/amsterdam-monuments.json\n`);
