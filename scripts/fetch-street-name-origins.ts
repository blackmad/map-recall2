/**
 * Stage Amsterdam's official street-name explanations for review.
 *
 * Fetches every public space from the municipal BAG API, keeps the current
 * records that explain their name (`beschrijvingNaam`), and writes them to
 * `staging/street-name-origins.json` with their provenance. English is added
 * afterwards by `translate-street-name-origins.ts`, and nothing reaches the
 * game until `publish-street-name-origins.ts` merges a reviewed staging file.
 *
 * A re-fetch keeps every English translation whose Dutch source is unchanged,
 * so refreshing the register never throws away paid-for translations.
 *
 * Usage: npm run fetch:street-name-origins
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  indexOrigins, originFor, originsFromRecords, type BagOpenbareRuimte, type NameOrigin,
} from './lib/streetNameOrigins.ts';

const directory = path.resolve('public/data/extracts/amsterdam');
const stagingFile = path.join(directory, 'staging/street-name-origins.json');
const API = 'https://api.data.amsterdam.nl/v1/bag/openbareruimtes/';
const FIELDS = 'identificatie,naam,typeOmschrijving,beschrijvingNaam,eindGeldigheid,ligtInWoonplaatsId';

export interface StagedOrigins {
  version: 1;
  source: { url: string; field: 'beschrijvingNaam'; retrievedAt: string; licence: string };
  origins: NameOrigin[];
}

const records: BagOpenbareRuimte[] = [];
let next: string | undefined = `${API}?_format=json&_pageSize=1000&_fields=${FIELDS}`;
while (next) {
  const response = await fetch(next, { headers: { 'User-Agent': 'MapRecallStreetNames/1.0 (https://github.com/blackmad/map-recall2)' } });
  if (!response.ok) throw new Error(`BAG API ${response.status} for ${next}`);
  const page = await response.json() as { _embedded?: { openbareruimtes?: BagOpenbareRuimte[] }; _links?: { next?: { href?: string } } };
  records.push(...(page._embedded?.openbareruimtes ?? []));
  next = page._links?.next?.href;
}
const origins = originsFromRecords(records);

// Carry translations across a refresh when the Dutch is unchanged.
const previous: StagedOrigins | null = JSON.parse(await readFile(stagingFile, 'utf8').catch(() => 'null'));
const kept = new Map((previous?.origins ?? []).filter(origin => origin.en).map(origin => [`${origin.bagId}\u0000${origin.nl}`, origin]));
let carried = 0;
for (const origin of origins) {
  const old = kept.get(`${origin.bagId}\u0000${origin.nl}`);
  if (old) { origin.en = old.en; origin.enSource = old.enSource; carried++; }
}

const staged: StagedOrigins = {
  version: 1,
  source: {
    url: API,
    field: 'beschrijvingNaam',
    retrievedAt: new Date().toISOString(),
    // The API's OpenAPI document leaves the licence name empty; see
    // https://data.amsterdam.nl/ for the city's open-data terms.
    licence: 'unstated in the API (Gemeente Amsterdam open data; verify at data.amsterdam.nl before publishing)',
  },
  origins,
};
await writeFile(stagingFile, `${JSON.stringify(staged, null, 1)}\n`);

// ---- Coverage against what the game can ask ----
const index = indexOrigins(origins);
const readNames = async (file: string) => {
  const data = JSON.parse(await readFile(path.join(directory, file), 'utf8'));
  const features = Array.isArray(data) ? data : data.features;
  return [...new Set((features as Array<{ name?: string; properties?: { name?: string } }>)
    .map(feature => feature.name ?? feature.properties?.name).filter((name): name is string => !!name))];
};
const coverage = async (label: string, file: string, kind: 'street' | 'water' | 'bridge') => {
  const names = await readNames(file);
  const missing = names.filter(name => !originFor(index, name, kind));
  process.stdout.write(`  ${label}: ${names.length - missing.length} of ${names.length} explained`
    + ` (${((1 - missing.length / Math.max(1, names.length)) * 100).toFixed(1)}%)`
    + `${missing.length ? `; e.g. missing ${missing.slice(0, 6).join(', ')}` : ''}\n`);
};
const byKind = origins.reduce<Record<string, number>>((counts, origin) => ({ ...counts, [origin.kind]: (counts[origin.kind] ?? 0) + 1 }), {});
process.stdout.write(`staged ${origins.length} explained names from ${records.length} BAG records `
  + `(${Object.entries(byKind).map(([kind, count]) => `${count} ${kind}`).join(', ')}); `
  + `${carried} translations carried over\n  → ${path.relative(process.cwd(), stagingFile)}\n`);
await coverage('streets the bike can ask (streets-routing)', 'streets-routing.json', 'street');
await coverage('curated streets', 'streets.json', 'street');
await coverage('waterways', 'water.json', 'water');
await coverage('bridges', 'bridges.json', 'bridge');
