/**
 * Preview of a drafted type: the draft placed on a contiguous run of its own family pands (inline type, never installed),
 * compiled to a chunk, and rendered orthographically under the photo strip at the strip's scale.
 *
 *   node --import tsx scripts/block-face/draft-preview.ts --draft=scripts/block-face/drafts/<district>/<id>.json \
 *        --out=docs/reports/type-draft-20261110 [--runs=2] [--root=<worktree>]
 *
 * Per source face of the draft (richest first) the longest run of consecutive family pands (street order, >= 3) becomes a
 * preview face `scripts/block-face/faces/_draft-<id>-<k>` (untracked; `_` faces are ignored by the buurt survey) with
 * staging/block-face/_draft-<id>-<k>/{strip.jpg,chunk.glb}; writes <out>/<id>-<k>.png (photo over render) and returns.
 * Houses are the plain type: no per-pand palette, crown, door or shop (the sheet shows what the family numbers draw).
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {renderModels, closeRenderer} from '../building-recipes/render.ts';
import {writeRunFace, runIntent} from './auto-place.ts';
import {compileFace} from './compile.ts';
import {FACES, STAGING} from './intake.ts';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const readJson = (f: string) => JSON.parse(fs.readFileSync(f, 'utf8'));

const draftFile = arg('draft'), outDir = arg('out') ?? 'docs/reports/type-draft-20261110', nRuns = +(arg('runs') ?? 2);
if (!draftFile) throw Error('Use --draft=<drafted type json>');
const draft = readJson(draftFile), id: string = draft.id;
const root = arg('root') ? path.resolve(arg('root')!) : process.cwd();
const pandsOf = (face: string) => new Set<string>(draft.draft.pands.filter((p: string) => readJson(path.join(root, FACES, face, 'discovery.json')).members.includes(p)));

const faces = Object.entries<number>(draft.draft.faces).sort((a, b) => b[1] - a[1]).map(f => f[0]);
fs.mkdirSync(outDir, {recursive: true});
let k = 0;
for (const face of faces) {
  if (k >= nRuns) break;
  const dir = path.join(root, FACES, face), discovery = readJson(path.join(dir, 'discovery.json')), fam = pandsOf(face);
  // longest run of consecutive family members
  let best: string[] = [], cur: string[] = [];
  for (const m of discovery.members as string[]) { if (fam.has(m)) { cur.push(m); if (cur.length > best.length) best = [...cur]; } else cur = []; }
  if (best.length < 3) { console.log(`${face}: longest family run ${best.length} < 3, skipped`); continue; }
  k++;
  const runId = `_draft-${id}-${k}`.slice(0, 60), strip = readJson(path.join(dir, 'strip.json')), uses = readJson(path.join(dir, 'uses.json'));
  // the parent's strip image sits in the root worktree's staging; the run crop is written to this checkout's staging
  if (root !== process.cwd()) { fs.mkdirSync(path.join(STAGING, face), {recursive: true}); fs.copyFileSync(path.join(root, STAGING, face, 'strip.jpg'), path.join(STAGING, face, 'strip.jpg')); }
  await writeRunFace(face, runId, best, strip, uses, discovery);
  const type = {...draft}; delete (type as any).draft; delete (type as any).district;
  const stripDate = strip.date ?? '2025-01-01';
  const run = best.map(pandId => ({pandId, typeId: id, score: 1, notes: [], house: {pandId, slug: `${runId}-${pandId.slice(-6)}`.slice(0, 60), address: uses.pands.find((p: any) => p.pandId === pandId)?.addresses?.[0] ?? `pand ${pandId.slice(-6)}`,
    type: {type: id}, groundFloor: {use: 'residential', photoDate: stripDate, bag: ['woonfunctie'], agreement: 'bag-only', note: 'draft preview: the plain type ground'},
    rhythm: {citation: `draft-preview of ${id}`}}}));
  const intent = runIntent({id: runId, street: strip.street ?? uses.street, stripDate, stripImage: path.join(STAGING, runId, 'strip.jpg'), types: [id], run: run as any, note: `draft preview of ${id} (never installed)`});
  (intent as any).types = [type];
  fs.writeFileSync(path.join(FACES, runId, 'intent.json'), JSON.stringify(intent, null, 1) + '\n');
  const {report} = await compileFace(runId);
  const rs = readJson(path.join(FACES, runId, 'strip.json')), W = rs.width, H = rs.height, x0 = rs.x0M, x1 = rs.x1M, top = rs.heightM;
  const [png] = await renderModels([{file: path.join(STAGING, runId, 'chunk.glb')}], [{eye: [(x0 + x1) / 2, top / 2, 200], target: [(x0 + x1) / 2, top / 2, 0], fov: 30, width: W, height: H, ortho: [-(x1 - x0) / 2, (x1 - x0) / 2, top / 2, -top / 2], background: '#9fb8cf', noGround: true}]);
  const model = await sharp(png).resize(W, H, {fit: 'fill'}).png().toBuffer(), photo = await sharp(rs.image).resize(W, H, {fit: 'fill'}).png().toBuffer();
  const label = Buffer.from(`<svg width="${W}" height="34" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#222"/><text x="8" y="23" font-family="sans-serif" font-size="20" fill="#fff">${id} DRAFT on ${runId.replace('_draft-', '')} (${best.length} pands of ${face}, strip ${stripDate}) | top: photo, bottom: render | gates ${report.passed ? 'pass' : 'FAIL'}</text></svg>`);
  const sheet = await sharp({create: {width: W, height: H * 2 + 34, channels: 3, background: '#fff'}}).composite([{input: label, top: 0, left: 0}, {input: photo, top: 34, left: 0}, {input: model, top: 34 + H, left: 0}]).png().toBuffer();
  const out = path.join(outDir, `${id}-${k}.png`);
  await sharp(sheet).resize({width: Math.min(W, 2400)}).png().toFile(out);
  console.log(`${out}  (${best.length} pands, gates ${report.passed ? 'pass' : 'FAIL'})`);
}
await closeRenderer();
