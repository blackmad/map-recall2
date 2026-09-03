/**
 * RECON-3 — the Rijksmonumenten register as a second, independent measurement.
 *
 * The build prompt calls this the highest-value and most overlooked source, and
 * it is right: a monument's *redengevende omschrijving* routinely states the
 * gable type, bay count, cornice type, ornament and date in plain Dutch. For a
 * protected canal house that is a written observation of the façade, made by a
 * conservator, independent of any photograph.
 *
 * Finding it is the hard part. The register is NOT on the PDOK endpoints one
 * would expect — api.pdok.nl/rce/rijksmonumenten/*, the WFS under
 * service.pdok.nl and the atom index all return 404. Two live sources, joined
 * here:
 *
 *   geometry  services.rce.geovoorziening.nl/rce/wfs, rce:NationalListedMonumentPoints
 *   text      api.linkeddata.cultureelerfgoed.nl SPARQL, ceo:heeftOmschrijving
 *
 * Descriptions are Dutch and stay Dutch: per the product principles the English
 * game shows English, but the provenance text is preserved verbatim so a
 * translation pass stays resumable and so a disputed reading can be re-checked
 * against what the register actually says.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildPilotBoundary, containsRd, type CanalCentreline } from '../../src/canalRecall/facade/pilotBoundary.ts';
import { lngLatToRd, type LngLat } from '../../src/canalRecall/facade/rdNew.ts';
import { loadBoundaryCanals } from './fetch-boundary-canals.ts';

const WFS = 'https://services.rce.geovoorziening.nl/rce/wfs';
const SPARQL = 'https://api.linkeddata.cultureelerfgoed.nl/datasets/rce/cho/services/cho/sparql';
const CACHE = path.resolve('.cache/facade-twin');
const STAGING = path.resolve('public/data/extracts/amsterdam/staging/facade-twin');

interface Monument {
  monumentNumber: string;
  /** The BAG pand this monument's point falls inside, when it falls inside one. */
  pandId: string | null;
  lngLat: LngLat;
  category: string | null;
  subcategory: string | null;
  status: string | null;
  registerUrl: string | null;
  description?: string;
}

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function cached<T>(name: string, refresh: boolean, produce: () => Promise<T>): Promise<T> {
  const file = path.join(CACHE, name);
  if (!refresh) {
    try { return JSON.parse(await readFile(file, 'utf8')).data as T; } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  const data = await produce();
  await mkdir(CACHE, { recursive: true });
  await writeFile(file, JSON.stringify({ retrieved: new Date().toISOString(), data }));
  return data;
}

async function fetchMonuments(bbox: readonly number[]): Promise<Monument[]> {
  const monuments: Monument[] = [];
  const pageSize = 1000;
  for (let start = 0; ; start += pageSize) {
    // WFS 2.0 with an EPSG:4326 bbox wants latitude first.
    const url = `${WFS}?service=WFS&version=2.0.0&request=GetFeature&typeNames=rce:NationalListedMonumentPoints`
      + `&outputFormat=application/json&srsName=EPSG:4326&count=${pageSize}&startIndex=${start}`
      + `&bbox=${bbox[1]},${bbox[0]},${bbox[3]},${bbox[2]},urn:ogc:def:crs:EPSG::4326`;
    const response = await fetch(url, { headers: { 'User-Agent': 'MapRecallFacadeTwin/1.0' } });
    if (!response.ok) throw new Error(`RCE WFS: HTTP ${response.status}`);
    const payload = await response.json() as { features: Array<{ properties: Record<string, unknown>; geometry: { coordinates: number[] } }> };
    for (const feature of payload.features) {
      const [a, b] = feature.geometry.coordinates;
      // The service returns lat,lon under this srsName; detect and normalise.
      const lngLat: LngLat = a > 50 && a < 54 ? [b, a] : [a, b];
      monuments.push({
        monumentNumber: String(feature.properties.rijksmonument_nummer),
        pandId: null,
        lngLat,
        category: (feature.properties.hoofdcategorie as string) ?? null,
        subcategory: (feature.properties.subcategorie as string) ?? null,
        status: (feature.properties.juridische_status as string) ?? null,
        registerUrl: (feature.properties.rijksmonumenturl as string) ?? null,
      });
    }
    process.stdout.write(`\r  ${monuments.length} monuments`);
    if (payload.features.length < pageSize) break;
  }
  process.stdout.write('\n');
  return monuments;
}

async function fetchDescriptions(numbers: string[]): Promise<Record<string, string>> {
  const descriptions: Record<string, string> = {};
  const batchSize = 120;
  for (let i = 0; i < numbers.length; i += batchSize) {
    const batch = numbers.slice(i, i + batchSize);
    const query = `PREFIX ceo: <https://linkeddata.cultureelerfgoed.nl/def/ceo#>
SELECT ?nummer ?tekst WHERE {
  VALUES ?nummer { ${batch.map(n => `"${n}"`).join(' ')} }
  ?mon ceo:rijksmonumentnummer ?nummer ; ceo:heeftOmschrijving ?o .
  ?o ?p ?tekst . FILTER(isLiteral(?tekst) && STRLEN(STR(?tekst)) > 40)
}`;
    let payload: any;
    for (let attempt = 0; ; attempt++) {
      const response = await fetch(SPARQL, {
        method: 'POST',
        headers: { Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'MapRecallFacadeTwin/1.0' },
        body: new URLSearchParams({ query }),
      });
      if (response.ok) { payload = await response.json(); break; }
      if (attempt >= 3) throw new Error(`RCE SPARQL: HTTP ${response.status}`);
      await wait(1000 * 2 ** attempt);
    }
    for (const binding of payload.results.bindings) {
      const number = binding.nummer.value, text = binding.tekst.value as string;
      // Keep the longest description when a monument carries several.
      if (!descriptions[number] || text.length > descriptions[number].length) descriptions[number] = text;
    }
    process.stdout.write(`\r  ${Object.keys(descriptions).length} descriptions from ${Math.min(i + batchSize, numbers.length)}/${numbers.length} monuments`);
  }
  process.stdout.write('\n');
  return descriptions;
}

/**
 * Façade vocabulary as it is actually written in the register. These are search
 * terms for measuring how much the text can tell us — NOT a classifier. Turning
 * a description into a `gable` value is BUILD-6's job, one building at a time,
 * with the matched sentence kept as the observation.
 */
const VOCABULARY: Record<string, RegExp> = {
  'trapgevel': /\btrapgevel/i,
  'halsgevel': /\bhalsgevel|verhoogde halsgevel/i,
  'klokgevel': /\bklokgevel/i,
  'tuitgevel': /\btuitgevel/i,
  'lijstgevel': /\blijstgevel|kroonlijst|rechte lijst|triglyfenlijst/i,
  'puntgevel': /\bpuntgevel/i,
  'any gable word': /gevel/i,
  'bay count (Nraamsgevel)': /(een|twee|drie|vier|vijf|zes|zeven|acht)raams/i,
  'klauwstukken': /klauwstuk/i,
  'hoisting beam': /hijsbalk|hijsbalken/i,
  'gable stone': /gevelsteen|gevelstenen/i,
  'sandstone': /zandsteen|zandstenen/i,
  'stoep / bordes': /\bstoep|bordes/i,
  'shutters': /luiken/i,
  'sash windows': /schuiframen|schuifvensters/i,
  'kruiskozijn': /kruiskozijn|kruisvenster/i,
  'dormer': /dakkapel/i,
  'storey count': /\b(onder|met)\s+\w*\s*(verdieping|verdiepingen|bouwlagen)/i,
  'pui / shopfront': /\bpui\b|winkelpui/i,
  'century date (XVII/XVIII)': /\bXVI{1,3}\b|\bXVIII\b|\bXIX\b/,
};

const refresh = process.argv.includes('--refresh');
const ways = await loadBoundaryCanals();
const boundary = buildPilotBoundary(ways.map(w => ({ name: w.name, points: w.points }) as CanalCentreline));

console.log('Fetching Rijksmonumenten geometry (RCE WFS)…');
const all = await cached('rce-monuments.json', refresh, () => fetchMonuments(boundary.bboxLngLat));
const inside = all.filter(m => containsRd(boundary.ringRd, lngLatToRd(m.lngLat)));
console.log(`  ${all.length} in the bbox, ${inside.length} inside the boundary`);

console.log('Fetching redengevende omschrijvingen (RCE linked data SPARQL)…');
const descriptions = await cached('rce-descriptions.json', refresh, () => fetchDescriptions(inside.map(m => m.monumentNumber)));
for (const monument of inside) monument.description = descriptions[monument.monumentNumber];

const described = inside.filter(m => m.description);
console.log(`\nMonument coverage inside the pilot boundary`);
console.log(`  ${inside.length} rijksmonumenten`);
console.log(`  ${described.length} with a description (${(100 * described.length / inside.length).toFixed(1)}%)`);

const inventory = JSON.parse(await readFile(path.join(STAGING, 'pand-inventory.json'), 'utf8')) as { panden: Array<{ pandId: string }> };
const inventoryIds = new Set(inventory.panden.map(p => p.pandId));

/**
 * Join each monument to the pand its point falls inside.
 *
 * This matters more than it looks: monuments and panden are not one-to-one. A
 * single canal house can carry several monument records, and a monument point
 * can miss every footprint — 15% of them do, because the register's geometry is
 * flagged `kwaliteitsindicator: globaal` for many entries. Counting monuments
 * and calling it building coverage would overstate the register's reach by
 * nearly two to one.
 */
const bag = JSON.parse(await readFile(path.join(CACHE, 'bag-panden.json'), 'utf8')).panden as Array<{ pandId: string; footprintLngLat: LngLat[] }>;
const CELL_M = 60;
const grid = new Map<string, typeof bag>();
for (const pand of bag) {
  const rd = pand.footprintLngLat.map(lngLatToRd);
  const cx = Math.floor(rd.reduce((sum, p) => sum + p.x, 0) / rd.length / CELL_M);
  const cy = Math.floor(rd.reduce((sum, p) => sum + p.y, 0) / rd.length / CELL_M);
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
    const key = `${cx + dx},${cy + dy}`;
    (grid.get(key) ?? grid.set(key, []).get(key)!).push(pand);
  }
}
const pointInRing = (ring: LngLat[], [x, y]: LngLat) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
for (const monument of inside) {
  const rd = lngLatToRd(monument.lngLat);
  const key = `${Math.floor(rd.x / CELL_M)},${Math.floor(rd.y / CELL_M)}`;
  monument.pandId = (grid.get(key) ?? []).find(pand => pointInRing(pand.footprintLngLat, monument.lngLat))?.pandId ?? null;
}

const GABLE_WORDS: RegExp[] = [VOCABULARY.trapgevel, VOCABULARY.halsgevel, VOCABULARY.klokgevel, VOCABULARY.tuitgevel, VOCABULARY.lijstgevel, VOCABULARY.puntgevel];
const namesGable = (monument: Monument) => !!monument.description && GABLE_WORDS.some(pattern => pattern.test(monument.description!));
const pandenWithMonument = new Set(inside.map(m => m.pandId).filter((id): id is string => !!id && inventoryIds.has(id)));
const pandenWithGable = new Set(inside.filter(namesGable).map(m => m.pandId).filter((id): id is string => !!id && inventoryIds.has(id)));

console.log(`  ${inside.filter(m => m.pandId).length}/${inside.length} monument points land inside a BAG footprint`);
console.log(`  ${pandenWithMonument.size} of ${inventory.panden.length} panden carry a monument record (${(100 * pandenWithMonument.size / inventory.panden.length).toFixed(1)}%)`);
console.log(`  ${pandenWithGable.size} of ${inventory.panden.length} panden get a stated gable type from the register (${(100 * pandenWithGable.size / inventory.panden.length).toFixed(1)}%)`);
const ambiguous = inside.filter(m => m.description && GABLE_WORDS.filter(p => p.test(m.description!)).length > 1);
console.log(`  ${ambiguous.length} descriptions name more than one gable type — review by hand, do not pick the first match`);

console.log('\nWhat the descriptions actually say (share of described monuments)');
for (const [label, pattern] of Object.entries(VOCABULARY)) {
  const hits = described.filter(m => pattern.test(m.description!)).length;
  console.log(`  ${label.padEnd(28)} ${String(hits).padStart(4)}  ${(100 * hits / described.length).toFixed(0).padStart(3)}%  ${'#'.repeat(Math.round(40 * hits / described.length))}`);
}

const lengths = described.map(m => m.description!.length).sort((a, b) => a - b);
console.log(`\nDescription length: median ${lengths[Math.floor(lengths.length / 2)]} characters, p90 ${lengths[Math.floor(lengths.length * 0.9)]}`);

await mkdir(STAGING, { recursive: true });
await writeFile(path.join(STAGING, 'monument-join.json'), JSON.stringify({
  metadata: {
    generatedAt: new Date().toISOString(),
    generator: 'scripts/facade-twin/build-monument-join.ts',
    geometrySource: `${WFS} — rce:NationalListedMonumentPoints`,
    textSource: `${SPARQL} — ceo:heeftOmschrijving`,
    license: 'RCE open data, CC0 / CC BY — see monumentenregister.cultureelerfgoed.nl',
    monumentsInBoundary: inside.length,
    withDescription: described.length,
    monumentsJoinedToPand: inside.filter(m => m.pandId).length,
    pandenWithMonumentRecord: pandenWithMonument.size,
    pandenWithStatedGableType: pandenWithGable.size,
    ambiguousGableDescriptions: ambiguous.length,
    note: 'Descriptions are the register\'s original Dutch, preserved verbatim as provenance. Structuring them into façade attributes is a per-building measurement step, not done here.',
  },
  monuments: inside,
}, null, 2));
console.log(`\nwrote ${path.relative(process.cwd(), path.join(STAGING, 'monument-join.json'))}`);
