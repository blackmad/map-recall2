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
 */
import { createReadStream, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import path from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { isUndergroundOsm, isUndergroundPand, type UndergroundIndex } from '../src/canalRecall/undergroundBuildings.ts';

const publish = process.argv.includes('--publish');
const check = process.argv.includes('--check');
const ROOT = path.join('public', 'data', 'extracts', 'amsterdam');
const OSM_SEQ = path.join('.cache', 'osm-source', 'derived', 'amsterdam-buildings.geojsonseq');
const INDEX_FILE = path.join(ROOT, 'underground-buildings.json');
const REPORT = path.join('artifacts', 'underground-buildings');

type TileFeature = { properties: Record<string, unknown>; geometry: unknown };

/**
 * The OSM ids and ref:bag ids that are underground. Built from the OSM cache
 * when present and stored in the extract, so `--check` runs without the cache.
 */
async function loadIndex(): Promise<UndergroundIndex & { names: Record<string, string> }> {
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
  if (!fromCache) {
    const stored = JSON.parse(readFileSync(INDEX_FILE, 'utf8')) as { osm: string[]; refBag: string[] };
    return { osm: new Set(stored.osm), refBag: new Set(stored.refBag), names: {} };
  }
  writeFileSync(INDEX_FILE, `${JSON.stringify({
    rule: 'src/canalRecall/undergroundBuildings.ts isUndergroundOsm over .cache/osm-source/derived/amsterdam-buildings.geojsonseq',
    osm: [...osm].sort(), refBag: [...refBag].sort(),
  }, null, 0)}\n`);
  return { osm, refBag, names };
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
        const underground = droppedIds.has(id) || (id.startsWith('NL.IMBAG.Pand.')
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

mkdirSync(REPORT, { recursive: true });
writeFileSync(path.join(REPORT, 'report.json'), `${JSON.stringify({ osmUnderground: index.osm.size, refBagUnderground: index.refBag.size, dropped }, null, 1)}\n`);
const bySet = (set: string): number => dropped.filter(row => row.tileSet === set).length;
process.stdout.write(`underground OSM ways ${index.osm.size}, ref:bag ${index.refBag.size}\n`);
process.stdout.write(`${publish ? 'dropped' : 'would drop'} building-tiles ${bySet('building-tiles')}, bag-tiles ${bySet('bag-tiles')}${publish ? ` (${rewritten} tiles rewritten)` : ''}\n`);
if (check && dropped.length && !publish) {
  for (const row of dropped.slice(0, 20)) process.stderr.write(`  underground in ${row.tileSet} ${row.tile}: ${row.id}\n`);
  process.exit(1);
}
