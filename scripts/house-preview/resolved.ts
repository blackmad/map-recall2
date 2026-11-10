/**
 * house:preview of a spec AS THE GAME WILL DRAW IT after house:publish (lane H7, #354).
 *
 * `house:preview --spec` writes a spec's gable and wall colour straight onto the pand's properties ("Overrides"), so it
 * draws a wall colour the game holds (decorate.ts SPEC_WALLS_HELD) and never shows the recipe route. This script instead
 * runs the publish's own merge (build-house-specs --extra-specs) into the STAGED extract, then renders each pand by the
 * route its resolved spec takes: generic (the chain reads the staged extract through HOUSE_SPECS_DIR, so every hold and
 * the register merge apply as in the game) or recipe (toRecipe(resolved spec) written as house:publish step 3 writes it,
 * then house:preview --recipe). Nothing under public/ changes except the staged extract (staging/house-specs); a house
 * directory written for the render is removed (or restored) on exit.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { blockFaceFactsFor, mergeRecipeIntent } from '../../src/canalRecall/houseSpec/publishPlan.ts';
import { REPO_ROOT } from './nodeDom.ts';

export const HELP = `scripts/house-preview/resolved.ts: render specs as the game will draw them after house:publish.

  node --import tsx scripts/house-preview/resolved.ts --specs <dir> <pandId,...> [house:preview flags]

  --specs <dir>     a directory of hand specs <pandId>.json (the batch being prepared); resolved with every other source by
                    build-house-specs --extra-specs <dir> into public/data/extracts/amsterdam/staging/house-specs
  <pandId,...>      the pands to render (each needs no spec of its own: a pand without one renders from the staged extract)
  --out-root <dir>  write each pand to <dir>/<pandId> (default artifacts/house-preview/<pandId>, the house:stage receipt dir)
  --no-recipe       render recipe-route pands on the generic path too (what the game draws if the install is held)
  env RESOLVED_VERBOSE=1  print a failed render's whole error output (default: its first three error lines)
  --help            this text
  every other flag (--photo, --crops <dir>, --wall <edge|deg>, --threeq, ...) is passed to house:preview

Route per pand: recipe when the resolved spec validates as a CanalHouseIntent (toRecipe; house:publish step 3 then installs
a GLB): the intent is written to scripts/building-recipes/houses/<the house dir naming the pand, else spec-<pandId>>/intent.json
with mergeRecipeIntent, a new directory's facts are the block face's facts.json when the pand is on a face (the frontage
chord over an erker), else facts.ts --no-photo, and house:preview --recipe renders the compile;
the directory is removed (or restored) when the script exits.
Otherwise generic: HOUSE_SPECS_DIR=staging/house-specs house:preview <pandId>.`;

const argv = process.argv.slice(2);
if (argv.includes('--help') || argv.length === 0) { console.log(HELP); process.exit(0); }
const take = (flag: string) => { const i = argv.indexOf(flag); if (i < 0) return undefined; const v = argv[i + 1]; argv.splice(i, 2); return v; };
const specs = take('--specs'), outRoot = take('--out-root');
const noRecipe = argv.includes('--no-recipe'); if (noRecipe) argv.splice(argv.indexOf('--no-recipe'), 1);
const pandArg = argv.find(a => /^\d{16}(,\d{16})*$/.test(a));
if (!specs || !pandArg) { console.error(HELP); process.exit(2); }
const pass = argv.filter(a => a !== pandArg);
const pands = pandArg.split(',');
const tsx = (script: string, args: string[], env: NodeJS.ProcessEnv = {}) => execFileSync(process.execPath, ['--import', 'tsx', script, ...args], { cwd: REPO_ROOT, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 << 20 }).toString();
const readJson = (p: string) => JSON.parse(fs.readFileSync(p, 'utf8'));

const t0 = performance.now();
const intents = path.join(REPO_ROOT, 'artifacts/house-preview/resolved-intents');
fs.rmSync(intents, { recursive: true, force: true });
tsx('scripts/house-specs/build-house-specs.ts', ['--extra-specs', path.resolve(specs), '--emit-intents', intents, '--for', pands.join(',')]);
const mergeMs = Math.round(performance.now() - t0);
console.log(`merged ${specs} into staging/house-specs in ${mergeMs} ms`);

const HOUSES = path.join(REPO_ROOT, 'scripts/building-recipes/houses');
const FACES = path.join(REPO_ROOT, 'scripts/block-face/faces'), FACE_DIRS = fs.readdirSync(FACES).sort().map(f => path.join(FACES, f));
const byPand = new Map<string, string>();
for (const d of fs.readdirSync(HOUSES)) { const f = path.join(HOUSES, d, 'intent.json'); if (fs.existsSync(f)) { const j = readJson(f); if (j.pandId && j.kind === 'canal-house') byPand.set(String(j.pandId).replace('NL.IMBAG.Pand.', ''), d); } }

const cleanups: (() => void)[] = [];
process.on('exit', () => { for (const c of cleanups) c(); });
for (const pand of pands) {
  const t1 = performance.now(), out = path.join(outRoot ? path.resolve(outRoot) : path.join(REPO_ROOT, 'artifacts/house-preview'), pand);
  const intentFile = path.join(intents, `${pand}.json`);
  let args: string[];
  if (fs.existsSync(intentFile) && !noRecipe) {
    const generated = readJson(intentFile), id = byPand.get(pand) ?? `spec-${pand}`, file = path.join(HOUSES, id, 'intent.json');
    // A house directory this script creates is removed after the render (house:publish step 3 writes it for real); an
    // existing one is restored, so the working tree is as it was.
    if (!fs.existsSync(path.dirname(file))) cleanups.push(() => fs.rmSync(path.dirname(file), { recursive: true, force: true }));
    else { const before = fs.readFileSync(file); cleanups.push(() => fs.writeFileSync(file, before)); }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(mergeRecipeIntent(fs.existsSync(file) ? readJson(file) : null, generated, id), null, 1) + '\n');
    if (!fs.existsSync(path.join(HOUSES, id, 'facts.json'))) {
      // A pand on a block face starts from the face's facts (blockFaceFactsFor: the frontage chord over a BAG erker).
      const faceFacts = blockFaceFactsFor(pand, FACE_DIRS, fs.existsSync);
      if (faceFacts) fs.copyFileSync(faceFacts, path.join(HOUSES, id, 'facts.json'));
      else {
        const street = /^(.*?)\s+\d/.exec(String(generated.address ?? ''))?.[1];
        tsx('scripts/building-recipes/facts.ts', [`--house=${id}`, `--pand=${pand}`, ...(street ? [`--street=${street}`] : []), '--no-photo']);
      }
    }
    args = [pand, '--recipe', id, ...pass, '--out', out];
    console.log(`${pand}: route recipe -> scripts/building-recipes/houses/${id}`);
  } else {
    args = [pand, ...pass, '--out', out];
    console.log(`${pand}: route generic (staged extract)`);
  }
  let log: string;
  try { log = tsx('scripts/house-preview/preview.ts', args, { HOUSE_SPECS_DIR: 'staging/house-specs' }); }
  catch (e) {
    const err = e as { stderr?: Buffer; stdout?: Buffer; message: string };
    const text = String(err.stderr ?? err.stdout ?? err.message).trim();
    console.log(`  FAILED: ${process.env.RESOLVED_VERBOSE ? text : text.split('\n').filter(l => /Error|error|fail/i.test(l)).slice(0, 3).join(' | ')}`);
    process.exitCode = 1;
    continue;
  }
  process.stdout.write(log.split('\n').filter(l => /verdict|render:|photo:|reasons|warns/.test(l)).map(l => `  ${l.trim()}`).join('\n') + '\n');
  console.log(`  ${Math.round(performance.now() - t1)} ms -> ${path.relative(process.cwd(), out)}`);
}
