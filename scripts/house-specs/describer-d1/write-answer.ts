// Describer answer writer (lane D1): a describing agent pipes one JSON object (the keys of scripts/house-line/describer/prompt-v1.md)
// into this script; it adds the identity (v, pandId, image from the sample, reader), validates (src/canalRecall/houseSpec/describer.ts)
// and writes <out>/<pandId>.json. A validation error prints every problem and exits 1, so the agent fixes and re-sends.
//
//   echo '{...}' | node --import tsx scripts/house-specs/describer-d1/write-answer.ts <pandId> --reader "D1 opus" [--out <dir>]
//   echo '{"readable":true,"sameAs":"left","mirrored":true}' | ... write-answer.ts <pandId> --twins --reader "D1 opus"   twin pass
//   node --import tsx scripts/house-specs/describer-d1/write-answer.ts --shard <from>:<to> [--sample <file>]   list a shard's pands + images
//
// --out defaults to artifacts/describer-d1/answers; a second description set (another model, or the P3a game-render half) uses its own
// --out and an --image-kind/--image-ref pair instead of the sample's image.
import fs from 'node:fs';
import path from 'node:path';
import { ANSWERS_DIR, twinProblems, writeAnswer } from '../../../src/canalRecall/houseSpec/describer.ts';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const argv = process.argv.slice(2);
const opt = (n: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
const sample = JSON.parse(fs.readFileSync(opt('sample') ?? path.join(ROOT, 'artifacts/describer-d1/sample.json'), 'utf8'));

if (opt('shard')) {
  const [a, b] = opt('shard')!.split(':').map(Number);
  for (const r of sample.rows.slice(a, b)) console.log(`${r.pandId} ${r.image.local}`);
  process.exit(0);
}
const pandId = argv.find(x => /^\d{16}$/.test(x));
if (!pandId) { console.error('give a 16-digit pandId'); process.exit(2); }
const row = sample.rows.find((r: any) => r.pandId === pandId);
const raw = fs.readFileSync(0, 'utf8');
let body: any;
try { body = JSON.parse(raw.trim().replace(/^```(json)?|```$/g, '')); } catch (e) { console.error(`not JSON: ${(e as Error).message}`); process.exit(1); }
const image = opt('image-ref')
  ? { ref: opt('image-ref')!, kind: opt('image-kind') ?? 'render', tier: null, year: null, gate: null }
  : row ? { ref: row.image.ref, kind: row.image.kind, tier: row.image.tier, year: row.image.year, gate: row.image.gate } : null;
if (!image && !argv.includes('--twins')) { console.error(`${pandId} is not in the sample; pass --image-ref and --image-kind`); process.exit(2); }
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
