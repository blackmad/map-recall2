/**
 * Signature-inventory gate over the manual catalogue (check:canal):
 *
 *   node --import tsx scripts/landmarks/check-landmark-inventory.ts [--id=<id>] [--verbose]
 *
 * Every landmark first exported after 2026-10-13 (first commit of its GLB; never-committed counts as new), and every id in
 * INVENTORY_REQUIRED_IDS, must have scripts/landmarks/<id>-inventory.json with every photographed wall checked, every item
 * resolved (no `open`), no `needs-modeller`, no "no component" / "cannot express" excuse, and a signature whose items are
 * all modelled or simplified. Any inventory that exists is schema-checked; scripts/landmarks/ornament-inventory.json (the
 * retro-fit survey) is schema-checked leniently. Exit 1 on any failure.
 */
import fs from 'node:fs';
import path from 'node:path';
import {validateInventory, type LandmarkInventory} from '../../src/canalRecall/landmarks/ornamentInventory';
import {describeGate, inventoryGate} from './landmark-inventory-gate';

const ROOT = path.resolve(import.meta.dirname, '../..');
const only = process.argv.find(a => a.startsWith('--id='))?.slice(5);
const verbose = process.argv.includes('--verbose');
const catalogue = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/canalRecall/landmarks/manualCatalogue.json'), 'utf8')) as {id: string}[];
const withFile = fs.readdirSync(path.join(ROOT, 'scripts/landmarks')).filter(f => f.endsWith('-inventory.json') && f !== 'ornament-inventory.json')
  // Other lanes use the suffix for unrelated files (firestations-inventory.json); an ornament inventory has a signature.
  .filter(f => /"signature"\s*:/.test(fs.readFileSync(path.join(ROOT, 'scripts/landmarks', f), 'utf8'))).map(f => f.replace(/-inventory\.json$/, ''));
const ids = only ? [only] : [...new Set([...catalogue.map(c => c.id), ...withFile])].sort();

let failed = 0, required = 0;
for (const id of ids) {
  const g = inventoryGate(id);
  if (g.required) required++;
  if (!g.pass) failed++;
  if (!g.pass || g.exists || only || verbose) for (const line of describeGate(g)) if (verbose || only || !/^ {3}[* ] /.test(line)) console.log(line);
}

const survey = path.join(ROOT, 'scripts/landmarks/ornament-inventory.json');
if (fs.existsSync(survey) && !only) {
  const doc = JSON.parse(fs.readFileSync(survey, 'utf8')) as {landmarks: Record<string, LandmarkInventory>};
  let errors = 0;
  for (const [id, inv] of Object.entries(doc.landmarks ?? {})) for (const i of validateInventory(inv, {id})) if (i.severity === 'error') { errors++; console.log(`FAIL ornament-inventory.json ${id} ${i.path}: ${i.message}`); }
  console.log(`${errors ? 'FAIL' : 'PASS'} ornament-inventory.json: ${Object.keys(doc.landmarks ?? {}).length} landmarks schema-checked`);
  if (errors) failed++;
}
console.log(`${ids.length} landmarks, ${required} require an inventory, ${failed} fail`);
process.exit(failed ? 1 : 0);
