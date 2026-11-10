/**
 * J2 shared asker (#353). One Jev request = a set of named image parts + a questions object (fixtures/*.json).
 * Key only from process.env.TYPESAFE_API_KEY (login env); never printed, logged or written. 401/403 stops everything, no retries.
 * Spend is tracked per family in <cache>/ledger.json from the usage tokens (USD_PER_TOKEN, J1's rate; output tokens counted the same).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import sharp from 'sharp';

export const ENDPOINT = 'https://api.typesafe.ai/v1/systemone', MODEL = 'jev-1.14.0', USD_PER_TOKEN = 0.042 / 1e6;
export const CACHE = path.resolve(process.env.J2_CACHE ?? '.cache/jev-j2');
export const HARD_CAP_USD = 4.5; // stop below the $5 brief cap
export const arg = (n, d) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;

/** Jev rejects sides under 280 px and does not resize: short side >= 300, long side <= 1400; null if both cannot hold. */
export function jevSize(w, h) {
  const s = Math.max(1, 300 / Math.min(w, h)), W = Math.round(w * s), H = Math.round(h * s), down = Math.min(1, 1400 / Math.max(W, H));
  const o = {width: Math.round(W * down), height: Math.round(H * down)};
  return Math.min(o.width, o.height) >= 280 ? o : null;
}
export async function prepImage(file, out) {
  const m = await sharp(file).metadata(), s = jevSize(m.width, m.height);
  if (!s) return null;
  await fs.mkdir(path.dirname(out), {recursive: true});
  await sharp(file).resize(s.width, s.height).jpeg({quality: 88}).toFile(out);
  return out;
}

const ledgerFile = () => path.join(CACHE, 'ledger.json');
export async function readLedger() { try { return JSON.parse(await fs.readFile(ledgerFile(), 'utf8')); } catch { return {families: {}, total: 0}; } }
let ledgerLock = Promise.resolve();
export function addSpend(family, tokens, calls = 1) {
  ledgerLock = ledgerLock.then(async () => {
    const l = await readLedger(), f = (l.families[family] ??= {tokens: 0, calls: 0, usd: 0});
    f.tokens += tokens; f.calls += calls; f.usd = +(f.tokens * USD_PER_TOKEN).toFixed(6);
    l.total = +Object.values(l.families).reduce((a, x) => a + x.usd, 0).toFixed(6);
    await fs.mkdir(CACHE, {recursive: true}); await fs.writeFile(ledgerFile(), JSON.stringify(l, null, 1));
  });
  return ledgerLock;
}

let stopped = false;
/** images: {part: jpgPath}; questions: Jev questions object, where "$part" strings inside criteria examples are replaced by asset ids. */
export async function askJev({images, questions, note, family}) {
  const key = process.env.TYPESAFE_API_KEY;
  if (!key) { console.error('TYPESAFE_API_KEY is not set in this shell; stopping.'); process.exit(2); }
  if (stopped) return {status: -1, body: {error: 'stopped'}};
  const l = await readLedger();
  if (l.total >= HARD_CAP_USD) { console.error(`spend ${l.total} at the cap; stopping`); stopped = true; return {status: -1, body: {error: 'cap'}}; }
  const ids = Object.fromEntries(Object.keys(images).map(p => [p, `${randomUUID()}-${p}`]));
  const assets = Object.fromEntries(Object.entries(ids).map(([p, id]) => [id, {type: 'image', part: p}]));
  const q = JSON.parse(JSON.stringify(questions).replace(/"\$(\w+)"/g, (_, p) => JSON.stringify(ids[p])));
  const body = {model: MODEL, state: {...Object.fromEntries(Object.entries(ids).map(([p, id]) => [p, id])), note}, assets, questions: q};
  const form = new FormData();
  form.append('request', new Blob([JSON.stringify(body)], {type: 'application/json'}));
  for (const [p, f] of Object.entries(images)) form.append(p, new Blob([await fs.readFile(f)], {type: 'image/jpeg'}), `${p}.jpg`);
  const t0 = performance.now();
  let status = 0, text = '';
  try {
    const res = await fetch(ENDPOINT, {method: 'POST', headers: {Authorization: `Bearer ${key}`, 'TypeSafe-Danger-Zone-Images': 'true'}, body: form});
    status = res.status; text = await res.text();
  } catch (e) { text = `network: ${e.message}`; }
  if (status === 401 || status === 403) { stopped = true; console.error(`auth error ${status}; stopping (fail closed)`); }
  let response = null; try { response = JSON.parse(text); } catch { /* raw */ }
  const tokens = (response?.usage?.input_tokens ?? 0) + (response?.usage?.output_tokens ?? 0);
  if (family) await addSpend(family, tokens);
  return {status, latencyMs: Math.round(performance.now() - t0), body: response ?? {raw: text.slice(0, 500)}, tokens, request: {...body, assets: Object.fromEntries(Object.entries(assets).map(([id, a]) => [id, {...a, file: images[a.part]}]))}};
}

export async function pool(items, conc, fn) {
  const q = [...items]; let n = 0;
  await Promise.all(Array.from({length: conc}, async () => { while (q.length) { const it = q.shift(); await fn(it, ++n); } }));
}
