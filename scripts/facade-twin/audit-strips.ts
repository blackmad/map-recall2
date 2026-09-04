/**
 * Ask a vision model what each rectified strip actually shows.
 *
 * Written because a numeric audit passed and a visual one failed badly. The
 * medians in `FACADE_STATE.md` agree with independent sources to a centimetre,
 * and a random sample of fourteen strips turned out to contain views down a
 * street, a blank white frame, and a bridge parapet with the ironwork boxed as
 * windows. Aggregate statistics can look right while half the inputs are
 * garbage, because garbage that is symmetric about the truth does not move a
 * median. The only way to know is to look at them, and there are 1,812.
 *
 * So: a local model looks instead. It is asked what fraction of the frame is
 * building façade — not "is this a façade", which anything with a building in
 * the corner passes — and to count windows independently. Its window count is
 * then compared with the detector's.
 *
 * The strips it reads are the *clean* ones, with no boxes drawn. Asking a model
 * whether the boxes are right while the boxes are on the image is asking it to
 * agree, and it will.
 *
 * This is a measuring instrument, not a source of truth: a 7B model is wrong
 * often enough that individual judgements mean little. The rate over a hundred
 * strips is what it is for, and the disagreements are where to look next.
 *
 * Usage:
 *   npx tsx scripts/facade-twin/audit-strips.ts --sample=100
 *   npx tsx scripts/facade-twin/audit-strips.ts --ids=<pandId>,<pandId>
 */
import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { AMSTERDAM_GRACHTENGORDEL_WEST } from '../../src/canalRecall/facade/areas.ts';

const AREA = AMSTERDAM_GRACHTENGORDEL_WEST;
const CLEAN = path.resolve('.cache/facade-twin/strips-clean');
const STAGING = path.resolve('public/data/extracts/amsterdam/staging/facade-twin', AREA.areaId);
const arg = (name: string) => process.argv.find(v => v.startsWith(`--${name}=`))?.slice(name.length + 3);
const MODEL = arg('model') ?? 'qwen2.5vl:7b';
const HOST = arg('host') ?? 'http://127.0.0.1:11434';

const PROMPT = `You are inspecting a photograph that is supposed to be a flat, straight-on elevation of ONE building's street frontage, cropped to that building only.

Answer with JSON and nothing else:
{"facadeShare": <0-100, percent of the image area that is actually building wall and its windows/doors>,
 "straightOn": true|false,
 "windows": <how many windows you can count>,
 "doors": <how many doors at street level>,
 "shows": "<at most 8 words: what the image mostly shows>",
 "problems": [<any of "sky","street","water","vegetation","vehicles","railing","interior","blurred","multiple buildings","not a building">]}

Be strict about facadeShare. If a large part of the frame is sky, road, water, a tree or a neighbouring building, say so and score it low.`;

interface Judgement {
  pandId: string; facadeShare: number; straightOn: boolean;
  windows: number; doors: number; shows: string; problems: string[];
}

async function ask(pandId: string): Promise<Judgement | null> {
  let image: string;
  try { image = (await readFile(path.join(CLEAN, `${pandId}.jpg`))).toString('base64'); }
  catch { return null; }
  const response = await fetch(`${HOST}/api/generate`, {
    method: 'POST',
    body: JSON.stringify({ model: MODEL, prompt: PROMPT, images: [image], stream: false,
      options: { temperature: 0, num_predict: 220 } }),
    signal: AbortSignal.timeout(180_000),
  });
  if (!response.ok) return null;
  const { response: text } = await response.json() as { response: string };
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    return {
      pandId,
      facadeShare: Number(parsed.facadeShare) || 0,
      straightOn: !!parsed.straightOn,
      windows: Number(parsed.windows) || 0,
      doors: Number(parsed.doors) || 0,
      shows: String(parsed.shows ?? '').slice(0, 60),
      problems: Array.isArray(parsed.problems) ? parsed.problems.map(String) : [],
    };
  } catch { return null; }
}

const evidence = JSON.parse(await readFile(path.join(STAGING, 'facade-evidence.json'), 'utf8')) as
  { facades: Array<{ pandId: string; openings: number; wallWidthM: number; standoffM: number; obliquityDeg: number; pixelsPerMetre: number; plausibility: number }> };
const byId = new Map(evidence.facades.map(f => [f.pandId, f]));

const available = new Set((await readdir(CLEAN).catch(() => [] as string[]))
  .filter(f => f.endsWith('.jpg')).map(f => f.replace('.jpg', '')));
const explicit = (arg('ids') ?? '').split(',').filter(Boolean);
// Deterministic spread across the id space, so a rerun audits the same strips
// and two runs are comparable.
const ordered = [...available].sort();
const want = Number(arg('sample') ?? 100);
const queue = explicit.length ? explicit
  : ordered.filter((_, i) => i % Math.max(1, Math.floor(ordered.length / want)) === 0).slice(0, want);

console.log(`${MODEL} auditing ${queue.length} clean strips of ${available.size} rendered\n`);
const results: Judgement[] = [];
for (const pandId of queue) {
  const judgement = await ask(pandId);
  if (!judgement) { process.stdout.write('·'); continue; }
  results.push(judgement);
  process.stdout.write(judgement.facadeShare >= 60 ? '#' : judgement.facadeShare >= 30 ? '+' : '-');
  if (results.length % 50 === 0) process.stdout.write(` ${results.length}\n`);
}
console.log('\n');

const share = (test: (j: Judgement) => boolean) =>
  `${results.filter(test).length} (${(100 * results.filter(test).length / Math.max(results.length, 1)).toFixed(0)}%)`;
console.log(`n = ${results.length} judged`);
console.log(`  mostly façade (≥60%)      ${share(j => j.facadeShare >= 60)}`);
console.log(`  partly façade (30–59%)    ${share(j => j.facadeShare >= 30 && j.facadeShare < 60)}`);
console.log(`  NOT a façade (<30%)       ${share(j => j.facadeShare < 30)}`);
console.log(`  read as straight-on       ${share(j => j.straightOn)}`);

const problems = new Map<string, number>();
for (const j of results) for (const p of j.problems) problems.set(p, (problems.get(p) ?? 0) + 1);
console.log('\nwhat is in frame that should not be:');
for (const [name, n] of [...problems.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(4)}  ${name}`);
}

// The comparison that matters: does the detector find what a viewer sees?
const paired = results.map(j => ({ j, f: byId.get(j.pandId)! })).filter(p => p.f);
const diffs = paired.map(p => p.f.openings - p.j.windows - p.j.doors);
const median = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] ?? 0;
console.log(`\ndetector openings vs model count (n=${paired.length}):`);
console.log(`  median difference        ${median(diffs) > 0 ? '+' : ''}${median(diffs)}`);
console.log(`  detector finds ≥2 more   ${paired.filter((_, i) => diffs[i] >= 2).length}`);
console.log(`  detector finds ≥2 fewer  ${paired.filter((_, i) => diffs[i] <= -2).length}`);
console.log(`  within 1                 ${paired.filter((_, i) => Math.abs(diffs[i]) <= 1).length}`);

await writeFile(path.join(STAGING, 'strip-audit.json'), JSON.stringify({
  metadata: {
    generatedAt: new Date().toISOString(), model: MODEL,
    generator: 'scripts/facade-twin/audit-strips.ts',
    note: 'A 7B vision model judging rectified strips. A measuring instrument for the rate, '
      + 'not a source of truth per building. Strips were rendered clean, without detector boxes.',
    judged: results.length,
  },
  judgements: results,
}, null, 1));
console.log(`\n→ ${path.relative(process.cwd(), path.join(STAGING, 'strip-audit.json'))}`);
