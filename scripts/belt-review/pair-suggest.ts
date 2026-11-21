/**
 * Stage 3 first pass by Claude: for every neighbour pair the city map groups (pairQueue), Opus sees both picked photos and
 * says separate / twin (same design) / one building / unsure, with how sure and why. Answers David has not given yet are
 * saved into grouping.pairs as by:'claude' through the running review server, so the page shows them for him to confirm.
 *
 *   npx tsx scripts/belt-review/pair-suggest.ts <faceId> [--server http://localhost:4340] [--model claude-opus-5-5] [--dry]
 * Output: review-data/belt-review/<faceId>/pair-suggest.json (answers, reasons, cost).
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { antCall, jsonOf } from './read-house.ts';
import { costOf } from '../../src/canalRecall/beltReview/houseRead.ts';
import { groupingFromPairs, pairQueue } from '../../src/canalRecall/beltReview/stages.ts';
import { PAIR_ANSWERS, type FaceBundle, type GroupingFile, type PairAnswer } from '../../src/canalRecall/beltReview/types.ts';

const args = process.argv.slice(2), faceId = args[0];
const opt = (k: string) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : undefined; };
const server = opt('server') ?? 'http://localhost:4340', model = opt('model') ?? 'claude-opus-5-5', dry = args.includes('--dry');
if (!faceId) { console.error('usage: pair-suggest.ts <faceId> [--server url] [--model m] [--dry]'); process.exit(2); }
const api = `${server}/api/belt-review`;
// The server drops idle keep-alive sockets during a slow model call; one retry on a fresh socket covers it.
const get = async (url: string, init?: RequestInit) => { try { return await fetch(url, init); } catch { return fetch(url, init); } };

const prompt = (a: string, z: string) => `Two photos of neighbouring canal houses in Amsterdam, rectified, left to right: first ${a}, then ${z}.
The city's map of original buildings lists them as one object, but that map often groups separately built houses.
Judge only the fronts you see. Answer one of:
- "separate": two different houses (different gable/cornice, storey lines, window rhythm, material or date);
- "twin": two houses built to the same design (matching fronts, but each its own house with its own door and party wall);
- "one": one building whose single front runs across both (one cornice, one continuous window rhythm and storey lines);
- "unsure": the photos don't let you tell (occluded, mis-cropped).
Reply with JSON only: {"answer": "...", "sure": 0.0-1.0, "why": "one short sentence naming the visible evidence"}`;

const bundle = await (await get(`${api}/faces/${faceId}`)).json() as FaceBundle & { token: string };
const q = pairQueue(bundle), addr = (id: string) => bundle.face.pands.find(p => p.pandId === id)?.address ?? id;
const img = async (id: string) => {
  const r = await get(`${api}/faces/${faceId}/photo/${encodeURIComponent(id)}.jpg`);
  if (!r.ok) return null;
  return sharp(Buffer.from(await r.arrayBuffer())).resize({ height: 1000, withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
};
const file = path.join('review-data/belt-review', faceId, 'pair-suggest.json');
type Suggestion = { left: string; right: string; answer: PairAnswer; sure: number; why: string; costUsd: number };
// Resumable: pairs already answered in pair-suggest.json are kept unless --force.
const out: Record<string, Suggestion> = !args.includes('--force') && fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')).pairs : {};
let spent = 0;
const save = () => fs.writeFileSync(file, JSON.stringify({ version: 1, faceId, model, at: new Date().toISOString(), spentUsd: +Object.values(out).reduce((t, x) => t + x.costUsd, 0).toFixed(3), pairs: out }, null, 1) + '\n');
for (const [a, z] of q) {
  const key = `${a}|${z}`;
  if (out[key]) continue;
  const [ia, iz] = [await img(a), await img(z)];
  if (!ia || !iz) { out[key] = { left: addr(a), right: addr(z), answer: 'unsure', sure: 0, why: 'no photo for one of the two', costUsd: 0 }; continue; }
  if (dry) { console.log('would ask', addr(a), addr(z)); continue; }
  const r = antCall([ia, iz], prompt(addr(a), addr(z)), model, 1000);
  const cost = costOf({ input_tokens: r.usage.input_tokens, output_tokens: r.usage.output_tokens }); spent += cost;
  let ans: { answer?: string; sure?: number; why?: string } = {};
  try { ans = jsonOf(r.text); } catch { /* unsure below */ }
  const answer = PAIR_ANSWERS.includes(ans.answer as never) ? ans.answer as PairAnswer : 'unsure';
  out[key] = { left: addr(a), right: addr(z), answer, sure: Number(ans.sure ?? 0), why: String(ans.why ?? r.text.slice(0, 200)), costUsd: +cost.toFixed(4) };
  console.log(`${addr(a)} | ${addr(z)}: ${answer} (${out[key].sure}) ${out[key].why}`);
  save();
}
if (dry) process.exit(0);
save();
// Save Claude's answers where David has none; his own answers always win.
const fresh = await (await get(`${api}/faces/${faceId}`)).json() as FaceBundle & { token: string };
const pairs: NonNullable<GroupingFile['pairs']> = { ...(fresh.grouping.pairs ?? {}) };
const at = new Date().toISOString();
for (const [key, s] of Object.entries(out)) if (!pairs[key] || pairs[key].by === 'claude') pairs[key] = { answer: s.answer, by: 'claude', at, why: `${s.why} (${Math.round(s.sure * 100)}% sure)` };
const res = await get(`${api}/faces/${faceId}/grouping`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-review-token': fresh.token },
  body: JSON.stringify({ expectedRevision: fresh.grouping.revision, value: groupingFromPairs(fresh, pairs) }) });
console.log(`saved: ${res.status} · ${Object.keys(out).length} pairs · $${spent.toFixed(3)}`);
