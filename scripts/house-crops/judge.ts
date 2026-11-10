/**
 * H4c: the Jev quality judge. One request per CACHED crop (no panorama is fetched), three yes/no questions; the score is
 * the probability of "full_front". Results go to scripts/house-crops/judge/<code>.json, keyed by pand id and the panorama
 * ids of the crop that was judged (a score counts only for that crop).
 *
 *   zsh -lic 'node --import tsx scripts/house-crops/judge.ts --buurt AB07 --archive <source-data> [--labelled] [--pand a,b] [--limit n] [--budget 2] [--concurrency 4]'
 *
 * The key is read ONLY from process.env.TYPESAFE_API_KEY (the Jev endpoint takes no other); it is never printed, logged or
 * written, and a 401/403 stops the run at once. Saved records hold scores and token counts, never the request headers.
 * Model jev-1.14.0 with the TypeSafe-Danger-Zone-Images header (docs/reviews/jev-facades-spike-20261110.md).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { manifestPath, type Manifest } from './manifest.ts';

export const ENDPOINT = 'https://api.typesafe.ai/v1/systemone', MODEL = 'jev-1.14.0';
/** USD per token, from the J1 spike (7,328 tokens = $0.000308); output tokens are priced the same here, which can only overstate the spend. */
export const USD_PER_TOKEN = 0.042 / 1e6;
export const judgePath = (code: string) => path.resolve('scripts/house-crops/judge', `${code}.json`);

export type JudgeRecord = { panoIds: string[]; score: number; occluded: number; closeUp: number; tokens: number; model: string; at: string };

export const QUESTIONS = {
  full_front: { type: 'noul', instructions: 'Is `facade` a full front of ONE building, seen straight on from ground to roofline, and usable as a reference photo of that building? It must show the whole front, top to bottom, with the ground floor and the top of the front both inside the image, and it must not be a close-up of a window or door, a side or alley wall, a blank wall, or a view down the street.', criteria: { true: 'The image shows the whole street front of one building, straight on, ground floor to roofline, with no large part hidden.', false: 'The image is a partial, oblique, side or blank wall view, a close-up, or a large part of the front is hidden.' } },
  occluded: { type: 'noul', instructions: 'Is a large part of the building front in `facade` hidden by a tree, branches, a van or truck, scaffolding, a tent or a crowd of people?', criteria: { true: 'Trees, branches, vehicles, scaffolding or similar hide a large part of the front.', false: 'The front is mostly unobstructed.' } },
  close_up: { type: 'noul', instructions: 'Is `facade` a close-up of only a small part of a building (one window, one door, a few bricks), or a view along the street or into an alley rather than at a building front?', criteria: { true: 'A close-up detail, a side wall, an alley or a street view.', false: 'A whole building front.' } },
} as const;

/** Jev rejects any image side under 280 px and does not resize: scale so the short side is >= 300 and the long side <= 1400; null when both cannot hold. */
export function judgeSize(w: number, h: number): { width: number; height: number } | null {
  const s = Math.max(1, 300 / Math.min(w, h)), W = Math.round(w * s), H = Math.round(h * s);
  const down = Math.min(1, 1400 / Math.max(W, H));
  const out = { width: Math.round(W * down), height: Math.round(H * down) };
  return Math.min(out.width, out.height) >= 280 ? out : null;
}

/** The picker's quality: P(full front) discounted by P(a large part is hidden). On the 150 labels this raised the AUC for good from 0.84 (full_front alone) to 0.89; close_up added nothing. */
export const quality = (r: Pick<JudgeRecord, 'score' | 'occluded'>): number => +(r.score * (1 - r.occluded)).toFixed(3);

const noul = (a: any): number => (typeof a?.noul === 'number' ? a.noul : NaN);
/** score fields from a Jev response; throws on a malformed one so a bad response is never stored as a score. */
export function parseAnswers(res: any): { score: number; occluded: number; closeUp: number; tokens: number } {
  const a = res?.answers, score = noul(a?.full_front), occluded = noul(a?.occluded), closeUp = noul(a?.close_up);
  if (![score, occluded, closeUp].every(Number.isFinite)) throw new Error('malformed Jev response');
  return { score, occluded, closeUp, tokens: (res.usage?.input_tokens ?? 0) + (res.usage?.output_tokens ?? 0) };
}

const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };

export async function ask(key: string, file: string): Promise<{ status: number; body: any }> {
  const meta = await sharp(file).metadata(), size = judgeSize(meta.width!, meta.height!);
  if (!size) return { status: 0, body: { error: 'crop proportions cannot satisfy the 280 px side rule' } };
  const jpg = await sharp(file).resize(size.width, size.height).jpeg({ quality: 88 }).toBuffer();
  const id = `${randomUUID()}-facade`;
  const body = { model: MODEL, state: { facade: id, note: 'A rectified street-panorama crop of one Amsterdam building front.' }, assets: { [id]: { type: 'image', part: 'facade' } }, questions: QUESTIONS };
  const form = new FormData();
  form.append('request', new Blob([JSON.stringify(body)], { type: 'application/json' }));
  form.append('facade', new Blob([jpg], { type: 'image/jpeg' }), 'facade.jpg');
  try {
    const res = await fetch(ENDPOINT, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'TypeSafe-Danger-Zone-Images': 'true' }, body: form });
    const text = await res.text(); let parsed: any = null; try { parsed = JSON.parse(text); } catch { /* keep raw */ }
    return { status: res.status, body: parsed ?? { raw: text.slice(0, 300) } };
  } catch (e: any) { return { status: 0, body: { error: `network: ${e.message}` } }; }
}

if (process.argv[1]?.endsWith('house-crops/judge.ts')) {
  const code = arg('buurt'), root = arg('archive') ?? process.env.HOUSE_CROPS_ARCHIVE;
  const budget = Number(arg('budget') ?? 2), conc = Number(arg('concurrency') ?? 4), limit = Number(arg('limit') ?? Infinity);
  if (!code || !root) { console.error('usage: judge.ts --buurt <code> --archive <dir> [--labelled] [--pand a,b] [--limit n] [--budget usd] [--concurrency n]'); process.exit(2); }
  const key = process.env.TYPESAFE_API_KEY;
  if (!key) { console.error('TYPESAFE_API_KEY is not set in this process (run through zsh -lic); stopping.'); process.exit(2); }
  const m: Manifest = JSON.parse(await fs.readFile(manifestPath(code), 'utf8'));
  const store: Record<string, JudgeRecord> = await fs.readFile(judgePath(code), 'utf8').then(JSON.parse).catch(() => ({}));
  const only = arg('pand') ? new Set(arg('pand')!.split(',')) : process.argv.includes('--labelled') ? new Set(Object.keys(JSON.parse(await fs.readFile(path.resolve('scripts/house-crops/labels', `${code}.json`), 'utf8')))) : null;
  const todo = Object.entries(m.pands).filter(([id, e]) => e.status === 'ok' && (!only || only.has(id)) && JSON.stringify(store[id]?.panoIds) !== JSON.stringify(e.panoIds)).slice(0, limit);
  let spent = 0, done = 0, stop = false, failed = 0;
  console.log(`${todo.length} crops to judge (${Object.keys(store).length} already stored), budget $${budget}`);
  const save = () => fs.mkdir(path.dirname(judgePath(code)), { recursive: true }).then(() => fs.writeFile(judgePath(code), JSON.stringify(store, null, 1) + '\n'));
  const queue = [...todo];
  await Promise.all(Array.from({ length: conc }, async () => {
    while (queue.length && !stop) {
      if (spent >= budget) { stop = true; console.error('budget reached; stopping'); break; }
      const [id, e] = queue.shift()!;
      const r = await ask(key, path.join(root, 'pand-crops', id, 'front.jpg'));
      if (r.status === 401 || r.status === 403) { stop = true; console.error(`auth error ${r.status}; stopping (fail closed)`); break; }
      try {
        if (r.status !== 200) throw new Error(`HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 120)}`);
        const p = parseAnswers(r.body); spent += p.tokens * USD_PER_TOKEN; done++;
        store[id] = { panoIds: e.panoIds!, score: +p.score.toFixed(3), occluded: +p.occluded.toFixed(3), closeUp: +p.closeUp.toFixed(3), tokens: p.tokens, model: MODEL, at: new Date().toISOString() };
      } catch (err: any) { failed++; console.error(`${id}: ${err.message}`); }
      if ((done + failed) % 25 === 0) { await save(); console.log(`${done} judged, ${failed} failed, spend so far $${spent.toFixed(4)}`); }
    }
  }));
  await save();
  console.log(`judged ${done}, failed ${failed}; Jev spend this run $${spent.toFixed(4)} (budget $${budget})`);
  if (stop) process.exit(3);
}
