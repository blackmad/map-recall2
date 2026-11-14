/**
 * Re-read queue (lane D, 2026-11-14): a D1 read held for scaffold or netting is not only held, it queues a re-read from
 * another capture year. For each pand of the given block faces whose read is held (row/solve.ts heldReason), this finds the
 * capture the first read saw (the D1 cuts.json) and, with --pick, the best capture of ANOTHER year by the D1 cut rule
 * (house:frames F4: winter first, unclipped, squarest; frames.ts rankCandidates, panorama lists from the shared cache).
 * Pands already re-read (rereads.json) are listed as done.
 *
 *   node --import tsx scripts/house-specs/rows/reread-queue.ts --faces kinker- [--pick] [--out artifacts/house-rows/reread]
 *
 * Writes <out>/queue.json (one entry per held front) and, with --pick, <out>/queue-pins.json + queue-ids.txt for
 *   describe-cut.ts cut --ids <out>/queue-ids.txt --pins <out>/queue-pins.json --out <out>/cuts
 * then one opus read per cut with the D1 prompt (write-answer.ts --out <out>/answers), then an entry in rereads.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import { heldReason } from '../../../src/canalRecall/houseSpec/row/solve.ts';
import type { DescriberAnswer } from '../../../src/canalRecall/houseSpec/describer.ts';
import { loadRereads, REPO } from './rowDefs.ts';

export interface QueueEntry {
  face: string; pandId: string; held: string;
  firstRead: { ref: string | null; panoId: string | null; captured: string | null };
  status: 'done' | 'queued' | 'no-other-year';
  pick?: { panoId: string; captured: string; obliquityDeg: number; distM: number; candidatesOtherYear: number };
}

const argv = process.argv.slice(2);
const opt = (k: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };

/** The held pands of a set of faces (no network). */
export function heldPands(prefix: string, answersDirs: string[], cutsFiles: string[]): QueueEntry[] {
  const facesDir = path.join(REPO, 'scripts/block-face/faces');
  const cuts = new Map<string, { panoId: string; captured: string; file?: string }>();
  for (const f of cutsFiles) if (fs.existsSync(f)) for (const r of JSON.parse(fs.readFileSync(f, 'utf8')).rows) if (!cuts.has(r.pandId)) cuts.set(r.pandId, r);
  const done = loadRereads(), out: QueueEntry[] = [];
  for (const face of fs.readdirSync(facesDir).filter(d => d.startsWith(prefix)).sort()) {
    const intent = path.join(facesDir, face, 'intent.json');
    if (!fs.existsSync(intent)) continue;
    for (const h of JSON.parse(fs.readFileSync(intent, 'utf8')).houses as Array<{ pandId: string }>) {
      const pid = h.pandId.replace(/^NL\.IMBAG\.Pand\./, '');
      const file = answersDirs.map(d => path.join(d, `${pid}.json`)).find(f => fs.existsSync(f));
      if (!file) continue;
      const held = heldReason(JSON.parse(fs.readFileSync(file, 'utf8')) as DescriberAnswer);
      if (!held) continue;
      const c = cuts.get(pid);
      out.push({ face, pandId: pid, held, firstRead: { ref: JSON.parse(fs.readFileSync(file, 'utf8')).image?.ref ?? null, panoId: c?.panoId ?? null, captured: c?.captured?.slice(0, 10) ?? null }, status: done[pid] ? 'done' : 'queued' });
    }
  }
  return out;
}

async function main() {
  const prefix = opt('faces') ?? 'kinker-';
  const raw = JSON.parse(fs.readFileSync(path.join(REPO, 'scripts/house-specs/rows/rows.json'), 'utf8'));
  const root = process.env.ROW_D1_ROOT ?? raw.d1Root;
  const answersDirs = (opt('answers') ?? `${root}/ring-20261114/answers,${root}/answers-v43-crop`).split(',');
  const cutsFiles = (opt('cuts') ?? `${root}/ring-20261114/cuts/cuts.json,${root}/cuts/cuts.json`).split(',');
  const out = path.resolve(opt('out') ?? path.join(REPO, 'artifacts/house-rows/reread'));
  const q = heldPands(prefix, answersDirs, cutsFiles);
  if (argv.includes('--pick')) {
    const { findPands, loadRoads, normId } = await import('../../pand-reference/core.ts');
    const { rankCandidates } = await import('../../house-frames/frames.ts');
    const { F4_ARGS } = await import('../describer-d1/describe-cut.ts');
    await loadRoads();
    const todo = q.filter(e => e.status === 'queued');
    const fps = await findPands(todo.map(e => e.pandId));
    for (const e of todo) {
      const c = await rankCandidates({ id: e.pandId }, fps.get(normId(e.pandId)), F4_ARGS);
      if ('skip' in c) { e.status = 'no-other-year'; continue; }
      const year = e.firstRead.captured?.slice(0, 4);
      const other = c.order.filter(o => String(o.c.timestamp).slice(0, 4) !== year);
      const best = other[0]?.c;
      if (!best) { e.status = 'no-other-year'; continue; }
      e.pick = { panoId: best.panoId, captured: String(best.timestamp).slice(0, 10), obliquityDeg: +best.obliquityDeg.toFixed(1), distM: +best.distM.toFixed(1), candidatesOtherYear: other.length };
    }
    fs.mkdirSync(out, { recursive: true });
    const picked = q.filter(e => e.pick);
    fs.writeFileSync(path.join(out, 'queue-pins.json'), JSON.stringify({ pands: Object.fromEntries(picked.map(e => [e.pandId, { pano: e.pick!.panoId }])) }, null, 1) + '\n');
    fs.writeFileSync(path.join(out, 'queue-ids.txt'), picked.map(e => e.pandId).join('\n') + '\n');
  }
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'queue.json'), JSON.stringify({ faces: prefix, at: new Date().toISOString().slice(0, 10), entries: q }, null, 1) + '\n');
  for (const e of q) console.log(`${e.face}\t${e.pandId}\t${e.status}\tfirst ${e.firstRead.captured ?? '?'}${e.pick ? `\t-> ${e.pick.captured} ${e.pick.panoId} obl ${e.pick.obliquityDeg}` : ''}\t${e.held.slice(0, 90)}`);
  console.log(`${q.length} held reads on ${prefix}* faces; ${q.filter(e => e.status === 'done').length} re-read, ${q.filter(e => e.status === 'queued').length} queued`);
}
if (process.argv[1] && path.resolve(process.argv[1]).endsWith(path.join('rows', 'reread-queue.ts'))) main();
