// Gable types of Amsterdam's listed buildings, from the national monuments register (RCE).
//
//   npx tsx scripts/fetch-monument-gables.ts            fetch what is missing, then classify
//   npx tsx scripts/fetch-monument-gables.ts --publish  also write the versioned extract
//
// The register's description of each rijksmonument usually names its front ("Pand met
// trapgevel", "lijstgevel met kroonlijst", "verhoogde halsgevel"). Each monument has a point;
// the building footprint that contains it gets the gable named first in its description.
// Prefer the reusable local register archive; legacy SPARQL pages use a repo-local cache.
// Output goes to a staging file with a coverage report; --publish copies it into the extract.

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import { classifyGable } from '../src/canalRecall/monumentGables.ts';

const ENDPOINT = 'https://api.linkeddata.cultureelerfgoed.nl/datasets/rce/cho/sparql';
const STORE = '.cache/monument-register/amsterdam/legacy-gables';
const STAGING = '.cache/monument-register/amsterdam/monument-gables.staging.json';
const ARCHIVE = 'scripts/data/amsterdam-monument-register/records.json.gz';
const EXTRACT = 'public/data/extracts/amsterdam/monument-gables.json';
const TILES = 'public/data/extracts/amsterdam/building-tiles/14';

// Each monument joins to many parcels, so the municipality is a FILTER EXISTS rather than a
// join (a join repeated every row ~20 times); DISTINCT leaves two rows per monument (two points).
// Pages are ranges of monument numbers: OFFSET paging timed out (504) past the third page.
const query = ([from, to]: readonly [number, number]) => `
PREFIX ceo: <https://linkeddata.cultureelerfgoed.nl/def/ceo#>
PREFIX geo: <http://www.opengis.net/ont/geosparql#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
SELECT DISTINCT ?nr ?wkt ?txt WHERE {
  ?m a ceo:Rijksmonument ; ceo:rijksmonumentnummer ?nr .
  FILTER(xsd:integer(?nr) >= ${from} && xsd:integer(?nr) < ${to})
  FILTER EXISTS { ?m ceo:heeftBasisregistratieRelatie/ceo:gemeentenaam "Amsterdam" }
  ?m ceo:heeftGeometrie/geo:asWKT ?wkt ; ceo:heeftOmschrijving/ceo:omschrijving ?txt .
}`;
const RANGES: ReadonlyArray<readonly [number, number]> = [
  ...Array.from({ length: 8 }, (_, k) => [k * 1500, (k + 1) * 1500] as const),
  [12000, 30000], [30000, 100000], [100000, 300000], [300000, 600000],
];

type Row = { nr: string; wkt: string; txt: string };

async function pages(): Promise<Row[]> {
  if (existsSync(ARCHIVE)) {
    const snapshot = JSON.parse(gunzipSync(readFileSync(ARCHIVE)).toString('utf8'));
    const rows: Row[] = [];
    for (const record of snapshot.rce) {
      for (const location of record.locations) {
        // The legacy footprint matcher expects longitude/latitude, never RD metres.
        // GeoSPARQL WKT without an explicit CRS uses CRS84.
        if (location.value.startsWith('<') && !/CRS84|4326/.test(location.value)) continue;
        for (const description of record.descriptions) rows.push({ nr: record.monumentNumber, wkt: location.value, txt: description.text });
      }
    }
    console.log(`Read ${rows.length} description/location rows from local archive`);
    return rows;
  }
  mkdirSync(STORE, { recursive: true });
  const rows: Row[] = [];
  for (const range of RANGES) {
    const file = `${STORE}/nr-${range[0]}-${range[1]}.json`;
    let body: any;
    if (existsSync(file)) body = JSON.parse(readFileSync(file, 'utf8'));
    else {
      const url = `${ENDPOINT}?query=${encodeURIComponent(query(range))}`;
      // The endpoint times out (504) now and then: retry with backoff.
      let res: Response | null = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        res = await fetch(url, { headers: { Accept: 'application/sparql-results+json' } });
        if (res.ok) break;
        console.log(`numbers ${range.join('-')}: HTTP ${res.status}, retrying`);
        await new Promise(r => setTimeout(r, 5000 * 2 ** attempt));
      }
      if (!res || !res.ok) throw new Error(`register numbers ${range.join('-')}: HTTP ${res?.status}`);
      body = await res.json();
      writeFileSync(file, JSON.stringify(body));
      console.log(`fetched numbers ${range.join('-')}: ${body.results.bindings.length} rows`);
    }
    rows.push(...body.results.bindings.map((b: any) => ({ nr: b.nr.value, wkt: b.wkt.value, txt: b.txt.value })));
  }
  return rows;
}

type Ring = number[][];
function inside([x, y]: number[], ring: Ring): boolean {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    if ((ring[i][1] > y) !== (ring[j][1] > y) && x < ((ring[j][0] - ring[i][0]) * (y - ring[i][1])) / (ring[j][1] - ring[i][1]) + ring[i][0]) c = !c;
  }
  return c;
}
const tileOf = (lng: number, lat: number) => {
  const n = 2 ** 14;
  return [Math.floor(((lng + 180) / 360) * n), Math.floor(((1 - Math.asinh(Math.tan((lat * Math.PI) / 180)) / Math.PI) / 2) * n)];
};

const rows = await pages();
// One monument has several descriptions (main text, later notes): keep the first that names a gable.
const byNr = new Map<string, { point: [number, number]; shape: string | null; text: string }>();
for (const r of rows) {
  const m = /Point\s*\(\s*([\d.]+)\s+([\d.]+)/i.exec(r.wkt);
  if (!m) continue;
  const prev = byNr.get(r.nr), shape = classifyGable(r.txt);
  if (!prev) byNr.set(r.nr, { point: [Number(m[1]), Number(m[2])], shape, text: r.txt });
  else if (!prev.shape && shape) Object.assign(prev, { shape, text: r.txt });
}

const tiles = new Map<string, any[]>();
const featuresOf = (x: number, y: number) => {
  const key = `${x}/${y}`;
  if (!tiles.has(key)) {
    const file = `${TILES}/${key}.geojson.gz`;
    tiles.set(key, existsSync(file) ? JSON.parse(gunzipSync(readFileSync(file)).toString()).features : []);
  }
  return tiles.get(key)!;
};
const buildings: Record<string, string> = {};
const counts: Record<string, number> = {};
// Landmark buildings that are listed: their BAG year is often a restoration (Westerkerk 1990,
// Mozes en Aäronkerk 1969), so the landmark fallback reads "listed" as old whatever the year.
// A register point marks one part of a many-part landmark; the whole landmark counts as listed.
const landmarkParts = Object.values(JSON.parse(readFileSync('public/data/extracts/amsterdam/landmark-buildings.json', 'utf8')).buildings as Record<string, string[]>);
const landmarkIds = new Set(landmarkParts.flat());
const listed = new Set<string>();
let named = 0, matched = 0;
for (const [nr, m] of byNr) {
  const [x, y] = tileOf(...m.point);
  const hit = featuresOf(x, y).find(f => (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates).some((poly: Ring[]) => inside(m.point, poly[0])));
  if (hit && landmarkIds.has(String(hit.properties.id))) listed.add(String(hit.properties.id));
  if (!m.shape) continue;
  named++;
  if (!hit) continue;
  matched++;
  buildings[String(hit.properties.id)] = m.shape;
  counts[m.shape] = (counts[m.shape] ?? 0) + 1;
  void nr;
}
const out = { version: 1, source: 'Rijksdienst voor het Cultureel Erfgoed, monumentenregister (CC0), linkeddata.cultureelerfgoed.nl', generated: new Date().toISOString().slice(0, 10), buildings, listedLandmarks: [...listed].sort() };
mkdirSync(path.dirname(STAGING), { recursive: true });
writeFileSync(STAGING, JSON.stringify(out));
console.log(`${byNr.size} Amsterdam monuments; ${named} name a gable; ${matched} matched a footprint (${Object.keys(buildings).length} buildings)`);
for (const parts of landmarkParts) if (parts.some(id => listed.has(id))) for (const id of parts) listed.add(id);
console.log('by shape', JSON.stringify(counts));
console.log(`${listed.size} landmark buildings are listed`);
console.log(`staged ${STAGING}`);
if (process.argv.includes('--publish')) { writeFileSync(EXTRACT, JSON.stringify(out)); console.log(`published ${EXTRACT}`); }
void readdirSync;
