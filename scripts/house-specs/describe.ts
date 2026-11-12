// house:describe (house line H5, docs/house-line.md §4b): fill a HouseSpec from the sources in trust order and stop where the
// evidence stops. One writer module per source in src/canalRecall/houseSpec/writers/.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { spawnSync } from 'node:child_process';
import sharp from 'sharp';
import { decodeDescriptor, type DecodedDescriptor } from '../../src/canalRecall/bagTiles.ts';
import { registerFactsFromExtract } from '../../src/canalRecall/facade/registerRecipe.ts';
import { bagWriter } from '../../src/canalRecall/houseSpec/writers/bag.ts';
import { registerWriter } from '../../src/canalRecall/houseSpec/writers/register.ts';
import { pixelSpec, type CropTier } from '../../src/canalRecall/houseSpec/writers/pixel.ts';
import { Budget, JEV, askJev, cropHash, costOf, jevSpec, parseResponse, type JevAnswers } from '../../src/canalRecall/houseSpec/writers/jev.ts';
import { mergeWriters, type Disagreement, type WriterPart } from '../../src/canalRecall/houseSpec/writers/merge.ts';
import { specFields, type HouseSpec } from '../../src/canalRecall/houseSpec/spec.ts';
import { JUDGE_GOOD } from '../house-crops/flags.ts';
import { judgeSize, judgePath, judgeDir, quality as judgeQuality, type JudgeRecord } from '../house-crops/judge.ts';
import { loadBuurt, pandsInBuurt } from '../house-crops/buurt.ts';
import { manifestPath, type Manifest } from '../house-crops/manifest.ts';
import { usability, type CropFlags } from '../house-crops/flags.ts';
import { bestCrop, type CropCandidate } from './tier.ts';

export const WRITERS = ['register', 'bag', 'pixel', 'jev'] as const;
export type WriterName = (typeof WRITERS)[number];

export const HELP = `house:describe: fill a HouseSpec from the sources in trust order, and stop where the evidence stops.

  npm run house:describe -- <pandId>                       one pand (16 digits, with or without NL.IMBAG.Pand.)
  npm run house:describe -- --buurt <code> [flags]         every pand of a CBS buurt (4-letter code, CBS code or name)

  --writers register,bag,pixel,jev   which writers run (default: all four). Order does not matter: fields merge by the evidence
                                     ladder (facade/evidence.ts SOURCE_STRENGTH), then confidence, then the newer date.
  --jev-budget-usd <n>               hard cap on Jev spend for THIS run (default 2). No Jev call is made without it being printed.
  --jev-buurt-budget-usd <n>         hard cap on the buurt's cumulative describe spend, read from <archive>/jev-cache/ledger.json (default 3)
  --archive <dir>                    source-data checkout holding pand-crops/<id>/front.jpg and, for Jev, jev-cache/ (default env
                                     HOUSE_CROPS_ARCHIVE, else ~/Code/map-recall2-source-data-h5)
  --good-threshold <q>               judge quality for the good crop tier (default ${JUDGE_GOOD}, JUDGE_GOOD in scripts/house-crops/flags.ts)
  --dry-run                          no network, no writes: crop tiers, the writers that would run, Jev calls to make, cached, estimated USD
  --stage                            after writing, run the staging extract (npm run house:specs). npm run house:stage (H3) has not landed:
                                     when it exists --stage names it in the output but does not call it
  --out <dir>                        output root (default scripts/house-specs/generated)
  --help                             this text

Writers (src/canalRecall/houseSpec/writers/), what each may write, source and rank:
  register  monument-text   gable, facade year, finish, hoist beam, stoop, elements (no crop needed)
  bag       bag             facts/facadeYear (0.5); storeys off (H5h: eaves / 3 m agreed 0.43 with the hand set, 0.55 with offsets)
  pixel     streetlevel-measured   wall colour + brick material + rhythmic window columns (bays) + measured storeys; measureFacade
                                   'houseLine' profile; fallback-tier crops write only colour and storeys, at lower confidence
  jev       vision-judge    bays (p>=0.55), a confident gable (p>=0.75), finish (p>=0.9), shop/residential (p>=0.875); good-tier crops only
Jev answers are cached by crop hash in <archive>/jev-cache/, so a re-run costs nothing. The key is read only from TYPESAFE_API_KEY
(run the command through zsh -lic); it is never printed, logged or cached, and a 401/403 stops the run.
Output: scripts/house-specs/generated/<buurt>/<pandId>.json = {crop, writers, spec (merged, full provenance), disagreements}.
build-house-specs.ts reads the merged specs; scripts/house-specs/agreement.ts compares the writers with the hand intents.`;

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const EXTRACT = path.join(ROOT, 'public/data/extracts/amsterdam');
export const GENERATED = path.join(ROOT, 'scripts/house-specs/generated');
const json = <T = any>(p: string): T => JSON.parse(fs.readFileSync(p, 'utf8'));
const rd = <T,>(p: string, d: T): T => { try { return json<T>(p); } catch { return d; } };

export type Envelope = {
  version: 1; pandId: string; buurt: string | null;
  crop: { tier: CropTier | 'none'; file: string | null; year: number | null; quality: number | null; panoIds: string[]; date: string | null; reasons: string[]; ppm: number | null } | null;
  writers: Record<string, HouseSpec | null>;
  spec: HouseSpec | null; disagreements: Disagreement[];
  jev?: { cached: boolean; hash: string; usd: number };
};

/** Every bag-facts tile as one map (272 small files; read once). */
export function loadBag(): Map<string, DecodedDescriptor> {
  const root = path.join(EXTRACT, 'bag-facts/14'), out = new Map<string, DecodedDescriptor>();
  for (const x of fs.readdirSync(root)) for (const y of fs.readdirSync(path.join(root, x))) {
    const tile = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root, x, y))).toString('utf8'));
    for (const [k, row] of Object.entries<number[]>(tile.pands)) out.set(k, decodeDescriptor(row));
  }
  return out;
}

/** The crops a pand has: the manifest crop (judge store, prompt v1) and the best-of-years crops (judge/<code>-picks.json). */
export function cropCandidates(code: string, id: string, manifest: Manifest, judge: Record<string, JudgeRecord>, picks: Map<string, any>): (CropCandidate & { ppm: number | null; date: string | null })[] {
  const e = manifest.pands[id], out: (CropCandidate & { ppm: number | null; date: string | null })[] = [];
  const same = (a: string[], b: string[]) => [...a].sort().join() === [...b].sort().join();
  if (e?.status === 'ok' && e.flags && e.panoIds) {
    const j = judge[id];
    out.push({ file: 'front.jpg', year: e.chosenYear ?? null, panoIds: e.panoIds, reasons: usability(e.flags as CropFlags).reasons, quality: j && same(j.panoIds, e.panoIds) ? judgeQuality(j) : null, ppm: e.ppm ?? null, date: e.date ?? null });
  }
  for (const c of picks.get(id)?.cands ?? []) {
    if (out.some(o => same(o.panoIds, c.panoIds))) continue;
    out.push({ file: c.file, year: c.year, panoIds: c.panoIds, reasons: c.reasons, quality: typeof c.quality === 'number' ? c.quality : null, ppm: e?.ppm ?? null, date: null });
  }
  return out;
}

/** The image Jev is sent: the crop, scaled so the short side is >= 300 px and the long side <= 1400 (Jev refuses a side under 280 and does not
 *  resize); a front too narrow for that is padded with mid-grey on both sides, the house stays in the middle. */
export async function jevImage(file: string): Promise<{ jpg: Buffer; padded: boolean } | null> {
  const meta = await sharp(file).metadata();
  let img = sharp(file), w = meta.width!, h = meta.height!, padded = false;
  if (!judgeSize(w, h)) {
    const need = Math.ceil(h * 0.22);
    if (w >= need || w < need * 0.5) return null; // a front under half the padded width is mostly grey: not sent
    const left = Math.floor((need - w) / 2);
    const buf = await sharp(file).extend({ left, right: need - w - left, background: { r: 128, g: 128, b: 128 } }).toBuffer();
    img = sharp(buf); w = need; padded = true;
    if (!judgeSize(w, h)) return null;
  }
  const size = judgeSize(w, h)!;
  return { jpg: await img.resize(size.width, size.height).jpeg({ quality: 88 }).toBuffer(), padded };
}

export type Args = { pand: string | null; buurt: string | null; writers: WriterName[]; jevBudget: number; jevBuurtBudget: number; archive: string; goodThreshold: number; dryRun: boolean; stage: boolean; out: string };
export function parseArgs(argv: string[]): Args {
  const opt = (n: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
  const writers = (opt('writers') ?? WRITERS.join(',')).split(',').map(s => s.trim()).filter(Boolean) as WriterName[];
  for (const w of writers) if (!WRITERS.includes(w)) throw new Error(`unknown writer "${w}" (register, bag, pixel, jev)`);
  const pos = argv.find(x => /^(NL\.IMBAG\.Pand\.)?\d{16}$/.test(x));
  return {
    pand: pos ? /(\d{16})$/.exec(pos)![1] : null, buurt: opt('buurt') ?? null, writers,
    jevBudget: Number(opt('jev-budget-usd') ?? 2), jevBuurtBudget: Number(opt('jev-buurt-budget-usd') ?? 3),
    archive: opt('archive') ?? process.env.HOUSE_CROPS_ARCHIVE ?? path.join(process.env.HOME ?? '', 'Code/map-recall2-source-data-h5'),
    goodThreshold: Number(opt('good-threshold') ?? JUDGE_GOOD), dryRun: argv.includes('--dry-run'), stage: argv.includes('--stage'), out: opt('out') ?? GENERATED,
  };
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || !argv.length) { console.log(HELP); return; }
  const a = parseArgs(argv);
  if (!a.pand && !a.buurt) { console.error('give a pand id or --buurt <code>'); process.exit(2); }
  const t0 = Date.now();
  const want = (w: WriterName) => a.writers.includes(w);
  // the pands
  let code = a.buurt, ids: string[] = [];
  if (a.buurt) {
    const b = await loadBuurt(a.buurt); code = b.code;
    ids = (await pandsInBuurt(b)).map(f => f.id.replace('NL.IMBAG.Pand.', ''));
  } else ids = [a.pand!];
  if (!code && a.pand) {
    const dir = path.join(ROOT, 'scripts/house-crops/manifests');
    code = fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => f.replace('.json', '')).find(c => a.pand! in json<Manifest>(path.join(dir, `${c}.json`)).pands) ?? null;
  }
  const manifestFile = code ? manifestPath(code) : null;
  const manifest: Manifest = manifestFile && fs.existsSync(manifestFile) ? json(manifestFile) : { version: 1, pands: {} } as unknown as Manifest;
  const judge: Record<string, JudgeRecord> = code ? rd(judgePath(code, 'v1'), {}) : {};
  const picks = new Map<string, any>((rd<any>(code ? path.resolve(judgeDir(), `${code}-picks.json`) : '', { picks: [] }).picks as any[]).map(p => [p.pandId, p]));
  const register = registerFactsFromExtract(json(path.join(EXTRACT, 'monument-facts.json')));
  const bag = want('bag') || want('pixel') ? loadBag() : new Map<string, DecodedDescriptor>();

  // Jev state: key from the environment only, cache and ledger in the archive
  const cacheDir = path.join(a.archive, 'jev-cache'), ledgerFile = path.join(cacheDir, 'ledger.json');
  const ledger: Record<string, { usd: number; calls: number }> = rd(ledgerFile, {});
  const key = process.env.TYPESAFE_API_KEY;
  const buurtKey = code ?? 'none';
  const run = new Budget(a.jevBudget), total = new Budget(a.jevBuurtBudget, ledger[buurtKey]?.usd ?? 0);
  const jevStats = { cached: 0, called: 0, skippedBudget: 0, skippedImage: 0, failed: 0, wouldCall: 0, usd: 0 };
  if (want('jev') && !a.dryRun && !key) { console.error('TYPESAFE_API_KEY is not set in this process (run through zsh -lic); stopping.'); process.exit(2); }
  let authStop = false;

  const outDir = path.join(a.out, code ?? 'pands');
  const envelopes: Envelope[] = [];
  const tiers = { good: 0, fallback: 0, none: 0, nocrop: 0 };
  for (const id of ids) {
    const cands = code ? cropCandidates(code, id, manifest, judge, picks) : [];
    const best = bestCrop(cands, a.goodThreshold);
    const cand = best ? cands.find(c => c.file === best.crop.file)! : null;
    const tier: CropTier | 'none' = best?.tier === 'good' ? 'good' : best ? 'fallback' : 'none';
    if (!cands.length) tiers.nocrop++; else tiers[tier]++;
    const cropFile = cand ? path.join(a.archive, 'pand-crops', id, cand.file) : null;
    const hasFile = !!cropFile && fs.existsSync(cropFile);
    const parts: WriterPart[] = [];
    const writers: Record<string, HouseSpec | null> = {};
    const date = null;
    const d = bag.get(id);
    if (want('register')) { const s = registerWriter(id, register); writers.register = s; if (s) parts.push({ writer: 'register', spec: s }); }
    if (want('bag')) { const s = bagWriter(id, d, date); writers.bag = s; if (s) parts.push({ writer: 'bag', spec: s }); }
    let at: string | null = cand?.date ?? null;
    if (want('pixel') && best && hasFile && cand!.ppm) {
      const { data, info } = await sharp(cropFile!).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      const wallTopM = d?.eavesM && d.eavesM >= 4.5 ? d.eavesM : d?.ridgeM ?? null;
      const s = pixelSpec({ pandId: id, image: { rgb: new Uint8Array(data), width: info.width, height: info.height, ppm: cand!.ppm }, tier: best.tier as CropTier, wallTopM, ref: `source-data://pand-crops/${id}/${cand!.file}`, at });
      writers.pixel = s; if (s) parts.push({ writer: 'pixel', spec: s });
    }
    let jevInfo: Envelope['jev'];
    if (want('jev') && best?.tier === 'good' && hasFile) {
      const img = await jevImage(cropFile!);
      if (!img) jevStats.skippedImage++;
      else {
        const hash = cropHash(img.jpg), cacheFile = path.join(cacheDir, `${hash}.json`);
        let answers: JevAnswers | null = null, usd = 0, cached = false;
        const hit = rd<any>(cacheFile, null);
        if (hit?.answers) { answers = hit.answers; cached = true; jevStats.cached++; usd = 0; }
        else if (a.dryRun) { jevStats.wouldCall++; }
        else if (authStop || run.exhausted || total.exhausted) jevStats.skippedBudget++;
        else {
          const r = await askJev(key!, img.jpg, `${hash}-facade`);
          if (r.status === 401 || r.status === 403) { authStop = true; console.error(`Jev auth error ${r.status}; no more Jev calls this run (fail closed)`); }
          else {
            try {
              if (r.status !== 200) throw new Error(`HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 100)}`);
              const p = parseResponse(r.body); answers = p.answers; usd = costOf(p.tokens);
              run.add(p.tokens); total.add(p.tokens); jevStats.called++; jevStats.usd += usd;
              fs.mkdirSync(cacheDir, { recursive: true });
              fs.writeFileSync(cacheFile, JSON.stringify({ version: JEV.version, model: p.model, answers, tokens: p.tokens, pandId: id, padded: img.padded, at: new Date().toISOString() }, null, 1) + '\n');
              ledger[buurtKey] = { usd: +((ledger[buurtKey]?.usd ?? 0) + usd).toFixed(6), calls: (ledger[buurtKey]?.calls ?? 0) + 1 };
            } catch (e: any) { jevStats.failed++; console.error(`${id}: ${e.message}`); }
          }
        }
        if (answers) { const s = jevSpec(id, `source-data://pand-crops/${id}/${cand!.file}`, at, answers); writers.jev = s; if (specFields(s).length) parts.push({ writer: 'jev', spec: s }); jevInfo = { cached, hash, usd: +usd.toFixed(6) }; }
      }
    }
    const merged = mergeWriters(parts);
    if (!merged && !writers.register && !writers.bag && !writers.pixel && !writers.jev) { if (!a.pand) continue; }
    envelopes.push({
      version: 1, pandId: id, buurt: code,
      crop: cand ? { tier, file: cand.file, year: cand.year, quality: cand.quality, panoIds: cand.panoIds, date: cand.date, reasons: cand.reasons, ppm: cand.ppm } : null,
      writers, spec: merged?.spec ?? null, disagreements: merged?.disagreements ?? [], ...(jevInfo ? { jev: jevInfo } : {}),
    });
  }

  // report
  const fieldKey = (p: string) => p.replace(/^fronts\/\d+\//, 'fronts/');
  const cover: Record<string, Record<string, number>> = {}, dis: Record<string, number> = {};
  let merged = 0;
  for (const e of envelopes) {
    if (e.spec) merged++;
    for (const [w, s] of Object.entries(e.writers)) if (s) for (const [p] of specFields(s)) { if (p === 'notes') continue; (cover[fieldKey(p)] ??= {})[w] = (cover[fieldKey(p)]?.[w] ?? 0) + 1; }
    for (const d of e.disagreements) dis[fieldKey(d.path)] = (dis[fieldKey(d.path)] ?? 0) + 1;
  }
  console.log(`house:describe ${code ?? a.pand}: ${ids.length} pands, ${envelopes.length} with a spec; writers ${a.writers.join(',')}; good-tier threshold ${a.goodThreshold}${a.dryRun ? ' (dry run)' : ''}`);
  console.log(`  crops: good ${tiers.good}, fallback ${tiers.fallback}, hard-flag fail ${tiers.none}, no crop ${tiers.nocrop}`);
  console.log('  coverage (pands with the field, per writer):');
  for (const [f, row] of Object.entries(cover).sort(([x], [y]) => (x < y ? -1 : 1))) console.log(`    ${f.padEnd(26)} ${Object.entries(row).map(([w, n]) => `${w} ${n}`).join(', ')}`);
  console.log(`  disagreements (two writers, different values): ${Object.keys(dis).length ? Object.entries(dis).sort(([x], [y]) => (x < y ? -1 : 1)).map(([f, n]) => `${f} ${n}`).join(', ') : 'none'}`);
  if (want('jev')) {
    const estimate = jevStats.wouldCall * 1600 * 0.042e-6;
    console.log(`  jev: ${jevStats.cached} cached, ${jevStats.called} called, ${jevStats.wouldCall} would call (est. $${estimate.toFixed(4)}), ${jevStats.skippedBudget} skipped by budget, ${jevStats.skippedImage} image too narrow, ${jevStats.failed} failed`);
    console.log(`  jev spend this run: $${jevStats.usd.toFixed(4)} of $${a.jevBudget} run budget; buurt ${buurtKey} ledger $${(ledger[buurtKey]?.usd ?? 0).toFixed(4)} of $${a.jevBuurtBudget}`);
  }
  if (!a.dryRun) {
    fs.mkdirSync(outDir, { recursive: true });
    for (const e of envelopes) fs.writeFileSync(path.join(outDir, `${e.pandId}.json`), JSON.stringify(e, null, 1) + '\n');
    if (want('jev') && jevStats.called) { fs.mkdirSync(cacheDir, { recursive: true }); fs.writeFileSync(ledgerFile, JSON.stringify(ledger, null, 1) + '\n'); }
    console.log(`  wrote ${envelopes.length} files to ${path.relative(ROOT, outDir)} in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    if (a.stage) {
      const pkg = json<{ scripts: Record<string, string> }>(path.join(ROOT, 'package.json'));
      if (pkg.scripts['house:stage']) console.log('  --stage: npm run house:stage exists now; describe does not call it yet (it needs the H2 receipt per pand: see docs/house-line.md §4b)');
      else console.log('  --stage: npm run house:stage has not landed (H3); running the staging extract (house:specs) only');
      const r = spawnSync('npm', ['run', '-s', 'house:specs'], { cwd: ROOT, stdio: 'inherit' });
      if (r.status) process.exit(r.status);
    }
  } else if (a.stage) console.log('  --stage ignored in a dry run');
  if (authStop) process.exit(3);
}
if (process.argv[1]?.endsWith('house-specs/describe.ts')) await main();
