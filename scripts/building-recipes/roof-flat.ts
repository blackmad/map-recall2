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
 *
 *   node --import tsx scripts/building-recipes/roof-flat.ts --pitched --house=<id>[,<id>...] [--write]
 *
 * The same for the pitched classes (issue #73): `pitchedRoofFromFact` (slate, zinc, pantile readings) into
 * `roof.pitchedHex`, only where the reading fits the intent's roof material (`pitchedFitsMaterial`: a reading recolours,
 * it never turns slate into tile; copper stays authored). Material-only: re-export with reexport-large.ts.
 */
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import {decodeRoofFactTile, type RoofFact, type RoofFactTile} from '../../src/canalRecall/roofs/roofSlots.ts';
import {flatRoofFromFact, pitchedFitsMaterial, pitchedRoofFromFact} from '../../src/canalRecall/buildingRecipe/measuredRoof.ts';
import {rdToLngLat} from '../../src/canalRecall/facade/rdNew.ts';

const HOUSES = 'scripts/building-recipes/houses', TILES = 'public/data/extracts/amsterdam/roof-facts/14';
const arg = (name: string) => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const ids = (arg('house') ?? '').split(',').filter(Boolean);
if (!ids.length) throw Error('usage: roof-flat.ts --house=<id>[,<id>...] [--write]');
const write = process.argv.includes('--write'), pitched = process.argv.includes('--pitched');
const field = pitched ? 'pitchedHex' : 'flatHex';

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
  const text = fs.readFileSync(intentFile, 'utf8'), intent = JSON.parse(text);
  // Keep the file's own indentation (intents are written at 1 or 2 spaces), so a write diffs as the roof lines only.
  const indent = /^\{\n( +)"/.exec(text)?.[1].length ?? 1;
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
  const reading = pitched ? pitchedRoofFromFact(fact) : flatRoofFromFact(fact);
  const line = `${id} (pand ${intent.pandId})`;
  if (!fact) { console.log(`${line}: no roof fact`); continue; }
  if (!reading) { console.log(`${line}: fact ${fact.slot} rgb ${fact.rgb.join('/')} conf ${fact.confidence} not usable for a ${pitched ? 'pitched' : 'flat'} roof`); continue; }
  const material = intent.roof?.material ?? 'bitumen';
  if (pitched && !pitchedFitsMaterial(reading.slot, material)) { console.log(`${line}: fact ${reading.slot} does not fit roof.material ${material}; left authored`); continue; }
  console.log(`${line}: ${reading.hex} (roof-facts 14/${at}: slot ${reading.slot}, rgb ${reading.rgb.join('/')}, confidence ${reading.confidence})${intent.roof?.[field] ? `; intent already has roof.${field} ${intent.roof[field]}` : ''}`);
  if (!write || intent.roof?.[field]) continue;
  intent.roof = {...(intent.roof ?? {material: 'bitumen'}), [field]: reading.hex};
  const what = pitched ? 'roof.pitchedHex' : 'roof.flatHex', drew = pitched ? 'its pitched roofs in (issue #73)' : 'it in before the install';
  intent.notes = [...(typeof intent.notes === 'string' ? [intent.notes] : intent.notes ?? []), `${what} ${reading.hex}: the PDOK orthophoto's reading of this pand (roof-facts 14/${at}: slot ${reading.slot}, rgb ${reading.rgb.join('/')}, confidence ${reading.confidence}; roof-flat.ts${pitched ? ' --pitched' : ''}), the colour the city drew ${drew}.`];
  fs.writeFileSync(intentFile, JSON.stringify(intent, null, indent) + '\n');
}
