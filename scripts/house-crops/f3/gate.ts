/**
 * F3 (#381): the crop gate. Neither model's answer counts on a crop the gate has not passed, so the gate comes first and is cheap:
 *   1. the hard flags (geometry and content facts: void, oblique, distance, blocked, narrow, short, blank), already in front.json;
 *   2. Jev (judge.ts v2 prompt): full_front x (1 - occluded) >= JUDGE_GOOD;
 *   3. Gemini Decision 1, occlusion only (J3: better than Jev on trunk and branches, a tie on vans): trunk, branches and van must all be "no".
 * No backend gets the address. Keys come from the login env only (TYPESAFE_API_KEY, GEMINI_API_KEY): never printed, logged or stored; a
 * 401/403 stops the run. Results are cached next to the crop (<crop>.gate.json) and keyed by the crop's sha256, so a re-run repeats no call.
 *
 *   zsh -lic 'node --import tsx scripts/house-crops/f3/gate.ts --archive <dir> --ids a,b | --ids-file f.json [--files rel,rel] [--top 3] [--concurrency 4] [--no-gemini] [--budget 2]'
 *
 * Per pand it ranks the hard-passing candidates (rank.ts), asks Jev on the top `--top`, and asks Gemini on the best by Jev quality (then the
 * next one if that fails), so Gemini sees one or two crops per pand (free tier: about 40 calls a minute).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { ask, parseAnswers, quality, USD_PER_TOKEN } from '../judge.ts';
import { JUDGE_GOOD } from '../flags.ts';
import { rankedCandidates, type Tried } from './rank.ts';

export const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/decisions', GEMINI_MODEL = 'gemini-decision-1', GEMINI_USD_PER_TOKEN = 0.10 / 1e6;
export const OCCLUSION_QUESTIONS = {
  van: { type: 'noul', instructions: 'Does a van, truck or large vehicle stand in front of the house front in `facade` and hide part of it (not a small car at the kerb)? Yes means: A van or truck hides part of the front. No means: No van or truck in front of the front.' },
  trunk: { type: 'noul', instructions: 'Does a tree trunk or a lamp post stand in front of the house front in `facade` and hide a vertical strip of it? Yes means: A tree trunk or post blocks part of the front. No means: No trunk or post in front of the front.' },
  branches: { type: 'noul', instructions: 'Do bare tree branches or twigs cross in front of the house front in `facade`? Yes means: Branches cross the front. No means: No branches cross the front.' },
} as const;
export type GateRecord = { sha: string; jev?: { score: number; occluded: number; closeUp: number; quality: number; tokens: number }; gemini?: { van: number; trunk: number; branches: number; tokens: number }; };
export const GEMINI_NO = 0.5;
/** Pure: the verdict of a record. Gemini absent = not asked (not a failure); Jev absent = not asked (the crop is not gated). */
export function gateVerdict(r: GateRecord): { pass: boolean | null; reasons: string[] } {
  const reasons: string[] = [];
  if (r.jev && r.jev.quality < JUDGE_GOOD) reasons.push(`jev ${r.jev.quality}`);
  if (r.gemini) for (const k of ['van', 'trunk', 'branches'] as const) if (r.gemini[k] >= GEMINI_NO) reasons.push(`gemini ${k} ${r.gemini[k].toFixed(2)}`);
  return { pass: r.jev ? reasons.length === 0 : null, reasons };
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const win: { t: number; tokens: number }[] = []; let avgTok = 1100, gate = Promise.resolve();
const TPM = 40000, RPM = 150;
async function throttle() { const mine = gate.then(async () => { for (;;) { const now = Date.now(); while (win.length && now - win[0].t > 60000) win.shift(); if (win.reduce((a, x) => a + x.tokens, 0) + avgTok <= TPM && win.length < RPM) { win.push({ t: now, tokens: avgTok }); return win[win.length - 1]; } await sleep(Math.max(250, 60000 - (now - win[0].t) + 50)); } }); gate = mine.catch(() => {}); return mine; }

export async function askGemini(key: string, jpg: Buffer): Promise<{ status: number; body: any }> {
  const body = { model: GEMINI_MODEL, input: [{ type: 'text', text: 'A rectified street-panorama crop of one Amsterdam house front; the house in question fills the image.' }, { type: 'text', text: 'Image `facade`:' }, { type: 'image', data: jpg.toString('base64'), mime_type: 'image/jpeg', resolution: 'medium' }], questions: OCCLUSION_QUESTIONS };
  for (let retries = 0; ; retries++) {
    const slot = await throttle(); let status = 0, text = '';
    try { const res = await fetch(GEMINI_ENDPOINT, { method: 'POST', headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); status = res.status; text = await res.text(); } catch (e: any) { text = `network: ${e.message}`; }
    if (status === 429 && retries < 8) { slot.tokens = TPM; await sleep(20000 * (retries + 1)); continue; }
    if (status === 0 && retries < 3) { await sleep(3000); continue; }
    let parsed: any = null; try { parsed = JSON.parse(text); } catch { /* raw */ }
    const tokens = parsed?.usage?.total_tokens ?? 0; if (status === 200 && tokens) avgTok = Math.round((avgTok * 9 + tokens) / 10);
    return { status, body: parsed ?? { raw: text.slice(0, 200) } };
  }
}
const noul = (a: any): number => (typeof a?.noul === 'number' ? a.noul : NaN);

const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };
async function prepared(file: string): Promise<{ jpg: Buffer; sha: string }> {
  const raw = await fs.readFile(file), sha = crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16);
  return { jpg: await sharp(raw).jpeg({ quality: 88 }).toBuffer(), sha };
}
export async function gateOne(file: string, o: { jevKey?: string; geminiKey?: string; wantJev: boolean; wantGemini: boolean }, spend: { jev: number; gemini: number }, stop: { v: boolean }): Promise<GateRecord> {
  const cacheFile = file.replace(/\.jpg$/, '.gate.json'), { jpg, sha } = await prepared(file);
  const prior: GateRecord | null = await fs.readFile(cacheFile, 'utf8').then(JSON.parse).catch(() => null);
  const rec: GateRecord = prior?.sha === sha ? prior : { sha };
  if (o.wantJev && !rec.jev && o.jevKey && !stop.v) {
    const r = await ask(o.jevKey, file, 'v2');
    if (r.status === 401 || r.status === 403) { stop.v = true; console.error(`jev auth error ${r.status}; stopping (fail closed)`); }
    else if (r.status === 200) { const p = parseAnswers(r.body); spend.jev += p.tokens * USD_PER_TOKEN; rec.jev = { score: +p.score.toFixed(3), occluded: +p.occluded.toFixed(3), closeUp: +p.closeUp.toFixed(3), quality: quality(p), tokens: p.tokens }; }
  }
  if (o.wantGemini && !rec.gemini && o.geminiKey && !stop.v) {
    const r = await askGemini(o.geminiKey, jpg);
    if (r.status === 401 || r.status === 403) { stop.v = true; console.error(`gemini auth error ${r.status}; stopping (fail closed)`); }
    else if (r.status === 200) { const a = r.body?.answers, g = { van: noul(a?.van), trunk: noul(a?.trunk), branches: noul(a?.branches) }; if (Object.values(g).every(Number.isFinite)) { const tokens = r.body?.usage?.total_tokens ?? 0; spend.gemini += tokens * GEMINI_USD_PER_TOKEN; rec.gemini = { ...g, tokens }; } }
  }
  await fs.writeFile(cacheFile, JSON.stringify(rec) + '\n');
  return rec;
}

/** Per pand: Jev on the top `top` ranked candidates, Gemini on the best by Jev quality, then on the next while the one asked fails. Returns the chosen candidate (the first that passes, else the best by Jev quality) and every record. */
export async function gatePand(dir: string, tried: Tried[], top: number, o: Parameters<typeof gateOne>[1], spend: { jev: number; gemini: number }, stop: { v: boolean }) {
  const cands = rankedCandidates(tried).filter(t => t.file).slice(0, top), recs: { t: Tried; rec: GateRecord }[] = [];
  for (const t of cands) recs.push({ t, rec: await gateOne(path.join(dir, t.file!), { ...o, wantGemini: false }, spend, stop) });
  recs.sort((a, b) => (b.rec.jev?.quality ?? -1) - (a.rec.jev?.quality ?? -1));
  let chosen: { t: Tried; rec: GateRecord } | undefined;
  for (const r of recs) {
    if (o.wantGemini) r.rec = await gateOne(path.join(dir, r.t.file!), { ...o, wantJev: false }, spend, stop);
    if (gateVerdict(r.rec).pass) { chosen = r; break; }
  }
  return { chosen: chosen ?? undefined, best: recs[0], recs };
}

async function main() {
  const archive = arg('archive'); if (!archive) { console.error('usage: gate.ts --archive <dir> [--ids a,b] [--top 3] [--no-gemini] [--budget usd]'); process.exit(2); }
  const jevKey = process.env.TYPESAFE_API_KEY, geminiKey = process.argv.includes('--no-gemini') ? undefined : process.env.GEMINI_API_KEY;
  if (!jevKey) { console.error('TYPESAFE_API_KEY is not set in this process (run through zsh -lic); stopping.'); process.exit(2); }
  if (!process.argv.includes('--no-gemini') && !geminiKey) { console.error('GEMINI_API_KEY is not set in this process (run through zsh -lic); stopping.'); process.exit(2); }
  const ids = arg('ids') ? arg('ids')!.split(',') : (await fs.readdir(path.join(archive, 'pand-crops'))).sort(), top = Number(arg('top') ?? 3), conc = Number(arg('concurrency') ?? 4), budget = Number(arg('budget') ?? 2);
  const spend = { jev: 0, gemini: 0 }, stop = { v: false }, out: Record<string, unknown> = {}, queue = [...ids]; let done = 0;
  await Promise.all(Array.from({ length: conc }, async () => { while (queue.length && !stop.v) {
    if (spend.jev > budget) { stop.v = true; console.error('jev budget reached; stopping'); break; }
    const id = queue.shift()!, dir = path.join(archive, 'pand-crops', id), fj = await fs.readFile(path.join(dir, 'front.json'), 'utf8').then(JSON.parse).catch(() => null); if (!fj) continue;
    const tried: Tried[] = (fj.candidates as Tried[]).filter(t => t.file);
    const r = await gatePand(dir, tried, top, { jevKey, geminiKey, wantJev: true, wantGemini: !!geminiKey }, spend, stop);
    out[id] = { chosen: r.chosen?.t.file ?? null, best: r.best?.t.file ?? null, recs: r.recs.map(x => ({ file: x.t.file, ...x.rec, verdict: gateVerdict(x.rec) })) };
    if (++done % 20 === 0) console.log(`${done}/${ids.length} pands, jev $${spend.jev.toFixed(4)}, gemini list $${spend.gemini.toFixed(4)}`);
  } }));
  await fs.writeFile(path.join(archive, `gate-${path.basename(arg('tag') ?? 'run')}.json`), JSON.stringify(out, null, 1));
  console.log(`gated ${done} pands; Jev spend $${spend.jev.toFixed(4)}; Gemini list-price $${spend.gemini.toFixed(4)} (free tier: $0 actual)`);
  if (stop.v) process.exit(3);
}
if (process.argv[1]?.endsWith('f3/gate.ts')) await main();
