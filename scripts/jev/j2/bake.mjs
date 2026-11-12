/**
 * J3 (#377) bake-off aggregator. node scripts/jev/j2/bake.mjs  -> prints markdown tables; writes <cache>/bake.json.
 * Needs scores-jev.json / scores-gimg.json / scores-gaddr.json (score.mjs --r1=.. --r2=.. --out=..) already written.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {CACHE} from './lib.mjs';
const RATE = {jev: 0.042, gemini: 0.10}; // USD per million tokens, list price (Gemini ran on the free tier: actual $0)
const rd = async f => JSON.parse(await fs.readFile(path.join(CACHE, f), 'utf8'));
const S = {jev: await rd('scores-jev.json'), img: await rd('scores-gimg.json'), addr: await rd('scores-gaddr.json')};
const key = o => `${o.family}/${o.question}`;
const idx = Object.fromEntries(Object.entries(S).map(([k, v]) => [k, Object.fromEntries(v.map(o => [key(o), o]))]));
const runs = async (fam, run) => { const d = path.join(CACHE, 'runs', fam, run); const o = []; try { for (const f of await fs.readdir(d)) { const j = JSON.parse(await fs.readFile(path.join(d, f), 'utf8')); o.push(j); } } catch {} return o; };
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : null; };
const f = (x, d = 2) => x == null ? 'n/a' : x.toFixed(d);
const out = [];
// cost + latency per family and backend
const fams = [...new Set(S.jev.map(o => o.family))];
const cost = {}, lat = {jev: [], img: [], addr: []}, nanswers = {};
for (const fam of fams) for (const [b, run, rate] of [['jev', 'r1', RATE.jev], ['img', 'g-img-medium', RATE.gemini], ['addr', 'g-addr-medium', RATE.gemini]]) {
  const rs = (await runs(fam, run)).filter(r => r.status === 200);
  const tok = rs.reduce((a, r) => a + r.tokens, 0);
  cost[`${fam}/${b}`] = {calls: rs.length, tokens: tok, usd: tok * rate / 1e6, per1k: rs.length ? tok * rate / 1e6 / rs.length * 1000 : null, meanTok: rs.length ? Math.round(tok / rs.length) : null};
  lat[b].push(...rs.map(r => r.latencyMs).filter(x => x > 0));
}
out.push('### Main table (single run per cell; Jev = J2 run 1)\n', '| Family / question | n | Jev acc | Jev wrong-conf | G img acc | G img wrong-conf | G +addr acc | G +addr wrong-conf | baseline |', '|---|---:|---:|---:|---:|---:|---:|---:|---:|');
for (const o of S.jev) { const k = key(o), a = idx.img[k], b = idx.addr[k]; out.push(`| ${k} | ${o.n}/${a?.n ?? '-'}/${b?.n ?? '-'} | ${f(o.acc1)} | ${f(o.wrongConf)} (${o.nWrong}) | ${a ? f(a.acc1) : 'n/a'} | ${a ? `${f(a.wrongConf)} (${a.nWrong})` : 'n/a'} | ${b ? f(b.acc1) : 'n/a'} | ${b ? `${f(b.wrongConf)} (${b.nWrong})` : 'n/a'} | ${f(o.baseline)} |`); }
out.push('\n### Cost per family (list price; mean tokens per call; $ for the run of that family)\n', '| Family | calls | Jev tok/call | Jev $ | G img tok/call | G img $ | G +addr tok/call | G +addr $ |', '|---|---:|---:|---:|---:|---:|---:|---:|');
let tot = {jev: 0, img: 0, addr: 0};
for (const fam of fams) { const j = cost[`${fam}/jev`], a = cost[`${fam}/img`], b = cost[`${fam}/addr`]; for (const [k, c] of [['jev', j], ['img', a], ['addr', b]]) tot[k] += c.usd; out.push(`| ${fam} | ${j.calls}/${a.calls}/${b.calls} | ${j.meanTok} | ${f(j.usd, 4)} | ${a.meanTok} | ${f(a.usd, 4)} | ${b.meanTok} | ${f(b.usd, 4)} |`); }
out.push(`| **total** | | | ${f(tot.jev, 4)} | | ${f(tot.img, 4)} | | ${f(tot.addr, 4)} |`);
out.push('\n### Latency (ms, per call, all families)\n', '| Backend | n | p50 | p95 |', '|---|---:|---:|---:|');
for (const [b, n] of [['jev', 'Jev (J2 run 1; concurrency 4)'], ['img', 'Gemini image-only (concurrency 4, throttled)'], ['addr', 'Gemini +address']]) out.push(`| ${n} | ${lat[b].length} | ${pct(lat[b], .5)} | ${pct(lat[b], .95)} |`);
// years
const yrs = {}; for (const [b, run] of [['jev', 'r1'], ['img', 'g-img-medium'], ['addr', 'g-addr-medium']]) {
  const pairs = await rd('pairs.json'); const sameB = {1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 10: 1, 11: 1, 12: 1, 13: 1, 9: 0}, shop = {1: 1, 2: 1, 4: 1, 5: 1, 10: 1, 11: 1, 12: 0, 13: 1};
  const r = {b: [0, 0], s: [0, 0], paint: []};
  for (const [i, p] of pairs.entries()) { let j; try { j = JSON.parse(await fs.readFile(path.join(CACHE, 'runs/years', run, `${p.id}.json`), 'utf8')); } catch { continue; } const a = j.response.answers; if (!a) continue;
    const tb = p.kind === 'decoy' ? 0 : sameB[i], ts = p.kind === 'decoy' ? null : shop[i];
    if (tb != null) { r.b[1]++; r.b[0] += (a.same_building.noul >= .5) === !!tb; } if (ts != null) { r.s[1]++; r.s[0] += (a.same_shopfront.noul >= .5) === !!ts; }
    if (p.kind === 'decoy') r.paint.push(a.same_paint.noul); }
  yrs[b] = r; }
out.push('\n### Years (cross-year pairs; single run)\n', '| Backend | same_building | same_shopfront | decoy same_paint mean (lower is better) |', '|---|---|---|---|');
for (const [b, r] of Object.entries(yrs)) out.push(`| ${b} | ${r.b[0]}/${r.b[1]} | ${r.s[0]}/${r.s[1]} | ${f(r.paint.reduce((a, x) => a + x, 0) / Math.max(1, r.paint.length))} |`);
// likeness
const T = await rd('triples.json'); const lk = {};
for (const [b, run] of [['jev', 'r1'], ['img', 'g-img-medium'], ['addr', 'g-addr-medium']]) {
  const gem = (await runs('likeness', 'g-img-medium')).map(r => r.id), r = {n: 0, pick: {today: 0, spec: 0, decoy: 0}, same: {true: [0, 0], decoy: [0, 0]}, score: {today: [0, 0], spec: [0, 0], decoy: [0, 0]}};
  for (const t of T) { if (!gem.includes(t.id)) continue; let j, j2; try { j = JSON.parse(await fs.readFile(path.join(CACHE, 'runs/likeness', run, `${t.id}.json`), 'utf8')).response.answers; } catch { continue; } if (!j?.best) continue;
    r.n++; r.pick[t.key[+j.best.choice[1] - 1]]++; for (const [i, kind] of t.key.entries()) { r.score[kind][0] += +j[`score_r${i + 1}`].choice; r.score[kind][1]++; }
    try { j2 = JSON.parse(await fs.readFile(path.join(CACHE, 'runs/likeness2', run, `${t.id}.json`), 'utf8')).response.answers; } catch { continue; }
    for (const [i, kind] of t.key.entries()) { const s = j2[`same_r${i + 1}`].noul >= .5, g = kind === 'decoy' ? r.same.decoy : r.same.true; g[1]++; g[0] += s; } }
  lk[b] = r; }
out.push('\n### Likeness (only the triples whose archived renders still exist; same subset for every backend)\n', '| Backend | triples | best-of-three: today / spec / decoy picked | mean 1-5 score today / spec / decoy | says "same" true renders | says "same" decoys |', '|---|---:|---|---|---|---|');
for (const [b, r] of Object.entries(lk)) out.push(`| ${b} | ${r.n} | ${r.pick.today} / ${r.pick.spec} / ${r.pick.decoy} | ${['today', 'spec', 'decoy'].map(k => f(r.score[k][0] / Math.max(1, r.score[k][1]))).join(' / ')} | ${r.same.true[0]}/${r.same.true[1]} | ${r.same.decoy[0]}/${r.same.decoy[1]} |`);
// resolution
out.push('\n### Resolution medium vs high (image-only)\n', '| Family | res | tokens/call | $/1k calls | accuracy (all questions, mean) | per-question acc |', '|---|---|---:|---:|---:|---|');
const RT = {};
for (const fam of ['white', 'head']) for (const res of ['medium', 'high']) {
  const run = `g-img-${res}`; const rs = (await runs(fam, run)).filter(r => r.status === 200); if (!rs.length) continue;
  const tok = rs.reduce((a, r) => a + r.tokens, 0) / rs.length;
  const sc = JSON.parse(await (async () => { const {execFileSync} = await import('node:child_process'); execFileSync('node', ['scripts/jev/j2/score.mjs', `--r1=${run}`, `--r2=${run}`, `--out=scores-tmp-${fam}-${res}.json`], {stdio: 'ignore', env: process.env}); return fs.readFile(path.join(CACHE, `scores-tmp-${fam}-${res}.json`), 'utf8'); })()).filter(o => o.family === fam);
  out.push(`| ${fam} | ${res} | ${Math.round(tok)} | ${f(tok * RATE.gemini / 1e6 * 1000, 3)} | ${f(sc.reduce((a, o) => a + o.acc1, 0) / sc.length, 3)} | ${sc.map(o => `${o.question} ${f(o.acc1)}`).join(', ')} |`); }
// recall probe: bad/marginal crops
const sets = await rd('sets.json'); const probe = [];
for (const fam of ['white_B', 'colour_words_B', 'head_B']) for (const v of ['img', 'addr']) {
  const rs = (await runs(fam, `g-${v}-medium`)).filter(r => r.status === 200); const bad = new Set(sets.B.slice(12)), marg = new Set(sets.B.slice(0, 12));
  for (const [cls, set] of [['marginal', marg], ['bad', bad]]) { const ps = []; for (const r of rs) if (set.has(r.id)) for (const a of Object.values(r.response.answers)) ps.push(a.confidence ?? 0); probe.push({fam, v, cls, n: ps.length, mean: ps.reduce((a, x) => a + x, 0) / Math.max(1, ps.length), confident: ps.filter(x => x >= .8).length / Math.max(1, ps.length)}); }
}
out.push('\n### Recall probe: facade questions asked on marginal and bad (occluded or uninformative) crops, mean confidence and share of answers at confidence >= 0.8\n', '| Family | variant | crop class | answers | mean conf | share >= 0.8 |', '|---|---|---|---:|---:|---:|');
for (const p of probe) out.push(`| ${p.fam} | ${p.v} | ${p.cls} | ${p.n} | ${f(p.mean)} | ${f(p.confident)} |`);
await fs.writeFile(path.join(CACHE, 'bake.json'), JSON.stringify({cost, lk, yrs, probe}, null, 1));
console.log(out.join('\n'));
