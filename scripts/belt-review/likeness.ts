/**
 * belt-review:likeness (lane C, 2026-11-21): one vision call per house compares David's picked crop with the review server's
 * render of the house's current design and returns a 0-1 likeness and the top 3 differences, each tagged roof | storeys |
 * windows | colour | ground | door | white | other (houseRead.ts LIKENESS_PROMPT). Lane A sorts stage 2 worst-first on it.
 *
 *   node --import tsx scripts/belt-review/likeness.ts <faceId> --label before [--server http://localhost:4340]
 *   node --import tsx scripts/belt-review/likeness.ts <faceId> --label after --description <description.json>
 *        [--state <dir with picks.json>] [--only <pand,...>] [--model claude-opus-5-5] [--budget <$>]
 *
 * `--server` asks a running review server (GET /api/belt-review/faces/:face/render/:pand.png; it caches by design hash).
 * `--description` instead mounts the review router in this process on a free port, over a scratch copy of the state dir
 * with that description (so a new description can be scored without touching the running server's files); the render
 * cache is this checkout's .cache/belt-review/renders.
 *
 * Output: review-data/belt-review/<faceId>/likeness.json: `runs[label]` per house {score, differences, renderHash,
 * usage, costUsd}, and `pands` = the latest run's score per house (what lane A sorts on).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import sharp from 'sharp';
import { LIKENESS_PROMPT, costOf, likenessProblems, type LikenessAnswer } from '../../src/canalRecall/beltReview/houseRead.ts';
import { antCall, cropImage, faceCrops, jsonOf } from './read-house.ts';

const REPO = path.resolve(import.meta.dirname, '../..');
const SERVE = '/Users/blackmad/Code/map-recall2-worktrees/belt-review-serve';
const argv = process.argv.slice(2);
const opt = (k: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
const faceId = argv.find((a, i) => !a.startsWith('--') && !argv[i - 1]?.startsWith('--'));
const label = opt('label');
if (!faceId || !label) { console.error('usage: likeness.ts <faceId> --label <run> [--server url | --description file] [--state dir] [--only ids] [--model m] [--budget $]'); process.exit(2); }
const faceDir = path.join(REPO, 'review-data/belt-review', faceId);
const stateDir = path.resolve(opt('state') ?? path.join(SERVE, 'review-data/belt-review', faceId));
const model = opt('model') ?? 'claude-opus-5-5', budget = Number(opt('budget') ?? 1.5);
const only = new Set((opt('only') ?? '').split(',').filter(Boolean));

let server = opt('server') ?? 'http://localhost:4340', close: (() => void) | null = null, descriptionUsed = `${server} (its description.json)`;
if (opt('description')) {
  // A private review router over a scratch copy of the state, with the given description.
  const { default: express } = await import('express');
  const { beltReviewRouter } = await import('./server/router.ts');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'belt-likeness-'));
  fs.mkdirSync(path.join(tmp, faceId));
  for (const f of fs.readdirSync(stateDir)) if (f.endsWith('.json')) fs.copyFileSync(path.join(stateDir, f), path.join(tmp, faceId, f));
  fs.copyFileSync(path.resolve(opt('description')!), path.join(tmp, faceId, 'description.json'));
  for (const f of ['rounds.json', 'kit-gaps.json']) { const s = path.join(REPO, 'review-data/belt-review', f); if (fs.existsSync(s)) fs.copyFileSync(s, path.join(tmp, f)); }
  const app = express();
  app.use(express.json());
  app.use('/api/belt-review', beltReviewRouter({ dataRoot: tmp, repoRoot: REPO }));
  const srv = app.listen(0);
  await new Promise(r => srv.once('listening', r));
  server = `http://localhost:${(srv.address() as AddressInfo).port}`;
  close = () => { srv.close(); process.exit(0); };
  descriptionUsed = path.relative(REPO, path.resolve(opt('description')!));
}

const outFile = path.join(faceDir, 'likeness.json');
const file = fs.existsSync(outFile) ? JSON.parse(fs.readFileSync(outFile, 'utf8')) : { version: 1, faceId, runs: {}, pands: {} };
file.about = 'Belt review lane C: per house, how much the current render looks like David\'s picked photo (0-1) and the top 3 differences, tagged roof|storeys|windows|colour|ground|door|white|other. `pands` is the latest run (lane A sorts stage 2 worst-first on pands[house].score); `runs` keeps each labelled run. Built by scripts/belt-review/likeness.ts.';
file.prompt = LIKENESS_PROMPT;
const run = file.runs[label] ?? (file.runs[label] = { at: '', model, server: '', description: '', pands: {} });
Object.assign(run, { at: new Date().toISOString(), model, server: opt('description') ? 'in-process review router' : server, description: descriptionUsed });

const jpeg = async (buf: Buffer, maxEdge = 1000) => {
  const m = await sharp(buf).metadata(), s = Math.min(1, maxEdge / Math.max(m.width ?? 1, m.height ?? 1));
  return sharp(buf).flatten({ background: '#ffffff' }).resize(Math.round((m.width ?? 1) * s), Math.round((m.height ?? 1) * s)).jpeg({ quality: 85 }).toBuffer();
};

let spent = 0;
for (const c of faceCrops(faceDir, stateDir)) {
  if (only.size && !only.has(c.house) && !only.has(c.pandId)) continue;
  if (spent >= budget) { console.log(`budget $${budget} reached; stopping`); break; }
  const res = await fetch(`${server}/api/belt-review/faces/${faceId}/render/${encodeURIComponent(c.house)}.png`);
  if (!res.ok) { console.log(`${c.house}: render ${res.status} ${(await res.text()).slice(0, 200)}`); continue; }
  const hash = res.headers.get('x-render-hash');
  const render = await jpeg(Buffer.from(await res.arrayBuffer()));
  const photo = (await cropImage(c, 1000)).buf;
  const prev = run.pands[c.house];
  if (prev && prev.renderHash === hash && prev.candidateId === c.candidateId && !argv.includes('--force')) continue;
  const r = antCall([photo, render], LIKENESS_PROMPT, model);
  let a: LikenessAnswer | null = null;
  try { a = jsonOf(r.text); if (likenessProblems(a!).length) a = null; } catch { a = null; }
  const usage = { input_tokens: r.usage.input_tokens, output_tokens: r.usage.output_tokens }, costUsd = costOf(usage);
  spent += costUsd;
  run.pands[c.house] = { address: c.address, candidateId: c.candidateId, renderHash: hash, ...(a ? { score: a.score, differences: a.differences.slice(0, 3) } : { problems: ['unparsed'], raw: r.text.slice(0, 300) }), usage, costUsd };
  if (a) file.pands[c.house] = { score: a.score, differences: a.differences.slice(0, 3), run: label, renderHash: hash, at: run.at };
  const scores = Object.values<any>(run.pands).map(p => p.score).filter((s): s is number => typeof s === 'number');
  run.summary = { houses: scores.length, mean: +(scores.reduce((t, s) => t + s, 0) / Math.max(1, scores.length)).toFixed(3), costUsd: +Object.values<any>(run.pands).reduce((t, p) => t + p.costUsd, 0).toFixed(4) };
  fs.writeFileSync(outFile, JSON.stringify(file, null, 1) + '\n');
  console.log(`${c.house} ${c.address}: ${a ? a.score : 'unparsed'} ${a ? a.differences.map(d => `[${d.tag}] ${d.what}`).join(' | ') : ''} ($${costUsd.toFixed(4)})`);
}
console.log(`run ${label}: $${spent.toFixed(3)} this call; ${JSON.stringify(run.summary)}`);
close?.();
