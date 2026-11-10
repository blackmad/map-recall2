// Hand set v1 (lane H5h round 3, #351): measure the Jev storeys question (writers/jevStoreys.ts) against reader A's storeys under
// STOREYS_DEFINITION. Every readable single-front pand with a storeys reading: AB07 on its describe crop (good and fallback tier,
// reported apart), the easy houses on front.jpg, the Nassaukade pands on their strip span. Answers are cached by image hash in
// <archive>/jev-cache/storeys/; the key is read only from TYPESAFE_API_KEY (run through zsh -lic), never printed, logged or cached.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { jevImage } from '../describe.ts';
import { askJevStoreys, parseStoreys, storeysHash, type StoreysAnswer } from '../../../src/canalRecall/houseSpec/writers/jevStoreys.ts';
import { costOf } from '../../../src/canalRecall/houseSpec/writers/jev.ts';
import { UNKNOWN, type HandSet } from '../../../src/canalRecall/houseSpec/handSet.ts';
import { gateFor, verdict, wilson } from '../agreement.ts';
import { ARCHIVE, setPands } from './sources.ts';

export const HELP = `hand-set jev-storeys: the Jev storeys question against hand set v1 (docs/house-line.md §4c).

  zsh -lic 'node --import tsx scripts/house-specs/hand-set/jev-storeys.ts [--budget-usd 1] [--dry-run]'

Writes data/house-line/hand-set-v1.jev-storeys.json. Gate: storeys (reader ceiling - 0.1), Wilson 95 %.`;

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');

async function main() {
  const argv = process.argv.slice(2); if (argv.includes('--help')) { console.log(HELP); return; }
  const i = argv.indexOf('--budget-usd'); const cap = i >= 0 ? Number(argv[i + 1]) : 1; const dry = argv.includes('--dry-run');
  const A: HandSet = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/house-line/hand-set-v1.json'), 'utf8'));
  const scores = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/house-line/hand-set-v1.scores.json'), 'utf8'));
  const ceiling: number | null = scores.readerCeiling?.BC?.storeys?.precision ?? null;
  const key = process.env.TYPESAFE_API_KEY; if (!dry && !key) { console.error('TYPESAFE_API_KEY is not set (run through zsh -lic); stopping.'); process.exit(2); }
  const cacheDir = path.join(ARCHIVE, 'jev-cache', 'storeys'); fs.mkdirSync(cacheDir, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'h5h-jev-'));
  const src = new Map(setPands().map(p => [p.pandId, p]));
  let usd = 0, called = 0, cachedN = 0, failed = 0, skipped = 0; let stop = false;
  const rows: { pandId: string; group: string; tier: string; hand: number; jev: StoreysAnswer | null }[] = [];
  for (const h of A.pands) {
    if (!h.readable || h.extent === 'multi' || h.fields.storeys.value === UNKNOWN) continue;
    let file: string | null = null, tier = h.group;
    if (h.group === 'ab07') {
      const env = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/house-specs/generated/AB07', `${h.pandId}.json`), 'utf8'));
      if (!env.crop?.file) continue; file = path.join(ARCHIVE, 'pand-crops', h.pandId, env.crop.file); tier = `ab07-${env.crop.tier}`;
    } else {
      const img = src.get(h.pandId)!.images[0]; file = img.file;
      if (img.px) { const m = await sharp(img.file).metadata(); file = path.join(tmp, `${h.pandId}.jpg`); await sharp(img.file).extract({ left: img.px[0], top: 0, width: img.px[1] - img.px[0], height: m.height! }).jpeg({ quality: 92 }).toFile(file); }
    }
    if (!file || !fs.existsSync(file)) { skipped++; continue; }
    const img = await jevImage(file); if (!img) { skipped++; rows.push({ pandId: h.pandId, group: h.group, tier, hand: h.fields.storeys.value as number, jev: null }); continue; }
    const hash = storeysHash(img.jpg), cf = path.join(cacheDir, `${hash}.json`);
    let ans: StoreysAnswer | null = null;
    if (fs.existsSync(cf)) { ans = JSON.parse(fs.readFileSync(cf, 'utf8')).answer; cachedN++; }
    else if (!dry && !stop && usd < cap) {
      const r = await askJevStoreys(key!, img.jpg, `${hash}-facade`);
      if (r.status === 401 || r.status === 403) { stop = true; console.error(`Jev auth error ${r.status}; stopping (fail closed)`); }
      else try {
        if (r.status !== 200) throw new Error(`HTTP ${r.status}`);
        const p = parseStoreys(r.body); ans = p.answer; usd += costOf(p.tokens); called++;
        fs.writeFileSync(cf, JSON.stringify({ version: 1, model: p.model, answer: ans, tokens: p.tokens, pandId: h.pandId, padded: img.padded, at: new Date().toISOString() }, null, 1) + '\n');
      } catch (e: any) { failed++; console.error(`${h.pandId}: ${e.message}`); }
    }
    rows.push({ pandId: h.pandId, group: h.group, tier, hand: h.fields.storeys.value as number, jev: ans });
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  const gate = gateFor(ceiling ?? 1);
  const sc = (rs: typeof rows, minP = 0) => { const st = rs.filter(r => r.jev && r.jev.p >= minP); const k = st.filter(r => r.jev!.value === r.hand).length, k1 = st.filter(r => Math.abs(r.jev!.value - r.hand) <= 1).length; return { hand: rs.length, stated: st.length, agree: k, precision: st.length ? +(k / st.length).toFixed(3) : null, ci: wilson(k, st.length), within1: k1, diff: st.reduce((m: Record<string, number>, r) => ((m[r.jev!.value - r.hand] = (m[r.jev!.value - r.hand] ?? 0) + 1), m), {}), verdict: verdict(k, st.length, gate).verdict }; };
  const groups = [...new Set(rows.map(r => r.tier))].sort();
  const report = { version: 1, question: 'fixtures/jev-storeys.json v1', gate, ceiling, calls: { called, cached: cachedN, failed, skipped, usd: +usd.toFixed(5) }, all: sc(rows), byTier: Object.fromEntries(groups.map(g => [g, sc(rows.filter(r => r.tier === g))])), atP: Object.fromEntries([0.5, 0.7, 0.9].map(t => [t, sc(rows, t)])), rows };
  fs.writeFileSync(path.join(ROOT, 'data/house-line/hand-set-v1.jev-storeys.json'), JSON.stringify(report, null, 1) + '\n');
  const f = (c: any) => `${c.agree}/${c.stated} = ${c.precision} [${c.ci[0]}, ${c.ci[1]}] ${c.verdict}, within 1 ${c.within1}, jev-hand ${JSON.stringify(c.diff)}`;
  console.log(`Jev storeys: called ${called}, cached ${cachedN}, failed ${failed}, skipped ${skipped}, $${usd.toFixed(4)}; gate ${gate}`);
  console.log(`all: ${f(report.all)}`); for (const g of groups) console.log(`${g}: ${f(report.byTier[g])}`); for (const t of [0.5, 0.7, 0.9]) console.log(`p >= ${t}: ${f((report.atP as any)[t])}`);
}
if (process.argv[1]?.endsWith('hand-set/jev-storeys.ts')) await main();
