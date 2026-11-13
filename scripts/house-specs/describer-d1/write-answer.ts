// Describer answer writer (lane D1): a describing agent pipes one JSON object (the keys of scripts/house-line/describer/prompt-v1.md)
// into this script; it adds the identity (v, pandId, image from the sample, reader), validates (src/canalRecall/houseSpec/describer.ts)
// and writes <out>/<pandId>.json. A validation error prints every problem and exits 1, so the agent fixes and re-sends.
//
//   echo '{...}' | node --import tsx scripts/house-specs/describer-d1/write-answer.ts <pandId> --reader "D1 opus" [--out <dir>]
//   echo '{"readable":true,"sameAs":"left","mirrored":true}' | ... write-answer.ts <pandId> --twins --reader "D1 opus"   twin pass
//   echo '{...window-v1 keys...}' | ... write-answer.ts <pandId> --window --reader "D1 opus"   zoomed window read
//   node --import tsx scripts/house-specs/describer-d1/write-answer.ts --shard <from>:<to> [--kind crop] [--sample <file>]   list a shard's pands + images
//
// --out defaults to artifacts/describer-d1/answers; a second description set (another model, or the P3a game-render half) uses its own
// --out and an --image-kind/--image-ref pair instead of the sample's image.
import fs from 'node:fs';
import path from 'node:path';
import { ANSWERS_DIR, twinProblems, writeAnswer } from '../../../src/canalRecall/houseSpec/describer.ts';
import { WINDOWS } from '../../../src/canalRecall/buildingRecipe/intent.ts';

/** labels.md storey count from the v4 parts: the full storeys below the eaves or cornice (ground included); not-visible stays. */
export const storeysFromParts = (sp: { full: number | 'not-visible' }): number | 'not-visible' => sp.full;

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const argv = process.argv.slice(2);
const opt = (n: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
const sample = JSON.parse(fs.readFileSync(opt('sample') ?? path.join(ROOT, 'artifacts/describer-d1/sample.json'), 'utf8'));

if (opt('shard')) {
  const [a, b] = opt('shard')!.split(':').map(Number);
  const rows = opt('kind') ? sample.rows.filter((r: any) => r.image.kind === opt('kind')) : sample.rows;
  for (const r of rows.slice(a, b)) console.log(`${r.pandId} ${r.image.local}`);
  process.exit(0);
}
const pandId = argv.find(x => /^\d{16}$/.test(x));
if (!pandId) { console.error('give a 16-digit pandId'); process.exit(2); }
const row = sample.rows.find((r: any) => r.pandId === pandId);
const raw = fs.readFileSync(0, 'utf8');
let body: any;
try { body = JSON.parse(raw.trim().replace(/^```(json)?|```$/g, '')); } catch (e) { console.error(`not JSON: ${(e as Error).message}`); process.exit(1); }
// prompt v4: storeys come from the storey parts (labels.md count = full storeys below the eaves/cornice; the roof storey and a
// souterrain never count), colour from the wall sample: wallFamily is not asked
const v4 = body && typeof body === 'object' && body.storeyParts !== undefined;
if (v4) {
  const sp = body.storeyParts, nv = (x: unknown) => x === 'not-visible';
  const bad = [
    !(nv(sp?.full) || (Number.isInteger(sp?.full) && sp.full >= 1 && sp.full <= 30)) && 'storeyParts.full: 1..30 or not-visible',
    !(nv(sp?.roof) || ['mansard', 'gable-attic', 'roof-storey', 'dormers', 'none'].includes(sp?.roof)) && 'storeyParts.roof: mansard|gable-attic|roof-storey|dormers|none|not-visible',
    !(nv(sp?.souterrain) || typeof sp?.souterrain === 'boolean') && 'storeyParts.souterrain: boolean or not-visible',
    !(body.pale === undefined || nv(body.pale) || typeof body.pale === 'boolean') && 'pale: boolean or not-visible',
  ].filter(Boolean);
  if (bad.length) { console.error(bad.join('\n')); process.exit(1); }
  body.storeys = storeysFromParts(sp);
  if (sp.souterrain === true) body.souterrain = true;
  body.wallFamily ??= 'not-visible';
  if (body.pale === 'not-visible') delete body.pale;
}
const image = opt('image-ref')
  ? { ref: opt('image-ref')!, kind: opt('image-kind') ?? 'render', tier: null, year: null, gate: null }
  : row ? { ref: row.image.ref, kind: row.image.kind, tier: row.image.tier, year: row.image.year, gate: row.image.gate } : null;
if (!image && !argv.includes('--twins') && !argv.includes('--window')) { console.error(`${pandId} is not in the sample; pass --image-ref and --image-kind`); process.exit(2); }
if (argv.includes('--window')) {
  // zoomed window read (scripts/house-line/describer/window-v1.md): <out default artifacts/describer-d1/answers-window>/<pandId>.json
  const W: Record<string, string[]> = {
    paneLayout: ['single', 'two-pane', 'multi-pane', 'top-light', 'mixed'], head: ['flat', 'segmental', 'round', 'relieving', 'pointed'],
    sills: ['none', 'stone', 'consoles'], windowSurround: ['none', 'stone-lintel', 'full-frame', 'keystone', 'eared-keystone', 'dentil-lintel', 'jack-blocks', 'sill'],
  };
  const bad: string[] = [];
  for (const [k, vs] of Object.entries(W)) if (!(body[k] === 'not-visible' || vs.includes(body[k]))) bad.push(`${k}: ${vs.join('|')}|not-visible`);
  if (!(body.windows === 'not-visible' || body.windows === 'tall-upper' || WINDOWS.includes(body.windows))) bad.push('windows: the WINDOWS enum, tall-upper or not-visible');
  if (!(body.whiteFrames === undefined || body.whiteFrames === 'not-visible' || typeof body.whiteFrames === 'boolean')) bad.push('whiteFrames: boolean or not-visible');
  if (bad.length) { console.error(bad.join('\n')); process.exit(1); }
  const dir = opt('out') ?? path.join(ROOT, 'artifacts/describer-d1/answers-window');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${pandId}.json`), `${JSON.stringify({ v: 1, pandId, image: opt('image-ref') ?? `artifacts/describer-d1/windows/${pandId}.jpg`, reader: opt('reader') ?? 'D1', ...body }, null, 1)}\n`);
  console.log(`ok window ${pandId}`);
  process.exit(0);
}
if (argv.includes('--twins')) {
  // twin pass (prompt v2 sameAs/mirrored only): <out default artifacts/describer-d1/answers-twins>/<pandId>.json
  const a = { v: 1, pandId, image: { ref: `artifacts/describer-d1/twin-images/${pandId}.jpg`, kind: 'crop', gate: null }, reader: opt('reader') ?? 'D1', ...body };
  const p = twinProblems(a);
  if (p.length) { console.error(p.join('\n')); process.exit(1); }
  const dir = opt('out') ?? path.join(ROOT, 'artifacts/describer-d1/answers-twins');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${pandId}.json`), `${JSON.stringify(a, null, 1)}\n`);
  console.log(`ok twins ${pandId}`);
  process.exit(0);
}
try {
  const file = writeAnswer(opt('out') ?? ANSWERS_DIR(ROOT), { v: 1, pandId, image, reader: opt('reader') ?? 'D1', ...body });
  console.log(`ok ${path.relative(ROOT, file)}`);
} catch (e) { console.error((e as Error).message); process.exit(1); }
