/**
 * Jordaan belt builder (issue #366): readings.json -> specs/<pandId>.json, complete HouseSpecs (fronts, roof, palette) so
 * that each resolves to the recipe route (toRecipe) and house:publish installs a spec-generated GLB.
 *
 * A reading is the photo read of one pand (strip at 40 px/m with a metre grid): `front` / `roof` / `palette` in the intent
 * vocabulary, over the Jordaan defaults below (the jordaan-1750-neck-gable / jordaan-1850-cornice-house type bodies).
 * Every written field gets an `author` receipt naming the photo and the reading; defaults the photo does not contradict are
 * marked so in the receipt ("default"). `limits` are the schemaLimits (what the kit cannot say).
 *
 *   node --import tsx scripts/house-specs/belt-jordaan-20261110/make-specs.ts [--check]
 *
 * --check  validate only (validateSpec + toRecipe), write nothing. Unchanged specs keep their mtime (house:stage receipt rule).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateSpec, type HouseSpec, type Prov } from '../../../src/canalRecall/houseSpec/spec.ts';
import { toRecipe } from '../../../src/canalRecall/houseSpec/toRecipe.ts';
import { validateIntent } from '../../../src/canalRecall/buildingRecipe/intent.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
type Reading = {
  address: string; photo: string; date: string; why: string; confidence?: number;
  front: Record<string, unknown>; roof?: Record<string, unknown>; palette?: Record<string, unknown>;
  facts?: Record<string, unknown>; limits?: { component: string; what: string }[]; skip?: string;
};
const FRONT_DEFAULTS = { id: 'front0', basement: 'none', cornice: 'none', windows: 'sash', windowSurround: 'sill', hoist: false };
const PALETTE_DEFAULTS = { frame: 'white-painted', door: '#26302a', stone: '#ebe8df', cornice: '#ebe8df', stoneMaterial: 'painted' };
const ROOF_DEFAULTS = { material: 'red-tile' };

export function specFor(pandId: string, r: Reading): HouseSpec {
  const at = r.date, conf = r.confidence ?? 0.85, read = `belt-jordaan hand read of ${r.photo}: ${r.why}`;
  const prov = (stated: boolean): Prov => ({ source: 'author', confidence: stated ? conf : 0.6, ref: stated ? read : `${read} (Jordaan type default, not contradicted by the photo)`, at });
  const street = r.address.replace(/\s+\d.*$/, '');
  const front = { ...FRONT_DEFAULTS, street, ...r.front }, roof = { ...ROOF_DEFAULTS, ...r.roof }, palette = { ...PALETTE_DEFAULTS, ...r.palette };
  const provenance: Record<string, Prov> = {};
  for (const k of Object.keys(front)) provenance[`fronts/0/${k}`] = prov(k in r.front || k === 'street' || k === 'id');
  for (const k of Object.keys(roof)) provenance[`roof/${k}`] = prov(k in (r.roof ?? {}));
  for (const k of Object.keys(palette)) provenance[`palette/${k}`] = prov(k in (r.palette ?? {}));
  for (const k of Object.keys(r.facts ?? {})) provenance[`facts/${k}`] = prov(true);
  const spec: HouseSpec = { schemaVersion: 1, pandId, address: r.address, design: { fronts: [front], roof, palette } as HouseSpec['design'], provenance,
    ...(r.facts ? { facts: r.facts as HouseSpec['facts'] } : {}), ...(r.limits?.length ? { schemaLimits: r.limits } : {}) };
  return validateSpec(spec);
}

function main() {
  const check = process.argv.includes('--check');
  const readings = JSON.parse(fs.readFileSync(path.join(here, 'readings.json'), 'utf8')) as Record<string, Reading>;
  const out = path.join(here, 'specs'); fs.mkdirSync(out, { recursive: true });
  let ok = 0, bad = 0, skipped = 0;
  for (const [pandId, r] of Object.entries(readings)) {
    if (pandId.startsWith('_')) continue;
    if (r.skip) { skipped++; console.log(`skip ${pandId} ${r.address}: ${r.skip}`); continue; }
    try {
      const spec = specFor(pandId, r);
      if (!toRecipe(spec)) {
        // say why: validateIntent's own message
        const d = spec.design as never as Record<string, unknown>;
        try { validateIntent({ schemaVersion: 1, kind: 'canal-house', id: `spec-${pandId}`, pandId, address: r.address, sources: [{ id: 'x', kind: 'human-review', capturedAt: r.date }], ...d }); } catch (e) { throw new Error(`not recipe-route: ${(e as Error).message}`); }
        throw new Error('not recipe-route (no dated receipt?)');
      }
      ok++;
      if (!check) {
        const text = JSON.stringify(spec, null, 1) + '\n', f = path.join(out, `${pandId}.json`);
        if (!fs.existsSync(f) || fs.readFileSync(f, 'utf8') !== text) fs.writeFileSync(f, text);
      }
    } catch (e) { bad++; console.log(`FAIL ${pandId} ${r.address}: ${(e as Error).message}`); }
  }
  console.log(`${ok} recipe-route specs${check ? ' (checked)' : ' written'}, ${bad} failed, ${skipped} skipped`);
  if (bad) process.exitCode = 1;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();
