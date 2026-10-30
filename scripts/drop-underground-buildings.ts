/**
 * Remove underground structures (metro stations, car parks, tunnel shells) from
 * the published building tiles — the rule is `isUndergroundOsm` /
 * `isUndergroundPand` in src/canalRecall/undergroundBuildings.ts.
 *
 * The full chain (build-osm-buildings → build-lod1-city → build-bag-buildings
 * --tiles) applies the same rule on its next run; this is the in-place part of
 * that rebuild, as fix-bag-ground-outliers.ts is for the ground rule.
 *
 *   npx tsx scripts/drop-underground-buildings.ts            # report to artifacts/underground-buildings/report.json
 *   npx tsx scripts/drop-underground-buildings.ts --publish  # rewrite affected building-tiles and bag-tiles in place
 *   npx tsx scripts/drop-underground-buildings.ts --check    # exit 1 if any published feature is underground
 *   npx tsx scripts/drop-underground-buildings.ts --survey-voids [--publish]
 *     # also measure `isVoidOverRoad` pands (needs .cache/3dbag) into the stored index
 */
import { createReadStream, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import path from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { centrelineInsideM, isUndergroundOsm, isUndergroundPand, isVoidOverRoad, type UndergroundIndex } from '../src/canalRecall/undergroundBuildings.ts';
import { roofCoverOf, type CityJson } from '../src/canalRecall/bag3dCityJson.ts';
import { BAG3D_VERSION } from '../src/canalRecall/bag3dTiles.ts';

const publish = process.argv.includes('--publish');
const check = process.argv.includes('--check');
const surveyVoids = process.argv.includes('--survey-voids');
const ROOT = path.join('public', 'data', 'extracts', 'amsterdam');
const OSM_SEQ = path.join('.cache', 'osm-source', 'derived', 'amsterdam-buildings.geojsonseq');
const INDEX_FILE = path.join(ROOT, 'underground-buildings.json');
const REPORT = path.join('artifacts', 'underground-buildings');

type LngLat = [number, number];
type TileFeature = { properties: Record<string, unknown>; geometry: { type: string; coordinates: unknown } };
type Void = { roofCover: number; roadInsideM: number; year: number | null };
const polygonsOf = (g: TileFeature['geometry']): LngLat[][][] => (g.type === 'Polygon' ? [g.coordinates as LngLat[][]] : g.coordinates as LngLat[][][]);
const stored = (): { voidPands?: Record<string, Void> } => { try { return JSON.parse(readFileSync(INDEX_FILE, 'utf8')); } catch { return {}; } };

/**
 * `isVoidOverRoad`: pands lying across a car road that 3DBAG roofs over little
 * of. Measured only with --survey-voids (the 3DBAG cache), then kept in the
 * index, since a published drop removes the very pands the survey looks for.
 */
function measureVoids(): Record<string, Void> {
  const CAR = new Set(['primary', 'secondary', 'tertiary', 'trunk', 'residential', 'unclassified', 'living_street', 'primary_link', 'secondary_link', 'tertiary_link', 'busway']);
  const streets = JSON.parse(readFileSync(path.join(ROOT, 'streets-routing.json'), 'utf8')) as { highway?: string; path: [number, number][]; paths?: [number, number][][] }[];
  const CELL = 0.002, grid = new Map<string, [LngLat, LngLat][]>();
  for (const street of streets) {
    if (!CAR.has(street.highway ?? '')) continue;
    for (const line of street.paths ?? [street.path]) for (let i = 1; i < line.length; i++) {
      const a: LngLat = [line[i - 1][1], line[i - 1][0]], b: LngLat = [line[i][1], line[i][0]];
      for (let x = Math.floor(Math.min(a[0], b[0]) / CELL); x <= Math.floor(Math.max(a[0], b[0]) / CELL); x++)
        for (let y = Math.floor(Math.min(a[1], b[1]) / CELL); y <= Math.floor(Math.max(a[1], b[1]) / CELL); y++) {
          const key = `${x},${y}`;
          if (!grid.has(key)) grid.set(key, []);
          grid.get(key)!.push([a, b]);
        }
    }
  }
  const roadInside = new Map<string, number>();
  const zoomDir = path.join(ROOT, 'bag-tiles', '14');
  for (const x of readdirSync(zoomDir).filter(name => /^\d+$/.test(name))) for (const file of readdirSync(path.join(zoomDir, x)).filter(name => name.endsWith('.geojson.gz'))) {
    const { features } = JSON.parse(gunzipSync(readFileSync(path.join(zoomDir, x, file))).toString('utf8')) as { features: TileFeature[] };
    for (const feature of features) {
      const id = String(feature.properties.id ?? '');
      if (!id.startsWith('NL.IMBAG.Pand.')) continue;
      const polygons = polygonsOf(feature.geometry), outer = polygons.flatMap(p => p[0]);
      const lngs = outer.map(p => p[0]), lats = outer.map(p => p[1]), segments = new Set<[LngLat, LngLat]>();
      for (let gx = Math.floor(Math.min(...lngs) / CELL); gx <= Math.floor(Math.max(...lngs) / CELL); gx++)
        for (let gy = Math.floor(Math.min(...lats) / CELL); gy <= Math.floor(Math.max(...lats) / CELL); gy++)
          for (const segment of grid.get(`${gx},${gy}`) ?? []) segments.add(segment);
      if (!segments.size) continue;
      const metres = centrelineInsideM(polygons, [...segments]);
      if (metres >= 1) roadInside.set(id, Math.max(metres, roadInside.get(id) ?? 0));
    }
  }
  const voids: Record<string, Void> = {}, cache = path.join('.cache', '3dbag', BAG3D_VERSION, 'tiles');
  for (const file of readdirSync(cache).filter(name => name.endsWith('.city.json.gz'))) {
    const text = gunzipSync(readFileSync(path.join(cache, file))).toString('utf8');
    const ids = [...roadInside.keys()].filter(id => text.includes(id));
    if (!ids.length) continue;
    const city = JSON.parse(text) as CityJson;
    for (const id of ids) {
      const object = city.CityObjects[id];
      if (!object) continue;
      const roofCover = roofCoverOf(city, object), year = typeof object.attributes?.oorspronkelijkbouwjaar === 'number' ? object.attributes.oorspronkelijkbouwjaar : null;
      const pand = { roofCover, roadInsideM: roadInside.get(id)!, year };
      if (isVoidOverRoad(pand)) voids[id] = { roofCover: +roofCover!.toFixed(3), roadInsideM: Math.round(pand.roadInsideM), year };
    }
  }
  return voids;
}

/**
 * The OSM ids and ref:bag ids that are underground. Built from the OSM cache
 * when present and stored in the extract, so `--check` runs without the cache.
 */
async function loadIndex(): Promise<UndergroundIndex & { voids: Set<string>; names: Record<string, string> }> {
  let fromCache = false;
  const osm = new Set<string>(), refBag = new Set<string>(), names: Record<string, string> = {};
  try {
    const reader = createInterface({ input: createReadStream(OSM_SEQ), crlfDelay: Infinity });
    for await (const raw of reader) {
      fromCache = true;
      const line = raw.replace(/^\u001e/, '').trim();
      if (!line) continue;
      const props = (JSON.parse(line) as { properties?: Record<string, unknown> }).properties ?? {};
      if (!props.building && !props['building:part']) continue;
      if (props['@type'] !== 'way' && props['@type'] !== 'relation') continue;
      if (!isUndergroundOsm(props)) continue;
      const id = `${props['@type'] === 'way' ? 'w' : 'r'}${props['@id']}`;
      osm.add(id);
      if (typeof props.name === 'string') names[id] = props.name;
      const ref = typeof props['ref:bag'] === 'string' ? props['ref:bag'].replace(/^0*(?=\d{16}$)/, '') : '';
      if (/^\d{16}$/.test(ref)) refBag.add(ref);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const prior = stored();
  const voidPands = { ...prior.voidPands, ...(surveyVoids ? measureVoids() : {}) };
  if (!fromCache) {
    const index = prior as { osm: string[]; refBag: string[] };
    return { osm: new Set(index.osm), refBag: new Set(index.refBag), voids: new Set(Object.keys(voidPands)), names: {} };
  }
  writeFileSync(INDEX_FILE, `${JSON.stringify({
    rule: 'src/canalRecall/undergroundBuildings.ts isUndergroundOsm over .cache/osm-source/derived/amsterdam-buildings.geojsonseq; voidPands isVoidOverRoad over .cache/3dbag',
    osm: [...osm].sort(), refBag: [...refBag].sort(), voidPands,
  }, null, 0)}\n`);
  return { osm, refBag, voids: new Set(Object.keys(voidPands)), names };
}

const index = await loadIndex();
const dropped: { tileSet: string; tile: string; id: string; height: unknown; osm?: unknown; name?: string }[] = [];
let rewritten = 0;
// bag-tiles carry each pand's OSM matches; building-tiles drop the same ids.
const droppedIds = new Set<string>();

for (const tileSet of ['bag-tiles', 'building-tiles']) {
  const zoomDir = path.join(ROOT, tileSet, '14');
  for (const x of readdirSync(zoomDir).filter(name => /^\d+$/.test(name))) {
    for (const file of readdirSync(path.join(zoomDir, x)).filter(name => name.endsWith('.geojson.gz'))) {
      const tilePath = path.join(zoomDir, x, file);
      const collection = JSON.parse(gunzipSync(readFileSync(tilePath)).toString('utf8')) as { features: TileFeature[] };
      const keep = collection.features.filter(feature => {
        const id = String(feature.properties.id ?? '');
        const height = typeof feature.properties.height === 'number' ? feature.properties.height : null;
        const matchedOsm = Array.isArray(feature.properties.osm) ? feature.properties.osm.map(String) : [];
        const underground = droppedIds.has(id) || index.voids.has(id) || (id.startsWith('NL.IMBAG.Pand.')
          ? isUndergroundPand({ id, heightM: height, matchedOsm }, index)
          : index.osm.has(id));
        if (underground) droppedIds.add(id);
        if (underground) dropped.push({ tileSet, tile: `14/${x}/${file.replace('.geojson.gz', '')}`, id, height, osm: feature.properties.osm, name: index.names[id] });
        return !underground;
      });
      if (keep.length === collection.features.length || !publish) continue;
      const body = `{"type":"FeatureCollection","features":[\n${keep.map(feature => JSON.stringify(feature)).join(',\n')}\n]}\n`;
      writeFileSync(tilePath, gzipSync(body));
      rewritten++;
    }
  }
}

// Every BAG pand ever dropped stays listed, so the gap survey does not refill it (survey-bag-gaps.ts).
const indexJson = stored() as Record<string, unknown> & { droppedPands?: string[] };
const droppedPands = new Set([...(indexJson.droppedPands ?? []), ...[...droppedIds].filter(id => id.startsWith('NL.IMBAG.Pand.'))]);
if (publish || droppedPands.size !== (indexJson.droppedPands ?? []).length) writeFileSync(INDEX_FILE, `${JSON.stringify({ ...indexJson, droppedPands: [...droppedPands].sort() }, null, 0)}\n`);
mkdirSync(REPORT, { recursive: true });
writeFileSync(path.join(REPORT, 'report.json'), `${JSON.stringify({ osmUnderground: index.osm.size, refBagUnderground: index.refBag.size, dropped }, null, 1)}\n`);
const bySet = (set: string): number => dropped.filter(row => row.tileSet === set).length;
process.stdout.write(`underground OSM ways ${index.osm.size}, ref:bag ${index.refBag.size}\n`);
process.stdout.write(`${publish ? 'dropped' : 'would drop'} building-tiles ${bySet('building-tiles')}, bag-tiles ${bySet('bag-tiles')}${publish ? ` (${rewritten} tiles rewritten)` : ''}\n`);
if (check && dropped.length && !publish) {
  for (const row of dropped.slice(0, 20)) process.stderr.write(`  underground in ${row.tileSet} ${row.tile}: ${row.id}\n`);
  process.exit(1);
}
