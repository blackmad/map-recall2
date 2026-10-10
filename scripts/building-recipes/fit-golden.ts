/**
 * Byte-identity guard for per-house recipes: fits every scripts/building-recipes/houses/<id> intent with the
 * deterministic fit and compares a sha256 of the fitted recipe + report to fit-golden.json. Schema additions
 * must leave houses that do not opt in unchanged; an intentional change re-records with --write (review the diff).
 *
 *   node --import tsx scripts/building-recipes/fit-golden.ts [--write]
 */
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {fitIntent} from '../../src/canalRecall/buildingRecipe/fit.ts';
import {resolveIntent} from '../../src/canalRecall/buildingRecipe/compile.ts';
import type {BuildingFacts} from '../../src/canalRecall/buildingRecipe/facts.ts';

const HOUSES = 'scripts/building-recipes/houses', GOLDEN = 'scripts/building-recipes/fit-golden.json';
const raw = (id: string) => JSON.parse(fs.readFileSync(`${HOUSES}/${id}/intent.json`, 'utf8'));

/** sha256 (16 hex) of the fitted recipe, anchor and report for every house directory. */
export function fitHashes(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const id of fs.readdirSync(HOUSES).sort()) {
    if (!fs.existsSync(`${HOUSES}/${id}/intent.json`)) continue;
    try {
      const facts: BuildingFacts = JSON.parse(fs.readFileSync(`${HOUSES}/${id}/facts.json`, 'utf8'));
      const fit = fitIntent(resolveIntent(raw(id), raw), facts);
      out[id] = createHash('sha256').update(JSON.stringify({anchorRD: fit.anchorRD, recipe: fit.recipe, report: fit.report})).digest('hex').slice(0, 16);
    } catch (e) { out[id] = `error: ${(e as Error).message.slice(0, 80)}`; }
  }
  return out;
}

export const readGolden = (): Record<string, string> => JSON.parse(fs.readFileSync(GOLDEN, 'utf8'));

if (process.argv[1]?.endsWith('fit-golden.ts')) {
  const now = fitHashes();
  if (process.argv.includes('--write')) {
    fs.writeFileSync(GOLDEN, JSON.stringify(now, null, 1) + '\n');
    console.log(`recorded ${Object.keys(now).length} houses`);
  } else {
    const golden = readGolden(), bad = Object.keys({...golden, ...now}).filter(k => golden[k] !== now[k]);
    for (const k of bad) console.log(`CHANGED ${k}: ${golden[k]} -> ${now[k]}`);
    console.log(bad.length ? `${bad.length} house recipes changed` : `all ${Object.keys(now).length} house recipes identical`);
    process.exit(bad.length ? 1 : 0);
  }
}
