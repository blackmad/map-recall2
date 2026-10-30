/**
 * Put published OSM building parts on the storey rule for `building:min_level`
 * (`osmMinHeightM`, src/canalRecall/osmMinHeight.ts): the tiles were built when
 * it was read as metres, so a part tagged min_level 4 started at 4 m, not 12 m.
 * build-osm-buildings.ts applies the rule on the next full rebuild; this is the
 * in-place part, as fix-bag-ground-outliers.ts is for the ground rule.
 *
 *   npx tsx scripts/fix-osm-min-level.ts            # report
 *   npx tsx scripts/fix-osm-min-level.ts --publish  # rewrite affected building-tiles and bag-tiles
 *   npx tsx scripts/fix-osm-min-level.ts --check    # exit 1 if a published part is off the rule
 *
 * The expected starts are kept in scripts/data/osm-min-levels.json, so --check
 * runs without the OSM cache.
 */
import { createReadStream, existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import path from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { osmMinHeightM } from '../src/canalRecall/osmMinHeight.ts';

const publish = process.argv.includes('--publish');
const check = process.argv.includes('--check');
const ROOT = path.join('public', 'data', 'extracts', 'amsterdam');
const OSM_SEQ = path.join('.cache', 'osm-source', 'derived', 'amsterdam-buildings.geojsonseq');
const STORE = path.join('scripts', 'data', 'osm-min-levels.json');

// OSM ids tagged building:min_level, or roof outlines, without min_height, with their tags.
const tagged = new Map<string, Record<string, unknown>>();
if (existsSync(OSM_SEQ)) {
  for await (const raw of createInterface({ input: createReadStream(OSM_SEQ), crlfDelay: Infinity })) {
    if (!raw.includes('building:min_level') && !raw.includes('"roof"')) continue;
    const props = (JSON.parse(raw.replace(/^\u001e/, '')) as { properties?: Record<string, unknown> }).properties ?? {};
    const roof = props.building === 'roof' || props['building:part'] === 'roof';
    if ((props['building:min_level'] === undefined && !roof) || props.min_height !== undefined) continue;
    tagged.set(`${props['@type'] === 'way' ? 'w' : 'r'}${props['@id']}`, props);
  }
}
const stored = existsSync(STORE) ? JSON.parse(readFileSync(STORE, 'utf8')) as Record<string, number> : {};
const expected: Record<string, number> = { ...stored };
const changed: { id: string; tile: string; from: unknown; to: number }[] = [];
let rewritten = 0;

for (const tileSet of ['bag-tiles', 'building-tiles']) {
  const zoomDir = path.join(ROOT, tileSet, '14');
  for (const x of readdirSync(zoomDir).filter(n => /^\d+$/.test(n))) for (const file of readdirSync(path.join(zoomDir, x)).filter(n => n.endsWith('.geojson.gz'))) {
    const tilePath = path.join(zoomDir, x, file);
    const collection = JSON.parse(gunzipSync(readFileSync(tilePath)).toString('utf8')) as { features: { properties: Record<string, unknown> }[] };
    let dirty = false;
    for (const feature of collection.features) {
      const id = String(feature.properties.id ?? '');
      const tags = tagged.get(id);
      if (tags) expected[id] = Math.round(osmMinHeightM(tags, typeof feature.properties.height === 'number' ? feature.properties.height : null) * 100) / 100;
      if (!(id in expected) || feature.properties.minHeight === expected[id]) continue;
      changed.push({ id, tile: `${tileSet}/${x}/${file}`, from: feature.properties.minHeight, to: expected[id] });
      feature.properties.minHeight = expected[id];
      dirty = true;
    }
    if (dirty && publish) {
      writeFileSync(tilePath, gzipSync(`{"type":"FeatureCollection","features":[\n${collection.features.map(f => JSON.stringify(f)).join(',\n')}\n]}\n`));
      rewritten++;
    }
  }
}
if (tagged.size) writeFileSync(STORE, `${JSON.stringify(Object.fromEntries(Object.entries(expected).sort()), null, 0)}\n`);
process.stdout.write(`min_level parts: ${Object.keys(expected).length} known, ${changed.length} ${publish ? 'fixed' : 'off the rule'}${publish ? ` (${rewritten} tiles)` : ''}\n`);
for (const c of changed.slice(0, 12)) process.stdout.write(`  ${c.id} ${c.from} -> ${c.to} m (${c.tile})\n`);
if (check && changed.length && !publish) process.exit(1);
