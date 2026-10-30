/**
 * Measure the OSM-only outlines (tier 4) that the tiles draw at the 9 m default
 * (`osmHeightGuessed`: no `height`, no `building:levels`) from AHN, inside their
 * own outline: Jan van Zutphenstraat's four towers stood at 9 m with AHN seeing
 * 29-37 m, and sheds stood at 9 m where AHN sees 2-3 m (2026-10-30). Which
 * flight, or the houseboat or low-slab rule, is `chooseGuessedHeight`
 * (src/canalRecall/guessedHeights.ts): AHN4 (2020, PDOK WCS) for buildings up
 * to 2019, AHN5 (2023, basisdata.nl) where AHN4 sees no roof or the building
 * is newer. Outlines OSM dates 2023 or later keep their guess (newBuildGaps.ts).
 *
 *   node --import tsx scripts/measure-guessed-heights.ts            # measure (AHN WCS, cached), stage, report
 *   node --import tsx scripts/measure-guessed-heights.ts --publish  # also set the heights in building-tiles and bag-tiles
 *   node --import tsx scripts/measure-guessed-heights.ts --check    # exit 1 if a published guess is off its measured height
 *
 * Measured heights are kept in scripts/data/osm-guessed-heights.json with their
 * source (null = no flight has samples: the guess stays), so --publish and
 * --check run without the caches. Roof outlines keep their canopy rule
 * (osmMinHeight.ts).
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { MIN_FILL_HEIGHT_M, osmHeightGuessed } from '../src/canalRecall/bagGaps';
import { AHN4_FLIGHT_YEAR, builtYear, chooseGuessedHeight, type GuessedHeight } from '../src/canalRecall/guessedHeights';
import type { Ring } from '../src/canalRecall/landmarks/osmUnderModels';
import { multiPolygonAreaM2 } from '../src/canalRecall/buildingPassages';
import type { MultiPolygon } from 'polygon-clipping';
import { AHN5_FLIGHT_YEAR, ahnForRings, bagPandUnder } from './lib/ahnFootprint';

const publish = process.argv.includes('--publish'), check = process.argv.includes('--check');
const ROOT = path.join('public', 'data', 'extracts', 'amsterdam');
const OSM_SEQ = path.join('.cache', 'osm-source', 'derived', 'amsterdam-buildings.geojsonseq');
const STORE = path.join('scripts', 'data', 'osm-guessed-heights.json');
type Feature = { properties: Record<string, unknown>; geometry: { type: string; coordinates: unknown } };
type Measured = GuessedHeight | null;
const r2 = (v: number) => Math.round(v * 100) / 100;
const tiles = (dir: string) => {
  const z = path.join(ROOT, dir, '14');
  return fs.readdirSync(z).filter(n => /^\d+$/.test(n)).flatMap(x => fs.readdirSync(path.join(z, x)).filter(n => n.endsWith('.geojson.gz')).map(f => path.join(z, x, f)));
};
const readTile = (file: string): { features: Feature[] } => JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString());
const ringsOf = (g: Feature['geometry']): Ring[] => g.type === 'Polygon' ? [(g.coordinates as Ring[])[0]] : g.type === 'MultiPolygon' ? (g.coordinates as Ring[][]).map(p => p[0]) : [];

const store: Record<string, Measured> = fs.existsSync(STORE) ? JSON.parse(fs.readFileSync(STORE, 'utf8')) : {};
if (!check && !publish) {
  // Which tier-4 outlines are guesses: their OSM tags, from the cache.
  const tier4 = new Map<string, Ring[]>(), areas = new Map<string, MultiPolygon>();
  for (const file of tiles('bag-tiles')) for (const f of readTile(file).features)
    if (f.properties.tier === 4 && /^[wr]\d/.test(String(f.properties.id)) && !tier4.has(String(f.properties.id))) {
      tier4.set(String(f.properties.id), ringsOf(f.geometry));
      areas.set(String(f.properties.id), (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates) as MultiPolygon);
    }
  const guessed = new Map<string, Record<string, unknown>>();
  for (const raw of fs.readFileSync(OSM_SEQ, 'utf8').split('\n')) {
    const m = raw.match(/"@id":(\d+)/);
    if (!m) continue;
    const id = `${raw.includes('"@type":"relation"') ? 'r' : 'w'}${m[1]}`;
    if (!tier4.has(id)) continue;
    const tags = (JSON.parse(raw.replace(/^\u001e/, '')) as { properties: Record<string, unknown> }).properties;
    if (osmHeightGuessed(tags) && tags.building !== 'roof' && tags['building:part'] !== 'roof') guessed.set(id, tags);
  }
  for (const id of Object.keys(store)) if (!guessed.has(id)) delete store[id];
  // Re-decide everything the rule may change; heights from either flight come from the caches.
  const todo = [...guessed.keys()];
  console.log(`tier-4 outlines ${tier4.size}; guessed ${guessed.size}`);
  let next = 0, done = 0, ahn5Reads = 0, bagReads = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (next < todo.length) {
      const id = todo[next++], tags = guessed.get(id)!, rings = tier4.get(id)!;
      const osmBuilt = Number.parseInt(String(tags.start_date ?? ''), 10);
      let ahn4 = osmBuilt >= AHN4_FLIGHT_YEAR ? null : await ahnForRings(rings).catch(() => null);
      const ahn4Roof = !!ahn4 && ahn4.height >= MIN_FILL_HEIGHT_M;
      // No OSM date and no roof in 2020: the BAG pand under it says whether it is new.
      const bag = !Number.isFinite(osmBuilt) && !ahn4Roof && tags.building !== 'houseboat' ? (bagReads++, await bagPandUnder(rings).catch(() => null)) : null;
      const built = builtYear(tags, bag);
      if (built >= AHN4_FLIGHT_YEAR) ahn4 = null;
      // AHN5 only where AHN4 cannot answer: no roof seen, or built after its flight.
      const needs5 = tags.building !== 'houseboat' && !(built >= AHN5_FLIGHT_YEAR) && !(ahn4 && ahn4.height >= MIN_FILL_HEIGHT_M);
      const ahn5 = needs5 ? (ahn5Reads++, await ahnForRings(rings, 'ahn5').catch(() => null)) : null;
      store[id] = chooseGuessedHeight({ tags, built, areaM2: multiPolygonAreaM2(areas.get(id)!), ahn4, ahn5, ahn5Year: AHN5_FLIGHT_YEAR });
      if (++done % 250 === 0) console.log(`measured ${done}/${todo.length}`);
    }
  }));
  console.log(`AHN5 read for ${ahn5Reads}, BAG pand looked up for ${bagReads}`);
  fs.writeFileSync(STORE, `${JSON.stringify(Object.fromEntries(Object.entries(store).sort()))}\n`);
  const values = Object.values(store);
  const hs = values.filter((v): v is NonNullable<Measured> => !!v).map(v => v.height).sort((a, b) => a - b);
  const q = (p: number) => hs[Math.floor((hs.length - 1) * p)];
  const by: Record<string, number> = {};
  for (const v of values) by[v?.source ?? 'guess'] = (by[v?.source ?? 'guess'] ?? 0) + 1;
  console.log(`decided ${values.length}: ${JSON.stringify(by)}; height p10 ${q(0.1)} p50 ${q(0.5)} p90 ${q(0.9)}; over 20 m: ${hs.filter(h => h > 20).length}`);
}

const HEIGHT_SOURCE: Record<GuessedHeight['source'], string> = { ahn4: 'ahn-dsm-p70', ahn5: 'ahn5-dsm-p70', houseboat: 'osm-houseboat', low: 'ahn-low' };

// ---- publish / check -------------------------------------------------------------------------------------------
const MEASURED_SOURCES = new Set(Object.values(HEIGHT_SOURCE));
const stale: string[] = [];
let off = 0, rewritten = 0;
for (const dir of ['bag-tiles', 'building-tiles']) for (const file of tiles(dir)) {
  const tile = readTile(file);
  let dirty = false;
  for (const f of tile.features) {
    const id = String(f.properties.id), m = store[id];
    // A guess the rule no longer measures must not keep a measured source (restore it from the tiles before the measure).
    if (m === null && f.properties.tier === 4 && MEASURED_SOURCES.has(String(f.properties.heightSource))) { off++; stale.push(id); continue; }
    if (!m || f.properties.tier !== 4 || (f.properties.height === m.height && f.properties.heightSource === HEIGHT_SOURCE[m.source])) continue;
    off++;
    if (!publish) continue;
    // A guess lifted by min_level keeps its storey start under the measured top.
    const base = Number(f.properties.minHeight ?? 0);
    Object.assign(f.properties, { height: m.height, heightSource: HEIGHT_SOURCE[m.source], ...(base >= m.height ? { minHeight: 0 } : {}) });
    if (dir === 'bag-tiles') {
      delete f.properties.eaves; delete f.properties.ridge;
      Object.assign(f.properties, m.eaves ? { eaves: m.eaves } : {}, m.ridge ? { ridge: r2(m.ridge) } : {});
    }
    dirty = true;
  }
  if (dirty) { fs.writeFileSync(file, zlib.gzipSync(`{"type":"FeatureCollection","features":[\n${tile.features.map(f => JSON.stringify(f)).join(',\n')}\n]}\n`)); rewritten++; }
}
console.log(`guessed heights: ${Object.values(store).filter(Boolean).length} measured; ${off} tile features ${publish ? `set (${rewritten} tiles)` : 'off their measured height'}`);
if (stale.length) console.log(`  ${stale.length} keep a measured source the rule no longer gives (${stale.slice(0, 4).join(', ')}): restore their guess`);
// Named regressions: [id, place, source or null for the guess, min, max].
const NAMED: [string, string, GuessedHeight['source'] | null, number, number][] = [
  ['w1322335099', 'The Robin, Amstelkwartier (BAG 2022, a site in both flights)', null, 0, 0],
  ['w1322335094', 'The Martin, Amstelkwartier (BAG 2022, a site in both flights)', null, 0, 0],
  ['w977477234', 'Terrace Tower, Zuidas (2021, AHN5)', 'ahn5', 30, 40],
  ['w286016267', 'Voorbezinktank, Westpoort (a ground-level tank)', 'low', 0.5, 2],
  ['w268508334', 'houseboat Doris', 'houseboat', 3, 3.5],
  ['w681737608', '2017 shed under a 45 m tower of 2022', null, 0, 0],
];
const named = NAMED.flatMap(([id, place, source, min, max]) => {
  const m = store[id];
  if (source === null) return m === null ? [] : [`${place}: ${id} should keep its guess, has ${JSON.stringify(m)}`];
  return m?.source === source && m.height >= min && m.height <= max ? [] : [`${place}: ${id} expected ${source} ${min}-${max} m, has ${JSON.stringify(m)}`];
});
for (const p of named) console.log(`  FAIL ${p}`);
if (check && named.length) process.exit(1);
if (check && off) process.exit(1);
