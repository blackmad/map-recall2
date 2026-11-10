// house:stage (house line H3, docs/house-line.md section 3): the last station a lane runs. Validates a spec, attaches the
// preview's receipt and writes artifacts/house-specs/staging/<pandId>.json. Nothing under public/ changes; the
// integrator's house:publish reads the staging directory.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { makeStaged, verdictOf, type Receipt } from '../../src/canalRecall/houseSpec/staged.ts';
import { specProblems } from '../../src/canalRecall/houseSpec/spec.ts';

export const HELP = `house:stage: validate a HouseSpec, attach the preview receipt, write it to the staging directory.

  npm run house:stage -- <spec.json|pandId> [--note "..."] [--by <name>] [--preview-dir <dir>]
                                           [--no-receipt "<reason>"] [--stale-receipt]
  --help                                   this text

<spec.json|pandId>   a spec file, or a 16-digit pand id read from scripts/house-specs/specs/<pandId>.json
--note "..."         free text kept with the staged spec (shown in the publish table)
--by <name>          who staged it (default: git user.name, else $USER)
--preview-dir <dir>  where house:preview wrote this pand's measure.json and compare.png
                     (default artifacts/house-preview/<pandId>)
--no-receipt "<r>"   stage without a preview receipt; the reason is recorded and shown at publish (use it only when the
                     preview cannot draw this house, and say what stands in for it)
--stale-receipt      accept a measure.json older than the spec file (default: refused, the receipt must be of this spec)

Writes artifacts/house-specs/staging/<pandId>.json = {spec, stagedAt, by, note, receipt}. Lanes stop here: house:publish is
the integrator's (batch, covers, goldens, check:canal). A pand already staged is replaced.`;

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
export const STAGING_DIR = path.join(ROOT, 'artifacts/house-specs/staging');
const sha = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');

function flag(args: string[], name: string): string | undefined {
  const i = args.findIndex(a => a === `--${name}` || a.startsWith(`--${name}=`));
  if (i < 0) return undefined;
  return args[i].includes('=') ? args[i].slice(name.length + 3) : args[i + 1];
}

function gitUser(): string {
  try { return execFileSync('/usr/bin/git', ['config', 'user.name'], { encoding: 'utf8', cwd: ROOT }).trim() || process.env.USER || 'unknown'; } catch { return process.env.USER || 'unknown'; }
}

function main(args: string[]): number {
  if (args.includes('--help') || !args.length) { console.log(HELP); return args.length ? 0 : 1; }
  const valued = new Set(['note', 'by', 'preview-dir', 'no-receipt']);
  const positional = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--') && !args[i - 1].includes('=') && valued.has(args[i - 1].slice(2))));
  const target = positional[0];
  if (!target) { console.error('house:stage: a spec file or pand id is required (--help)'); return 1; }
  const file = /^\d{16}$/.test(target) ? path.join(ROOT, 'scripts/house-specs/specs', `${target}.json`) : path.resolve(target);
  if (!existsSync(file)) { console.error(`house:stage: ${target} not found (${path.relative(ROOT, file)})`); return 1; }
  const raw = JSON.parse(readFileSync(file, 'utf8'));
  const problems = specProblems(raw);
  if (problems.length) { console.error(`house:stage: ${path.relative(ROOT, file)} is not a valid spec:\n  ${problems.join('\n  ')}`); return 1; }
  const pandId = String(raw.pandId);

  let receipt: Receipt;
  const noReceipt = flag(args, 'no-receipt');
  if (args.some(a => a === '--no-receipt' || a.startsWith('--no-receipt='))) {
    if (!noReceipt || noReceipt.startsWith('--')) { console.error('house:stage: --no-receipt needs a reason'); return 1; }
    receipt = { kind: 'none', reason: noReceipt };
  } else {
    const dir = path.resolve(flag(args, 'preview-dir') ?? path.join(ROOT, 'artifacts/house-preview', pandId));
    const measureFile = path.join(dir, 'measure.json'), compareFile = path.join(dir, 'compare.png');
    const missing = [measureFile, compareFile].filter(f => !existsSync(f));
    if (missing.length) {
      console.error(`house:stage: no preview receipt for ${pandId}; missing ${missing.map(f => path.relative(ROOT, f)).join(', ')}\n  run: npm run house:preview -- ${pandId}   (or stage with --no-receipt "<reason>")`);
      return 1;
    }
    if (!args.includes('--stale-receipt') && statSync(measureFile).mtimeMs < statSync(file).mtimeMs) {
      console.error(`house:stage: ${path.relative(ROOT, measureFile)} is older than ${path.relative(ROOT, file)}; re-run house:preview so the receipt is of this spec (--stale-receipt to accept)`);
      return 1;
    }
    const measure = JSON.parse(readFileSync(measureFile, 'utf8')) as Record<string, unknown>;
    receipt = { kind: 'preview', measure, measurePath: path.relative(ROOT, measureFile), comparePath: path.relative(ROOT, compareFile), verdict: verdictOf(measure), measureSha256: sha(measureFile), compareSha256: sha(compareFile) };
  }

  const staged = makeStaged({ spec: raw, by: flag(args, 'by') ?? gitUser(), note: flag(args, 'note'), receipt });
  mkdirSync(STAGING_DIR, { recursive: true });
  const out = path.join(STAGING_DIR, `${pandId}.json`);
  writeFileSync(out, JSON.stringify(staged, null, 1) + '\n');
  console.log(`staged ${pandId} (${staged.spec.route ?? 'generic'}; ${receipt.kind === 'preview' ? `receipt ${receipt.verdict ?? 'measured'}` : `no receipt: ${receipt.reason}`}) -> ${path.relative(ROOT, out)}`);
  console.log('Nothing under public/ changed. The integrator publishes the batch with: npm run house:publish');
  return 0;
}

if (process.argv[1]?.endsWith('stage.ts')) process.exit(main(process.argv.slice(2)));
