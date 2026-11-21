/**
 * belt-review:self-check (2026-11-21): Claude catches the obvious photo-vs-drawing misses before David sees a house. Per
 * house: render the current drawing (this checkout's renderer, in process), send Opus the picked crop, the drawing and the
 * photo read, and store the classed differences (wiring | read | kit; beltReview/selfCheck.ts) with the measured storey
 * profile and the cost.
 *
 *   node --import tsx scripts/belt-review/self-check.ts <faceId> --label pass1 [--state <dir>] [--description <file>]
 *        [--only <house,...>] [--model claude-opus-5-5] [--budget <$>] [--render-only] [--pngs <dir>]
 *   node --import tsx scripts/belt-review/self-check.ts <faceId> --score [--label <run>]   (no calls: each run's counts up
 *        to <run>, and the latest answer per house over the runs in order, against David's bar and the strict verdict)
 *
 * Renders go to .cache/belt-review/self-check/<label>/ (a fresh cache per label: the render hash names the design, not the
 * renderer code, so a renderer fix needs its own label). `--pngs` also copies each drawing (and the crop) there.
 *
 * Output: review-data/belt-review/<faceId>/self-check.json {runs: {<label>: {at, model, houses: {<house>: {address,
 * renderHash, photo, drawing, differences, usage, costUsd}}, summary}}}.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import sharp from 'sharp';
import { costOf } from '../../src/canalRecall/beltReview/houseRead.ts';
import { applyMeasures, barBlockers, fieldOf, passesBar, selfCheckProblems, selfCheckPrompt, tally, type SelfCheckAnswer, type SelfCheckDiff } from '../../src/canalRecall/beltReview/selfCheck.ts';
import { applyPixelProfile, type PixelLandmarks } from '../../src/canalRecall/beltReview/pixelProfile.ts';
import { antCall, cropImage, faceCrops, jsonOf } from './read-house.ts';

const REPO = path.resolve(import.meta.dirname, '../..');
const SERVE = '/Users/blackmad/Code/map-recall2-worktrees/belt-review-serve';
const argv = process.argv.slice(2);
const opt = (k: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
const faceId = argv.find((a, i) => !a.startsWith('--') && !argv[i - 1]?.startsWith('--'));
const label = opt('label');
if (!faceId || (!label && !argv.includes('--score') && !argv.includes('--apply-pixels'))) { console.error('usage: self-check.ts <faceId> --label <run> [--state dir] [--description file] [--only ids] [--budget $] [--render-only] [--pngs dir]'); process.exit(2); }
const faceDir = path.join(REPO, 'review-data/belt-review', faceId);
const stateDir = path.resolve(opt('state') ?? path.join(SERVE, 'review-data/belt-review', faceId));
const descFile = path.resolve(opt('description') ?? path.join(faceDir, 'description.json'));
const model = opt('model') ?? 'claude-opus-5-5', budget = Number(opt('budget') ?? 2);
const only = new Set((opt('only') ?? '').split(',').filter(Boolean));
const pngDir = opt('pngs') ? path.resolve(opt('pngs')!) : null;
const renderOnly = argv.includes('--render-only');

/** A run's counts: David's bar (no major difference in a bar field, selfCheck.ts passesBar), the judge's own bar verdict
 *  (`good` on runs from the 2026-11-21 prompt on, which carry `strictGood`), and the strict verdict (`strictGood`, or
 *  `good` on the runs before it, whose prompt asked only the strict question). */
function counts(houses: Record<string, any>) {
  const hs = Object.values<any>(houses), barRuled = hs.some(h => typeof h.strictGood === 'boolean');
  return { houses: hs.length, bar: hs.filter(h => !h.problems && passesBar(h.differences ?? [])).length,
    ...(barRuled ? { judgeBar: hs.filter(h => h.good === true).length } : {}),
    strict: hs.filter(h => (typeof h.strictGood === 'boolean' ? h.strictGood : h.good) === true).length };
}
const blockerKey = (d: SelfCheckDiff) => `${d.field}/${d.class}`;
if (argv.includes('--score')) {
  const f = JSON.parse(fs.readFileSync(path.join(faceDir, 'self-check.json'), 'utf8'));
  const latest: Record<string, any> = {};
  for (const [k, r] of Object.entries<any>(f.runs)) {
    console.log(`${k.padEnd(12)} ${JSON.stringify(counts(r.houses))} cost ${(r.summary?.costUsd ?? 0).toFixed(3)}`);
    for (const [h, v] of Object.entries<any>(r.houses)) latest[h] = { ...v, run: k };
    if (k === label) break;
  }
  console.log(`latest/house ${JSON.stringify(counts(latest))}`);
  const by: Record<string, number> = {};
  for (const v of Object.values<any>(latest)) for (const d of barBlockers<SelfCheckDiff>(v.differences ?? [])) by[blockerKey(d)] = (by[blockerKey(d)] ?? 0) + 1;
  console.log('blockers', Object.entries(by).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(', '));
  for (const v of Object.values<any>(latest)) console.log(`${String(v.address).padEnd(18)} ${v.run.padEnd(10)} ${passesBar(v.differences ?? []) ? 'PASS' : 'fail'} ${barBlockers<SelfCheckDiff>(v.differences ?? []).map(blockerKey).join(' ')}`);
  process.exit(0);
}

if (argv.includes('--apply-pixels')) {
  // --apply-pixels: the pixel-grid landmarks (pixel-measures.json, beltReview/pixelProfile.ts) written onto photo-read.json:
  // the storey shares, ground window ratio, cornice depth, and the storey / bay corrections they settle, each noted.
  const pm = JSON.parse(fs.readFileSync(path.join(faceDir, 'pixel-measures.json'), 'utf8')) as { by: string; at: string; houses: Record<string, PixelLandmarks & { address: string }> };
  const readFile = path.join(faceDir, 'photo-read.json'), rf = JSON.parse(fs.readFileSync(readFile, 'utf8'));
  let n = 0;
  for (const [house, m] of Object.entries(pm.houses)) {
    const a = rf.reads[house]?.answer;
    if (!a) { console.log(`${house}: no read`); continue; }
    const fields = applyPixelProfile(a, m);
    if (fields.length) { a.pixelMeasured = { by: pm.by, at: pm.at, fields, ...(m.note ? { note: m.note } : {}) }; n++; }
    console.log(`${m.address}: ${fields.join(', ') || 'nothing'}`);
  }
  fs.writeFileSync(readFile, JSON.stringify(rf, null, 1) + '\n');
  console.log(`applied pixel measures to ${n} reads`);
  process.exit(0);
}

if (opt('apply')) {
  // --apply <label>: the photo measures of that run written into photo-read.json (the read's storey profile, ground window
  // and door ratios, gable rise), so the render draws them; each answer notes where they came from.
  const from = opt('apply')!, src = JSON.parse(fs.readFileSync(path.join(faceDir, 'self-check.json'), 'utf8')).runs[from]?.houses ?? {};
  const readFile = path.join(faceDir, 'photo-read.json'), rf = JSON.parse(fs.readFileSync(readFile, 'utf8'));
  const desc = JSON.parse(fs.readFileSync(descFile, 'utf8')) as { pands: Array<{ pandId: string; fields: Record<string, { value: unknown }> }> };
  let n = 0;
  for (const [house, h] of Object.entries<any>(src)) {
    const a = rf.reads[house]?.answer, ph = h.photo as { fractions?: number[]; groundWindowRatio?: number | null; doorRatio?: number | null; crownRiseRatio?: number | null } | undefined;
    if (!a || !ph) continue;
    const m = applyMeasures(a, ph, Number(desc.pands.find(p => p.pandId === house.split('#')[0])?.fields.eavesM?.value));
    if (m.length) { a.measured = { by: `self-check ${from} (claude-opus-5-5, photo profile)`, fields: m }; n++; }
  }
  fs.writeFileSync(readFile, JSON.stringify(rf, null, 1) + '\n');
  console.log(`applied ${from}'s photo measures to ${n} reads`);
  process.exit(0);
}

// A private review router over a scratch copy of the state, with this checkout's description and a per-label render cache.
const { default: express } = await import('express');
const { beltReviewRouter } = await import('./server/router.ts');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'belt-selfcheck-'));
fs.mkdirSync(path.join(tmp, faceId));
for (const f of fs.readdirSync(stateDir)) if (f.endsWith('.json')) fs.copyFileSync(path.join(stateDir, f), path.join(tmp, faceId, f));
fs.copyFileSync(descFile, path.join(tmp, faceId, 'description.json'));
// The wall each photo was cut on (walls.ts): the render frames it.
if (fs.existsSync(path.join(faceDir, 'walls.json'))) fs.copyFileSync(path.join(faceDir, 'walls.json'), path.join(tmp, faceId, 'walls.json'));
for (const f of ['rounds.json', 'kit-gaps.json']) { const s = path.join(REPO, 'review-data/belt-review', f); if (fs.existsSync(s)) fs.copyFileSync(s, path.join(tmp, f)); }
const app = express();
app.use(express.json());
app.use('/api/belt-review', beltReviewRouter({ dataRoot: tmp, repoRoot: REPO, renderCacheDir: path.join(REPO, '.cache/belt-review/self-check', label) }));
const srv = app.listen(0);
await new Promise(r => srv.once('listening', r));
// The vision call blocks this process (execFileSync), so no kept-alive socket survives it: one connection per request.
const get = (u: string) => fetch(u, { headers: { connection: 'close' } });
const server = `http://localhost:${(srv.address() as AddressInfo).port}`;

const reads = JSON.parse(fs.readFileSync(path.join(faceDir, 'photo-read.json'), 'utf8')).reads as Record<string, { answer: Record<string, unknown> }>;
const outFile = path.join(faceDir, 'self-check.json');
const file = fs.existsSync(outFile) ? JSON.parse(fs.readFileSync(outFile, 'utf8')) : { version: 1, faceId, runs: {} };
file.about = 'Belt review self-check: per house, Opus compares David\'s picked crop with the current drawing and the photo read, and lists differences classed wiring (read says X, drawing lacks X) | read (read wrong) | kit (kit cannot say it), with field, expected, seen, severity; plus the measured storey profile of photo and drawing. Built by scripts/belt-review/self-check.ts.';
const run = file.runs[label] ?? (file.runs[label] = { at: '', model, houses: {} });
Object.assign(run, { at: new Date().toISOString(), model, description: path.relative(REPO, descFile) });

const jpeg = async (buf: Buffer, maxEdge = 1000) => {
  const m = await sharp(buf).metadata(), s = Math.min(1, maxEdge / Math.max(m.width ?? 1, m.height ?? 1));
  return sharp(buf).flatten({ background: '#ffffff' }).resize(Math.round((m.width ?? 1) * s), Math.round((m.height ?? 1) * s)).jpeg({ quality: 85 }).toBuffer();
};
if (pngDir) fs.mkdirSync(pngDir, { recursive: true });

let spent = 0;
for (const c of faceCrops(faceDir, stateDir)) {
  if (only.size && !only.has(c.house) && !only.has(c.pandId) && !only.has(c.address)) continue;
  const res = await get(`${server}/api/belt-review/faces/${faceId}/render/${encodeURIComponent(c.house)}.png`);
  if (!res.ok) { console.log(`${c.house}: render ${res.status} ${(await res.text()).slice(0, 300)}`); continue; }
  const hash = res.headers.get('x-render-hash');
  const png = Buffer.from(await res.arrayBuffer());
  const slug = `${c.address.replace(/[^\w]+/g, '-')}_${c.house.replace('#', '_')}`;
  if (pngDir) { fs.writeFileSync(path.join(pngDir, `${slug}.${label}.png`), png); if (!fs.existsSync(path.join(pngDir, `${slug}.photo.jpg`))) fs.writeFileSync(path.join(pngDir, `${slug}.photo.jpg`), (await cropImage(c, 1000)).buf); }
  if (pngDir) { const j = await get(`${server}/api/belt-review/faces/${faceId}/render/${encodeURIComponent(c.house)}.json`); if (j.ok) fs.writeFileSync(path.join(pngDir, `${slug}.${label}.json`), JSON.stringify({ ...(await j.json()), crop: { spanPx: c.spanPx, ppm: c.ppm, spanM: +((c.spanPx[1] - c.spanPx[0]) / c.ppm).toFixed(2) } }, null, 1)); }
  if (renderOnly) { console.log(`${c.house} ${c.address}: rendered ${hash}`); continue; }
  const prev = run.houses[c.house];
  if (prev && prev.renderHash === hash && !prev.problems && !argv.includes('--force')) continue;
  if (spent >= budget) { console.log(`budget $${budget} reached; stopping`); break; }
  const read = reads[c.house]?.answer;
  if (!read) { console.log(`${c.house}: no photo read`); continue; }
  const photo = (await cropImage(c, 1000)).buf, drawing = await jpeg(png);
  const r = antCall([photo, drawing], selfCheckPrompt(c.address, read), model, 6000);
  let a: SelfCheckAnswer | null = null, problems: string[] = [];
  try { a = jsonOf(r.text); problems = selfCheckProblems(a!); } catch { problems = ['unparsed']; }
  const usage = { input_tokens: r.usage.input_tokens, output_tokens: r.usage.output_tokens }, costUsd = costOf(usage);
  spent += costUsd;
  const diffs: SelfCheckDiff[] = a && Array.isArray(a.differences) ? a.differences.filter(d => d && typeof d === 'object').map(d => ({ ...d, field: fieldOf(d.field) })) : [];
  run.houses[c.house] = { address: c.address, candidateId: c.candidateId, renderHash: hash, ...(a ? { good: a.good, ...(typeof a.strictGood === 'boolean' ? { strictGood: a.strictGood } : {}), bar: passesBar(diffs), photo: a.photo, drawing: a.drawing } : { raw: r.text.slice(0, 400) }), differences: diffs, ...(problems.length ? { problems } : {}), usage, costUsd };
  const all = Object.values<any>(run.houses);
  run.summary = { ...counts(run.houses), good: all.filter(h => h.good === true).length, costUsd: +all.reduce((t, h) => t + h.costUsd, 0).toFixed(4), ...tally(all.flatMap(h => h.differences as SelfCheckDiff[])) };
  fs.writeFileSync(outFile, JSON.stringify(file, null, 1) + '\n');
  const t = tally(diffs);
  console.log(`${c.house} ${c.address}: bar ${passesBar(diffs) ? 'PASS' : 'fail'} judge ${a?.good ? 'GOOD' : 'bad'} strict ${a?.strictGood ? 'GOOD' : 'bad'} ${JSON.stringify(t.byClass)} ${diffs.filter(d => d.severity === 'major').map(d => `[${d.class}:${d.field}] ${d.expected} / ${d.seen}`).join(' | ')} ($${costUsd.toFixed(4)})${problems.length ? ` problems ${problems.join(',')}` : ''}`);
}
console.log(`run ${label}: $${spent.toFixed(3)} this call; ${JSON.stringify(run.summary ?? {})}`);
console.log(`run ${label} counts: ${JSON.stringify(counts(run.houses))}`);
srv.close();
process.exit(0);
