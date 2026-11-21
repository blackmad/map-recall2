/**
 * belt-review:read-house (lane C, 2026-11-21): one vision call per house reads every description field off David's picked
 * crop, in the kit's values (src/canalRecall/beltReview/houseRead.ts), so stage 2 asks David only "does the render look
 * like the photo" (lane A) and Claude does the field reading.
 *
 *   node --import tsx scripts/belt-review/read-house.ts <faceId> [--state <dir with picks.json>] [--only <pand,...>]
 *        [--model claude-opus-5-5] [--force] [--budget <$>] [--dry]
 *
 * Inputs: <state>/picks.json (David's pick per pand: candidateId, facadeSpanPx, houses; runtime state of the review
 * server, default the serve worktree's review-data/belt-review/<faceId>), candidates.json there (imageRoot, the candidate's
 * file, pandSpanPx, ppm), face.json here. The crop is the picked image cut to facadeSpanPx (David's edges) else pandSpanPx,
 * full height, at most 1200 px on its long edge (a split pand: one crop and one read per house, keyed `<pand>#n`).
 *
 * Calls: the `ant` CLI on the active profile (no key in the repo), effort low, one image per call, as
 * scripts/design-units/roof-read.ts. Usage and $ per house are kept with the answer.
 *
 * Output: review-data/belt-review/<faceId>/photo-read.json {reads: {<house>: {answer, candidateId, spanPx, model, usage,
 * costUsd, at}}}. Merge into description.json by re-running describe.ts (it reads photo-read.json, source `photo-read`).
 * Crops are written to .cache/belt-review/read-crops/<faceId>/ (derived, swept freely).
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { costOf, crownFormProblems, crownFormPrompt, houseReadPrompt, readProblems, type HouseRead } from '../../src/canalRecall/beltReview/houseRead.ts';

const REPO = path.resolve(import.meta.dirname, '../..');
const SERVE = '/Users/blackmad/Code/map-recall2-worktrees/belt-review-serve';
export const MAX_EDGE_PX = 1200;
const argv = process.argv.slice(2);
const opt = (k: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
const faceId = argv.find((a, i) => !a.startsWith('--') && !argv[i - 1]?.startsWith('--'));

export interface Crop { house: string; pandId: string; address: string; candidateId: string; file: string; spanPx: [number, number]; ppm: number }

/** The crops of a face: per pand (per split house) the picked image and the span to cut. */
export function faceCrops(faceDir: string, stateDir: string): Crop[] {
  const json = (f: string) => JSON.parse(fs.readFileSync(f, 'utf8'));
  const face = json(path.join(faceDir, 'face.json')) as { pands: Array<{ pandId: string; address: string; order: number }> };
  const cands = json(path.join(stateDir, 'candidates.json')) as { imageRoot: string; pands: Array<{ pandId: string; candidates: Array<{ id: string; file: string; ppm?: number; width: number; pandSpanPx?: [number, number] }> }> };
  const picks = json(path.join(stateDir, 'picks.json')).picks as Record<string, { candidateId: string | null; facadeSpanPx?: [number, number]; houses?: Array<{ fromM: number; toM: number; label?: string }> }>;
  const out: Crop[] = [];
  for (const p of [...face.pands].sort((a, b) => a.order - b.order)) {
    const pk = picks[p.pandId];
    if (!pk?.candidateId) continue;
    const c = cands.pands.find(x => x.pandId === p.pandId)?.candidates.find(x => x.id === pk.candidateId);
    if (!c) continue;
    const ppm = c.ppm ?? 50, span = pk.facadeSpanPx ?? c.pandSpanPx ?? [0, c.width];
    const base = { pandId: p.pandId, candidateId: c.id, file: path.join(cands.imageRoot, c.file), ppm };
    if (pk.houses && pk.houses.length >= 2) {
      // houses are metres from the BAG span start (pandSpanPx[0]).
      const x0 = c.pandSpanPx?.[0] ?? 0;
      pk.houses.forEach((h, i) => out.push({ ...base, house: `${p.pandId}#${i + 1}`, address: h.label ? `${p.address.replace(/\s+\d.*$/, '')} ${h.label}` : `${p.address} (${i + 1}/${pk.houses!.length})`, spanPx: [Math.round(x0 + h.fromM * ppm), Math.round(x0 + h.toM * ppm)] }));
    } else out.push({ ...base, house: p.pandId, address: p.address, spanPx: [Math.round(span[0]), Math.round(span[1])] });
  }
  return out;
}

/** The crop as a JPEG buffer (cut to the span, full height, long edge <= MAX_EDGE_PX). */
export async function cropImage(c: Crop, maxEdge = MAX_EDGE_PX): Promise<{ buf: Buffer; w: number; h: number }> {
  const m = await sharp(c.file).metadata();
  const left = Math.max(0, Math.min(c.spanPx[0], (m.width ?? 1) - 1)), width = Math.max(1, Math.min(c.spanPx[1], m.width ?? 1) - left);
  const cut = await sharp(c.file).extract({ left, top: 0, width, height: m.height ?? 1 }).toBuffer();
  const s = Math.min(1, maxEdge / Math.max(width, m.height ?? 1)), w = Math.round(width * s), h = Math.round((m.height ?? 1) * s);
  return { buf: await sharp(cut).resize(w, h).jpeg({ quality: 85 }).toBuffer(), w, h };
}

/** The crop's pixels per metre as sent (the candidate's ppm, scaled with the crop). */
export const cropPpm = (c: Crop, w: number) => +(c.ppm * w / Math.max(1, c.spanPx[1] - c.spanPx[0])).toFixed(3);

export interface AntUsage { input_tokens: number; output_tokens: number; [k: string]: unknown }
/** One Messages call through the `ant` CLI: images first, then the text. Returns the text and usage. */
export function antCall(images: Buffer[], text: string, model: string, maxTokens = 4000): { text: string; usage: AntUsage; stop: string } {
  const content = [...images.map(b => ({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b.toString('base64') } })), { type: 'text', text }];
  const message = JSON.stringify({ role: 'user', content });
  const out = execFileSync('ant', ['--format', 'json', 'messages', 'create', '--model', model, '--max-tokens', String(maxTokens), '--output-config', '{"effort":"low"}', '--message', message], { encoding: 'utf8', maxBuffer: 1 << 26 });
  const res = JSON.parse(out) as { content: Array<{ type: string; text?: string }>; usage: AntUsage; stop_reason: string };
  return { text: res.content.filter(b => b.type === 'text').map(b => b.text).join(''), usage: res.usage, stop: res.stop_reason };
}
export const jsonOf = (text: string) => JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));

if (import.meta.main ?? process.argv[1]?.endsWith('read-house.ts')) {
  if (!faceId) { console.error('usage: read-house.ts <faceId> [--state <dir>] [--only <pand,...>] [--model m] [--force] [--budget $] [--dry]'); process.exit(2); }
  const faceDir = path.join(REPO, 'review-data/belt-review', faceId);
  const stateDir = path.resolve(opt('state') ?? path.join(SERVE, 'review-data/belt-review', faceId));
  const model = opt('model') ?? 'claude-opus-5-5', budget = Number(opt('budget') ?? 2.5);
  const only = new Set((opt('only') ?? '').split(',').filter(Boolean));
  const outFile = path.join(faceDir, 'photo-read.json');
  const file = fs.existsSync(outFile) ? JSON.parse(fs.readFileSync(outFile, 'utf8')) : { version: 1, faceId, about: '', reads: {} };
  file.about = 'Belt review lane C: per-house photo reads of David\'s picked crop (picks.json at read time), every description field in kit values; built by scripts/belt-review/read-house.ts, merged into description.json by describe.ts at source photo-read.';
  const cropDir = path.join(REPO, '.cache/belt-review/read-crops', faceId);
  fs.mkdirSync(cropDir, { recursive: true });
  let spent = 0, n = 0;
  // --part crown: the crown read only (houseRead.ts crownFormPrompt), merged into the house's existing answer as
  // `crownForm` (its first read, corrections and measures kept); its call is kept beside it as `crownRead`.
  if (opt('part') === 'crown') {
    for (const c of faceCrops(faceDir, stateDir)) {
      if (only.size && !only.has(c.house) && !only.has(c.pandId)) continue;
      const entry = file.reads[c.house];
      if (!entry?.answer || entry.answer.readable === false) { console.log(`${c.house}: no first read`); continue; }
      if (entry.answer.crownForm && !argv.includes('--force')) continue;
      if (spent >= budget) { console.log(`budget $${budget} reached; stopping`); break; }
      const img = await cropImage(c);
      const prompt = crownFormPrompt(c.address, img.w, img.h, entry.answer);
      let r = antCall([img.buf], prompt, model, 3000), form: any = null, problems: string[] = [];
      try { form = jsonOf(r.text); problems = crownFormProblems(form); } catch { problems = ['unparsed']; }
      const usage = { input_tokens: r.usage.input_tokens, output_tokens: r.usage.output_tokens };
      if (problems.length) {
        r = antCall([img.buf], prompt, model, 6000);
        usage.input_tokens += r.usage.input_tokens; usage.output_tokens += r.usage.output_tokens;
        try { form = jsonOf(r.text); problems = crownFormProblems(form); } catch { form = null; problems = ['unparsed']; }
      }
      const costUsd = costOf(usage);
      spent += costUsd; n++;
      if (form && !problems.length) entry.answer.crownForm = { ...form, px: { ...form.px, w: img.w, h: img.h, ppm: cropPpm(c, img.w) } };
      entry.crownRead = { model, at: new Date().toISOString(), usage, costUsd, cropPx: [img.w, img.h], ...(problems.length ? { problems, raw: r.text.slice(0, 400) } : {}) };
      fs.writeFileSync(outFile, JSON.stringify(file, null, 1) + '\n');
      console.log(`${c.house} ${c.address}: ${form?.kind} claws ${form?.claws} cap ${form?.cap} neck ${form?.neckLights} lower ${form?.lowerLights} centre ${form?.centre} $${costUsd.toFixed(4)}${problems.length ? ` problems: ${problems.join(',')}` : ''}`);
    }
    console.log(`crown read: ${n} calls, $${spent.toFixed(3)}`);
    process.exit(0);
  }
  for (const c of faceCrops(faceDir, stateDir)) {
    if (only.size && !only.has(c.house) && !only.has(c.pandId)) continue;
    const prev = file.reads[c.house];
    if (prev && !argv.includes('--force') && prev.candidateId === c.candidateId && JSON.stringify(prev.spanPx) === JSON.stringify(c.spanPx)) continue;
    const img = await cropImage(c);
    fs.writeFileSync(path.join(cropDir, `${c.house.replace('#', '_')}.jpg`), img.buf);
    if (argv.includes('--dry')) { console.log(`${c.house} ${c.address}: ${img.w}x${img.h}`); continue; }
    if (spent >= budget) { console.log(`budget $${budget} reached; stopping`); break; }
    let r = antCall([img.buf], houseReadPrompt(c.address), model);
    let answer: Partial<HouseRead> | null = null, problems: string[] = [];
    try { answer = jsonOf(r.text); problems = readProblems(answer!); } catch { problems = ['unparsed']; }
    const usage = { input_tokens: r.usage.input_tokens, output_tokens: r.usage.output_tokens };
    if (problems.includes('unparsed') || r.stop !== 'end_turn') {
      // One retry on an unparsed answer or a cut-off.
      r = antCall([img.buf], houseReadPrompt(c.address), model, 8000);
      usage.input_tokens += r.usage.input_tokens; usage.output_tokens += r.usage.output_tokens;
      try { answer = jsonOf(r.text); problems = readProblems(answer!); } catch { answer = null; problems = ['unparsed']; }
    }
    const costUsd = costOf(usage);
    spent += costUsd; n++;
    file.reads[c.house] = { address: c.address, candidateId: c.candidateId, spanPx: c.spanPx, cropPx: [img.w, img.h], model, at: new Date().toISOString(), usage, costUsd, ...(problems.length ? { problems } : {}), answer: answer ?? { readable: false, notes: r.text.slice(0, 300) } };
    fs.writeFileSync(outFile, JSON.stringify(file, null, 1) + '\n');
    console.log(`${c.house} ${c.address}: in ${usage.input_tokens} out ${usage.output_tokens} $${costUsd.toFixed(4)}${problems.length ? ` problems: ${problems.join(',')}` : ''}`);
  }
  const all = Object.values<any>(file.reads);
  const tot = all.reduce((t, r) => ({ i: t.i + r.usage.input_tokens, o: t.o + r.usage.output_tokens, c: t.c + r.costUsd }), { i: 0, o: 0, c: 0 });
  console.log(`this run: ${n} calls, $${spent.toFixed(3)}; file: ${all.length} houses, in ${tot.i} out ${tot.o}, $${tot.c.toFixed(3)} ($${(tot.c / Math.max(1, all.length)).toFixed(4)}/house)`);
}
