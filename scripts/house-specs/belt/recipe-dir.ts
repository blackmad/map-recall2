// Preview helper (lane belt-haarlemmer): materialise a spec's recipe-route house directory the way house:publish step 3 does
// (toRecipe -> houses/spec-<pandId>/intent.json, facts.ts) so `house:preview <pand> --recipe --photo` can compile it.
// The directory is a scratch artefact of the preview; remove it with --clean. Not committed (the integrator's publish owns it).
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { toRecipe } from '../../../src/canalRecall/houseSpec/toRecipe.ts';

const [, , ...ids] = process.argv;
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
