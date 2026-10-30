/**
 * Measure the OSM-only outlines (tier 4) that the tiles draw at the 9 m default
 * (`osmHeightGuessed`: no `height`, no `building:levels`) from AHN, inside their
 * own outline: Jan van Zutphenstraat's four towers stood at 9 m with AHN seeing
 * 29-37 m, and sheds stood at 9 m where AHN sees 2-3 m (2026-10-30). Outlines
 * OSM dates after the 2020 flight keep their height (newBuildGaps.ts rules).
 *
 *   node --import tsx scripts/measure-guessed-heights.ts            # measure (AHN WCS, cached), stage, report
 *   node --import tsx scripts/measure-guessed-heights.ts --publish  # also set the heights in building-tiles and bag-tiles
 *   node --import tsx scripts/measure-guessed-heights.ts --check    # exit 1 if a published guess is off its measured height
 *
 * Measured heights are kept in scripts/data/osm-guessed-heights.json (null =
 * AHN too sparse or flat: the guess stays), so --publish and --check run
 * without the caches. Roof outlines keep their canopy rule (osmMinHeight.ts).
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { MAX_FILL_YEAR, MIN_FILL_HEIGHT_M, osmHeightGuessed } from '../src/canalRecall/bagGaps';
import type { Ring } from '../src/canalRecall/landmarks/osmUnderModels';
import { ahnForRings } from './lib/ahnFootprint';

const publish = process.argv.includes('--publish'), check = process.argv.includes('--check');
const ROOT = path.join('public', 'data', 'extracts', 'amsterdam');
const OSM_SEQ = path.join('.cache', 'osm-source', 'derived', 'amsterdam-buildings.geojsonseq');
const STORE = path.join('scripts', 'data', 'osm-guessed-heights.json');
type Feature = { properties: Record<string, unknown>; geometry: { type: string; coordinates: unknown } };
type Measured = { height: number; eaves?: number; ridge?: number } | null;
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
  const tier4 = new Map<string, Ring[]>();
  for (const file of tiles('bag-tiles')) for (const f of readTile(file).features)
    if (f.properties.tier === 4 && /^[wr]\d/.test(String(f.properties.id)) && !tier4.has(String(f.properties.id))) tier4.set(String(f.properties.id), ringsOf(f.geometry));
  const guessed: string[] = [];
  for (const raw of fs.readFileSync(OSM_SEQ, 'utf8').split('\n')) {
    const m = raw.match(/"@id":(\d+)/);
    if (!m) continue;
    const id = `${raw.includes('"@type":"relation"') ? 'r' : 'w'}${m[1]}`;
    if (!tier4.has(id)) continue;
    const tags = (JSON.parse(raw.replace(/^\u001e/, '')) as { properties: Record<string, unknown> }).properties;
    // AHN flew in 2020: a later build (the 2023 Elandsgracht kiosk) would read its neighbours or a building site.
    const built = Number.parseInt(String(tags.start_date ?? ''), 10);
    if (osmHeightGuessed(tags) && tags.building !== 'roof' && tags['building:part'] !== 'roof' && !(built > MAX_FILL_YEAR)) guessed.push(id);
  }
  const keep = new Set(guessed);
  for (const id of Object.keys(store)) if (!keep.has(id)) delete store[id];
  const todo = guessed.filter(id => !(id in store));
  console.log(`tier-4 outlines ${tier4.size}; guessed ${guessed.length}; to measure ${todo.length}`);
  let next = 0, done = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (next < todo.length) {
      const id = todo[next++];
      const h = await ahnForRings(tier4.get(id)!).catch(() => null);
      store[id] = h && h.height >= MIN_FILL_HEIGHT_M
        ? { height: h.height, ...(h.eaves >= MIN_FILL_HEIGHT_M ? { eaves: h.eaves } : {}), ...(h.ridge > h.height ? { ridge: h.ridge } : {}) }
        : null;
      if (++done % 250 === 0) { console.log(`measured ${done}/${todo.length}`); fs.writeFileSync(STORE, `${JSON.stringify(store)}\n`); }
    }
  }));
  fs.writeFileSync(STORE, `${JSON.stringify(Object.fromEntries(Object.entries(store).sort()))}\n`);
  const values = Object.values(store);
  const hs = values.filter((v): v is NonNullable<Measured> => !!v).map(v => v.height).sort((a, b) => a - b);
  const q = (p: number) => hs[Math.floor((hs.length - 1) * p)];
  console.log(`measured ${hs.length}, left at the guess ${values.length - hs.length}; height p10 ${q(0.1)} p50 ${q(0.5)} p90 ${q(0.9)}; over 20 m: ${hs.filter(h => h > 20).length}`);
}

// ---- publish / check -------------------------------------------------------------------------------------------
let off = 0, rewritten = 0;
for (const dir of ['bag-tiles', 'building-tiles']) for (const file of tiles(dir)) {
  const tile = readTile(file);
  let dirty = false;
  for (const f of tile.features) {
    const m = store[String(f.properties.id)];
    if (!m || f.properties.tier !== 4 || f.properties.height === m.height) continue;
    off++;
    if (!publish) continue;
    // A guess lifted by min_level keeps its storey start under the measured top.
    const base = Number(f.properties.minHeight ?? 0);
    Object.assign(f.properties, { height: m.height, heightSource: 'ahn-dsm-p70', ...(base >= m.height ? { minHeight: 0 } : {}) });
    if (dir === 'bag-tiles') Object.assign(f.properties, m.eaves ? { eaves: m.eaves } : {}, m.ridge ? { ridge: r2(m.ridge) } : {});
    dirty = true;
  }
  if (dirty) { fs.writeFileSync(file, zlib.gzipSync(`{"type":"FeatureCollection","features":[\n${tile.features.map(f => JSON.stringify(f)).join(',\n')}\n]}\n`)); rewritten++; }
}
console.log(`guessed heights: ${Object.values(store).filter(Boolean).length} measured; ${off} tile features ${publish ? `set (${rewritten} tiles)` : 'off their measured height'}`);
if (check && off) process.exit(1);
