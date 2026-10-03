// Which z14 building tile holds each footprint a hand-modelled landmark kit uses.
// The landmark gallery (public/canal-drive/landmark-gallery.html) needs this to find a kit's
// parts without a hard-coded centre table: it loads the named tiles, then frames the kit from
// the parts' real footprints. Writes to a staging file and reports coverage; --publish copies it
// into the versioned extract.
//   npx tsx scripts/build-kit-locations.ts [--publish]
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { HAND_KITS, kitIds } from '../src/canalRecall/landmarkKits.ts';

const TILES = 'public/data/extracts/amsterdam/building-tiles';
const OUT = 'public/data/extracts/amsterdam/kit-locations.json';
const STAGING = process.env.KIT_LOCATIONS_STAGING ?? '/tmp/kit-locations.staging.json';

const wanted = new Set(HAND_KITS.flatMap(kitIds));
const index = JSON.parse(readFileSync(join(TILES, 'index-z14.json'), 'utf8')) as { tileList: string[] };
const ids: Record<string, string> = {};
for (const tile of index.tileList) {
  const [, x, y] = tile.split('/');
  const file = join(TILES, '14', x, `${y}.geojson.gz`);
  if (!existsSync(file)) continue;
  const features = JSON.parse(gunzipSync(readFileSync(file)).toString('utf8')).features ?? [];
  for (const f of features) { const id = String(f.properties?.id); if (wanted.has(id) && !ids[id]) ids[id] = `${x}/${y}`; }
}
const missing = [...wanted].filter(id => !ids[id]).sort();
const out = { version: 1, source: 'scripts/build-kit-locations.ts over building-tiles/14', ids, missing };
writeFileSync(STAGING, JSON.stringify(out));
console.log(`hand kits ${HAND_KITS.length}, footprint ids ${wanted.size}, located ${Object.keys(ids).length}, missing ${missing.length}`);
for (const kit of HAND_KITS) {
  const own = [...new Set(kitIds(kit))], lost = own.filter(id => !ids[id]);
  if (lost.length) console.log(`  ${kit.name}: ${own.length - lost.length}/${own.length} located, missing ${lost.join(', ')}`);
}
if (process.argv.includes('--publish')) { mkdirSync(dirname(OUT), { recursive: true }); writeFileSync(OUT, JSON.stringify(out)); console.log(`published ${OUT}`); }
else console.log(`staged ${STAGING} (use --publish to write ${OUT})`);
