// Gable types of Amsterdam's listed buildings, from the national monuments register (RCE).
//
//   npx tsx scripts/fetch-monument-gables.ts            fetch what is missing, then classify
//   npx tsx scripts/fetch-monument-gables.ts --publish  also write the versioned extract
//
// The register's description of each rijksmonument usually names its front ("Pand met
// trapgevel", "lijstgevel met kroonlijst", "verhoogde halsgevel"). Each monument has a point;
// the building footprint that contains it gets the gable named first in its description.
// Raw SPARQL pages are cached in the shared scrape store and only missing pages are fetched.
// Output goes to a staging file with a coverage report; --publish copies it into the extract.

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { classifyGable } from '../src/canalRecall/monumentGables.ts';

const ENDPOINT = 'https://api.linkeddata.cultureelerfgoed.nl/datasets/rce/cho/sparql';
const STORE = '/mnt/project-files/scrape-store/rce-monuments/amsterdam-distinct';
const STAGING = '/mnt/project-files/house-design/monument-gables.staging.json';
const EXTRACT = 'public/data/extracts/amsterdam/monument-gables.json';
const TILES = 'public/data/extracts/amsterdam/building-tiles/14';
const PAGE = 2000;

// Each monument joins to many parcels, so the municipality is a FILTER EXISTS rather than a
// join (a join repeated every row ~20 times); DISTINCT leaves two rows per monument (two points).
const query = (offset: number) => `
PREFIX ceo: <https://linkeddata.cultureelerfgoed.nl/def/ceo#>
PREFIX geo: <http://www.opengis.net/ont/geosparql#>
SELECT DISTINCT ?nr ?wkt ?txt WHERE {
  ?m a ceo:Rijksmonument ; ceo:rijksmonumentnummer ?nr ; ceo:heeftGeometrie/geo:asWKT ?wkt ; ceo:heeftOmschrijving/ceo:omschrijving ?txt .
  FILTER EXISTS { ?m ceo:heeftBasisregistratieRelatie/ceo:gemeentenaam "Amsterdam" }
} ORDER BY ?nr LIMIT ${PAGE} OFFSET ${offset}`;

type Row = { nr: string; wkt: string; txt: string };

async function pages(): Promise<Row[]> {
  mkdirSync(STORE, { recursive: true });
  const rows: Row[] = [];
  for (let page = 0; ; page++) {
    const file = `${STORE}/page-${String(page).padStart(3, '0')}.json`;
    let body: any;
    if (existsSync(file)) body = JSON.parse(readFileSync(file, 'utf8'));
    else {
      const url = `${ENDPOINT}?query=${encodeURIComponent(query(page * PAGE))}`;
      // The endpoint times out (504) now and then on deep pages: retry with backoff.
      let res: Response | null = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        res = await fetch(url, { headers: { Accept: 'application/sparql-results+json' } });
        if (res.ok) break;
        console.log(`page ${page}: HTTP ${res.status}, retrying`);
        await new Promise(r => setTimeout(r, 5000 * 2 ** attempt));
      }
      if (!res || !res.ok) throw new Error(`register page ${page}: HTTP ${res?.status}`);
      body = await res.json();
      writeFileSync(file, JSON.stringify(body));
      console.log(`fetched page ${page}: ${body.results.bindings.length} rows`);
    }
    const got = body.results.bindings.map((b: any) => ({ nr: b.nr.value, wkt: b.wkt.value, txt: b.txt.value }));
    rows.push(...got);
    if (got.length < PAGE) break;
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
let named = 0, matched = 0;
for (const [nr, m] of byNr) {
  if (!m.shape) continue;
  named++;
  const [x, y] = tileOf(...m.point);
  const hit = featuresOf(x, y).find(f => (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates).some((poly: Ring[]) => inside(m.point, poly[0])));
  if (!hit) continue;
  matched++;
  buildings[String(hit.properties.id)] = m.shape;
  counts[m.shape] = (counts[m.shape] ?? 0) + 1;
  void nr;
}
const out = { version: 1, source: 'Rijksdienst voor het Cultureel Erfgoed, monumentenregister (CC0), linkeddata.cultureelerfgoed.nl', generated: new Date().toISOString().slice(0, 10), buildings };
mkdirSync('/mnt/project-files/house-design', { recursive: true });
writeFileSync(STAGING, JSON.stringify(out));
console.log(`${byNr.size} Amsterdam monuments; ${named} name a gable; ${matched} matched a footprint (${Object.keys(buildings).length} buildings)`);
console.log('by shape', JSON.stringify(counts));
console.log(`staged ${STAGING}`);
if (process.argv.includes('--publish')) { writeFileSync(EXTRACT, JSON.stringify(out)); console.log(`published ${EXTRACT}`); }
void readdirSync;
