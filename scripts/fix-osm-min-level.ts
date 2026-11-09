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
 *
 * Untagged roof outlines (no height, levels or min_height) also take their canopy height (`osmHeightM`): they were
 * published at the 9 m default, a slab at 8-9 m across a facade (feedback 2c486751, Danzigerkade w848883149). Their
 * expected tops are kept in scripts/data/osm-roof-canopies.json; the height is fixed first, then the start from it.
 */
import { createReadStream, existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import path from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { OSM_DEFAULT_HEIGHT_M, osmHeightM, osmMinHeightM } from '../src/canalRecall/osmMinHeight.ts';
import { footprintAreaM2 } from '../src/canalRecall/genericFacades.ts';

const publish = process.argv.includes('--publish');
const check = process.argv.includes('--check');
const ROOT = path.join('public', 'data', 'extracts', 'amsterdam');
const OSM_SEQ = path.join('.cache', 'osm-source', 'derived', 'amsterdam-buildings.geojsonseq');
const STORE = path.join('scripts', 'data', 'osm-min-levels.json');
const TOP_STORE = path.join('scripts', 'data', 'osm-roof-canopies.json');

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
const expectedTop: Record<string, number> = existsSync(TOP_STORE) ? JSON.parse(readFileSync(TOP_STORE, 'utf8')) as Record<string, number> : {};
const changed: { id: string; tile: string; from: unknown; to: number }[] = [];
const lowered: { id: string; tile: string; from: unknown; to: number }[] = [];
const untaggedRoof = (t: Record<string, unknown>) => (t.building === 'roof' || t['building:part'] === 'roof') && t.height === undefined && t['building:levels'] === undefined;
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
      // A canopy at the building default: its own top first (the AHN-measured or tagged ones are left alone).
      if (tags && untaggedRoof(tags) && feature.properties.height === OSM_DEFAULT_HEIGHT_M && feature.properties.heightSource === undefined) {
        const top = osmHeightM(tags, footprintAreaM2((feature as unknown as { geometry: unknown }).geometry));
        if (top !== OSM_DEFAULT_HEIGHT_M) expectedTop[id] = top;
      }
      if (id in expectedTop && feature.properties.height !== expectedTop[id]) {
        lowered.push({ id, tile: `${tileSet}/${x}/${file}`, from: feature.properties.height, to: expectedTop[id] });
        feature.properties.height = expectedTop[id];
        dirty = true;
      }
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
if (tagged.size) {
  writeFileSync(STORE, `${JSON.stringify(Object.fromEntries(Object.entries(expected).sort()), null, 0)}\n`);
  writeFileSync(TOP_STORE, `${JSON.stringify(Object.fromEntries(Object.entries(expectedTop).sort()), null, 0)}\n`);
}
process.stdout.write(`roof canopies: ${Object.keys(expectedTop).length} known, ${lowered.length} ${publish ? 'lowered' : 'at the 9 m default'}\n`);
for (const c of lowered.slice(0, 6)) process.stdout.write(`  ${c.id} top ${c.from} -> ${c.to} m (${c.tile})\n`);
process.stdout.write(`min_level parts: ${Object.keys(expected).length} known, ${changed.length} ${publish ? 'fixed' : 'off the rule'}${publish ? ` (${rewritten} tiles)` : ''}\n`);
for (const c of changed.slice(0, 12)) process.stdout.write(`  ${c.id} ${c.from} -> ${c.to} m (${c.tile})\n`);
if (check && (changed.length || lowered.length) && !publish) process.exit(1);
