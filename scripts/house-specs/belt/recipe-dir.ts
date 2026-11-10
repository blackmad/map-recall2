// Preview helper (lane belt-haarlemmer): materialise a spec's recipe-route house directory the way house:publish step 3 does
// (toRecipe -> houses/spec-<pandId>/intent.json, facts.ts) so `house:preview <pand> --recipe --photo` can compile it.
// The directory is a scratch artefact of the preview; remove it with --clean. Not committed (the integrator's publish owns it).
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { toRecipe } from '../../../src/canalRecall/houseSpec/toRecipe.ts';

export const HELP = `belt/recipe-dir.ts: materialise (or --clean) scratch recipe-route house directories for house:preview --recipe.

  node --import tsx scripts/house-specs/belt/recipe-dir.ts <pandId...> [--clean] [--help]

Writes scripts/building-recipes/houses/spec-<pandId>/{intent,facts}.json from scripts/house-specs/specs/<pandId>.json, the way
house:publish step 3 does. Scratch: remove with --clean before committing (publish recreates them).`;

const [, , ...ids] = process.argv;
if (ids.includes('--help')) { console.log(HELP); process.exit(0); }
const clean = ids.includes('--clean');
for (const id of ids.filter(a => /^\d{16}$/.test(a))) {
  const dir = `scripts/building-recipes/houses/spec-${id}`;
  if (clean) { rmSync(dir, { recursive: true, force: true }); continue; }
  const spec = JSON.parse(readFileSync(`scripts/house-specs/specs/${id}.json`, 'utf8'));
  const intent = toRecipe(spec);
  if (!intent) { console.error(id, 'not recipe-eligible'); process.exitCode = 1; continue; }
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/intent.json`, JSON.stringify(intent, null, 1) + '\n');
  execFileSync(process.execPath, ['--import', 'tsx', 'scripts/building-recipes/facts.ts', `--house=spec-${id}`, `--pand=${id}`, '--no-photo'], { stdio: 'pipe' });
  console.log(id, 'ok');
}
