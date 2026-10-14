/**
 * Lists `kind: large` houses whose installed GLB predates the current compiled mesh.
 *
 *   node --import tsx scripts/building-recipes/stale-installs.ts [--ids]
 *
 * The installed GLB is quantized, so its bytes cannot be compared with `large-mesh-golden.json` (a hash of the
 * compiled positions). Instead: read the golden as it stood at the commit that last touched the installed GLB (or the
 * earliest recorded hash when the golden did not exist yet) and compare with today's. A house with no installed GLB is
 * reported separately.
 */
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const HOUSES = 'scripts/building-recipes/houses', GOLDEN = 'scripts/building-recipes/large-mesh-golden.json', MODELS = 'public/canal-drive/models/ordinary-buildings';
const git = (...a: string[]) => execFileSync('/usr/bin/git', a, {encoding: 'utf8', maxBuffer: 1 << 28}).trim();
const order = new Map(git('log', '--format=%H').split('\n').map((sha, i) => [sha, i] as const));
/** Commits that rewrote the golden, newest first, each with its parsed content (cached lazily). */
const goldenCommits = git('log', '--format=%H', '--', GOLDEN).split('\n').filter(Boolean);
const content = new Map<string, Record<string, string>>();
const goldenAt = (sha: string) => { if (!content.has(sha)) content.set(sha, JSON.parse(git('show', `${sha}:${GOLDEN}`))); return content.get(sha)!; };
/** The hash the house had when its GLB was last installed. Log order is newest first, so a larger index is older. */
function hashAtInstall(id: string, glbSha: string) {
  const at = order.get(glbSha)!;
  for (const sha of goldenCommits) if (order.get(sha)! >= at && goldenAt(sha)[id]) return goldenAt(sha)[id];
  for (const sha of [...goldenCommits].reverse()) if (goldenAt(sha)[id]) return goldenAt(sha)[id];
  return undefined;
}

export function staleInstalls() {
  const golden: Record<string, string> = JSON.parse(fs.readFileSync(GOLDEN, 'utf8'));
  const stale: {id: string; installed: string | undefined; golden: string}[] = [], notInstalled: string[] = [];
  for (const id of fs.readdirSync(HOUSES).sort()) {
    const f = path.join(HOUSES, id, 'intent.json');
    if (!fs.existsSync(f) || JSON.parse(fs.readFileSync(f, 'utf8')).kind !== 'large') continue;
    const glb = path.join(MODELS, `recipe-large-${id}.glb`);
    if (!fs.existsSync(glb)) { notInstalled.push(id); continue; }
    const then = hashAtInstall(id, git('log', '-1', '--format=%H', '--', glb));
    if (then !== golden[id]) stale.push({id, installed: then, golden: golden[id]});
  }
  return {stale, notInstalled};
}
if (process.argv[1]?.endsWith('stale-installs.ts')) {
  const {stale, notInstalled} = staleInstalls();
  if (process.argv.includes('--ids')) console.log(stale.map(s => s.id).join(','));
  else {
    for (const s of stale) console.log(`${s.id}: golden at install ${s.installed} -> ${s.golden}`);
    console.log(`${stale.length} stale installs${notInstalled.length ? `; not installed: ${notInstalled.join(', ')}` : ''}`);
  }
}
