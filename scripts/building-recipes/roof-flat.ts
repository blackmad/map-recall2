/**
 * Measured flat-roof colour for `kind: large` houses, from the roof-facts sidecar (PDOK orthophoto).
 *
 *   node --import tsx scripts/building-recipes/roof-flat.ts --house=<id>[,<id>...] [--write]
 *
 * Looks the house's pand up in public/data/extracts/amsterdam/roof-facts/14 (the z14 tile under its BAG footprint and
 * the eight around it) and prints the colour the city draws that roof in (`flatRoofFromFact`, buildingRecipe/measuredRoof.ts).
 * `--write` puts it into the intent as `roof.flatHex` (exported with `tintSource: measured`, drawn as is) and adds a note.
 * A house whose intent already has `roof.flatHex` is reported and left alone. Recompile and reinstall afterwards
 * (install-large.ts), then check:covers.
 */
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import {decodeRoofFactTile, type RoofFact, type RoofFactTile} from '../../src/canalRecall/roofs/roofSlots.ts';
import {flatRoofFromFact} from '../../src/canalRecall/buildingRecipe/measuredRoof.ts';
import {rdToLngLat} from '../../src/canalRecall/facade/rdNew.ts';

const HOUSES = 'scripts/building-recipes/houses', TILES = 'public/data/extracts/amsterdam/roof-facts/14';
const arg = (name: string) => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const ids = (arg('house') ?? '').split(',').filter(Boolean);
if (!ids.length) throw Error('usage: roof-flat.ts --house=<id>[,<id>...] [--write]');
const write = process.argv.includes('--write');

const tileOf = (lng: number, lat: number, z = 14) => {
  const n = 2 ** z, x = Math.floor((lng + 180) / 360 * n);
  const y = Math.floor((1 - Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI) / 2 * n);
  return [x, y] as const;
};
const tiles = new Map<string, Map<string, RoofFact>>();
function factsIn(x: number, y: number): Map<string, RoofFact> {
  const key = `${x}/${y}`;
  let m = tiles.get(key);
  if (!m) {
    const file = path.join(TILES, String(x), `${y}.json.gz`);
    m = fs.existsSync(file) ? decodeRoofFactTile(JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString()) as RoofFactTile) : new Map();
    tiles.set(key, m);
  }
  return m;
}

for (const id of ids) {
  const dir = path.join(HOUSES, id), intentFile = path.join(dir, 'intent.json');
  const intent = JSON.parse(fs.readFileSync(intentFile, 'utf8'));
  const facts = JSON.parse(fs.readFileSync(path.join(dir, 'facts.json'), 'utf8'));
  const ring: number[][] = facts.bagFootprintRD[0];
  const [cx, cy] = [ring.reduce((s, p) => s + p[0], 0) / ring.length, ring.reduce((s, p) => s + p[1], 0) / ring.length];
  const [lng, lat] = rdToLngLat({x: cx, y: cy});
  const [tx, ty] = tileOf(lng, lat);
  let fact: RoofFact | undefined, at = '';
  for (const dx of [0, -1, 1]) for (const dy of [0, -1, 1]) {
    const f = fact ?? factsIn(tx + dx, ty + dy).get(intent.pandId);
    if (f && !fact) { fact = f; at = `${tx + dx}/${ty + dy}`; }
  }
  const reading = flatRoofFromFact(fact);
  const line = `${id} (pand ${intent.pandId})`;
  if (!fact) { console.log(`${line}: no roof fact`); continue; }
  if (!reading) { console.log(`${line}: fact ${fact.slot} rgb ${fact.rgb.join('/')} conf ${fact.confidence} not usable for a flat roof`); continue; }
  console.log(`${line}: ${reading.hex} (roof-facts 14/${at}: slot ${reading.slot}, rgb ${reading.rgb.join('/')}, confidence ${reading.confidence})${intent.roof?.flatHex ? `; intent already has roof.flatHex ${intent.roof.flatHex}` : ''}`);
  if (!write || intent.roof?.flatHex) continue;
  intent.roof = {...(intent.roof ?? {material: 'bitumen'}), flatHex: reading.hex};
  intent.notes = [...(intent.notes ?? []), `roof.flatHex ${reading.hex}: the PDOK orthophoto's reading of this pand (roof-facts 14/${at}: slot ${reading.slot}, rgb ${reading.rgb.join('/')}, confidence ${reading.confidence}; roof-flat.ts), the colour the city drew it in before the install.`];
  fs.writeFileSync(intentFile, JSON.stringify(intent, null, 1) + '\n');
}
