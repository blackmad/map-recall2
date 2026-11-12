/**
 * J3 (#377) Gemini Decision 1 backend with the same interface as askJev in lib.mjs: askGemini({images, questions, note, family, context, resolution, variant}).
 * Plain fetch against POST /v1beta/decisions. Key only from process.env.GEMINI_API_KEY (login env); never printed, logged or written.
 * Throttled to the free-tier limits (50k tokens/min, 200 req/min; we hold to 40k and 150). 429s are counted in <cache>/gemini-429.json, waited out and retried.
 * Answers come back in the same shape Jev's do ({type, noul|choice, probabilities, confidence}) so score.mjs works unchanged.
 * Cache: <cache>/gcache/<sha256(image bytes + questions + context + resolution)>.json; list-price spend (USD_PER_TOKEN) in <cache>/gemini-ledger.json even on the free tier.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {CACHE} from './lib.mjs';

export const G_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/decisions', G_MODEL = 'gemini-decision-1', G_USD_PER_TOKEN = 0.10 / 1e6;
export const G_HARD_CAP_USD = 4.5;
const TPM = 40000, RPM = 150;
const win = []; // {t, tokens}
let avgTok = 1500, nTok = 0, stopped = false, paidSpend = 0;
const sleep = ms => new Promise(r => setTimeout(r, ms));
let gate = Promise.resolve();
async function throttle() { // serialise the admission check so concurrent workers share the window
  const mine = gate.then(async () => {
    for (;;) {
      const now = Date.now(); while (win.length && now - win[0].t > 60000) win.shift();
      const tok = win.reduce((a, x) => a + x.tokens, 0);
      if (tok + avgTok <= TPM && win.length < RPM) { win.push({t: now, tokens: avgTok}); return win[win.length - 1]; }
      await sleep(Math.max(250, 60000 - (now - win[0].t) + 50));
    }
  });
  gate = mine.catch(() => {}); return mine;
}
const f429 = () => path.join(CACHE, 'gemini-429.json');
let lock = Promise.resolve();
const bump = (file, fn, init) => (lock = lock.then(async () => {
  let j; try { j = JSON.parse(await fs.readFile(file, 'utf8')); } catch { j = init; }
  fn(j); await fs.mkdir(CACHE, {recursive: true}); await fs.writeFile(file, JSON.stringify(j, null, 1));
}));
export const readGLedger = async () => { try { return JSON.parse(await fs.readFile(path.join(CACHE, 'gemini-ledger.json'), 'utf8')); } catch { return {families: {}, total: 0}; } };

function convert(questions, ids) {
  const out = {};
  for (const [k, q] of Object.entries(questions)) {
    if (q.type === 'box') continue; // no Gemini equivalent
    const o = {type: q.type, instructions: q.instructions};
    if (q.criteria) {
      if (q.type === 'noul') o.instructions = `${q.instructions} Yes means: ${q.criteria.true} No means: ${q.criteria.false}`; // noul takes no criteria field (400 otherwise)
      else o.criteria = Object.fromEntries(Object.entries(q.criteria).map(([c, v]) => [c, typeof v === 'string' ? v : `${v.description}${v.example ? ` (reference image \`${v.example.replace(/^\$/, '')}\`)` : ''}`]));
    }
    out[k] = o;
  }
  return out;
}

export async function askGemini({images, questions, note, family, context, resolution = 'medium', variant = 'img'}) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) { console.error('GEMINI_API_KEY is not set in this shell; stopping.'); process.exit(2); }
  if (stopped) return {status: -1, body: {error: 'stopped'}};
  const gq = convert(questions);
  const input = [{type: 'text', text: [note, context].filter(Boolean).join('\n')}];
  const hash = createHash('sha256');
  for (const [p, f] of Object.entries(images)) {
    const buf = await fs.readFile(f); hash.update(buf);
    input.push({type: 'text', text: `Image \`${p}\`:`}, {type: 'image', data: buf.toString('base64'), mime_type: 'image/jpeg', resolution});
  }
  hash.update(JSON.stringify(gq)).update(input.map(b => b.type === 'text' ? b.text : '').join('|')).update(resolution).update(variant);
  const ck = path.join(CACHE, 'gcache', `${hash.digest('hex')}.json`);
  try { const c = JSON.parse(await fs.readFile(ck, 'utf8')); return {...c, cached: true}; } catch { /* miss */ }
  const L = await readGLedger();
  if (L.total >= G_HARD_CAP_USD) { console.error(`gemini list-price spend ${L.total} at the cap; stopping`); stopped = true; return {status: -1, body: {error: 'cap'}}; }
  const body = {model: G_MODEL, input, questions: gq};
  let status = 0, text = '', t0 = 0, retries = 0;
  for (;;) {
    const slot = await throttle();
    t0 = performance.now();
    try {
      const res = await fetch(G_ENDPOINT, {method: 'POST', headers: {'x-goog-api-key': key, 'Content-Type': 'application/json'}, body: JSON.stringify(body)});
      status = res.status; text = await res.text();
    } catch (e) { status = 0; text = `network: ${e.message}`; }
    if (status === 429 && retries < 8) {
      retries++; await bump(f429(), j => { j.count++; j.byFamily[family] = (j.byFamily[family] ?? 0) + 1; j.last = new Date().toISOString(); }, {count: 0, byFamily: {}});
      slot.tokens = TPM; await sleep(20000 * retries); continue; // charge the window so peers back off too
    }
    if (status === 0 && retries < 3) { retries++; await sleep(3000); continue; }
    break;
  }
  const latencyMs = Math.round(performance.now() - t0);
  if (status === 401 || status === 403) { stopped = true; console.error(`auth error ${status}; stopping (fail closed)`); }
  let response = null; try { response = JSON.parse(text); } catch { /* raw */ }
  const tokens = response?.usage?.total_tokens ?? 0;
  if (status === 200) { avgTok = Math.round((avgTok * nTok + tokens) / (nTok + 1)); nTok++; for (const w of win) if (w.tokens === TPM) w.tokens = tokens; }
  if (family && tokens) await bump(path.join(CACHE, 'gemini-ledger.json'), l => {
    const f = (l.families[`${family}/${variant}/${resolution}`] ??= {tokens: 0, calls: 0, usd: 0}); f.tokens += tokens; f.calls++; f.usd = +(f.tokens * G_USD_PER_TOKEN).toFixed(6);
    l.total = +Object.values(l.families).reduce((a, x) => a + x.usd, 0).toFixed(6);
  }, {families: {}, total: 0});
  const r = {status, latencyMs, retries, body: response ?? {raw: text.slice(0, 500)}, tokens, request: {model: G_MODEL, variant, resolution, context, questions: Object.keys(gq), images: Object.fromEntries(Object.entries(images).map(([p, f]) => [p, f]))}};
  if (status === 200) { await fs.mkdir(path.dirname(ck), {recursive: true}); await fs.writeFile(ck, JSON.stringify(r)); }
  return r;
}
