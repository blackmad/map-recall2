/**
 * Strip evidence gate over block-face runs (#120). Measures every span of each run's rectified strip
 * (src/canalRecall/blockFace/stripEvidence.ts) and reports the gate's verdict per span and per run.
 *
 *   node --import tsx scripts/block-face/evidence-gate.ts [--strips=<dir>] [--runs=a,b] [--calibrate] [--json=<out>]
 *
 * --strips: a directory of <run>/strip.jpg + <run>/strip.json (default: staging/block-face/<run>/strip.jpg with
 *   scripts/block-face/faces/<run>/strip.json). Eaves come from scripts/block-face/faces/<run>/pands/<id>/facts.json.
 * --calibrate: the named cases (the reviewed Bloemgrachtbuurt holds must REJECT; the reviewed installs must PASS) and
 *   their confusion table.
 */
import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {measureSpanEvidence, evidenceVerdict, runVerdict, type SpanEvidence} from '../../src/canalRecall/blockFace/stripEvidence.ts';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const FACES = 'scripts/block-face/faces';

/** Runs a reviewer held because the strip shows no front (scripts/block-face/buurten/bloemgrachtbuurt-review-holds.json). */
export const NO_FRONT_RUNS = ['bloem-128-206-r2', 'akoleien-2-10-r1', 'lelie-150-194-r1', 'bloemgracht-53-95-r1'];

async function installedRuns(): Promise<string[]> {
  const out: string[] = [];
  for (const f of (await fs.readdir('scripts/block-face/batch')).filter(f => f.endsWith('.csv'))) {
    const rows = (await fs.readFile(path.join('scripts/block-face/batch', f), 'utf8')).trim().split('\n').slice(1);
    for (const r of rows) { const c = r.split(','); if (c[8] === 'installed') out.push(c[1]); }
  }
  return out;
}

export interface RunEvidence {run: string; image: string; strip: {width: number; height: number; pixelsPerMetre: number}; spans: (SpanEvidence & {pandId: string; px: [number, number]; widthM: number; eavesM: number; roofM: number; pass: boolean; reasons: string[]})[]; pass: boolean; reasons: string[]}

export async function runEvidence(run: string, stripsDir?: string): Promise<RunEvidence | null> {
  const sj = stripsDir && existsSync(path.join(stripsDir, run, 'strip.json')) ? path.join(stripsDir, run, 'strip.json') : path.join(FACES, run, 'strip.json');
  const img = stripsDir ? path.join(stripsDir, run, 'strip.jpg') : path.join('staging/block-face', run, 'strip.jpg');
  if (!existsSync(sj) || !existsSync(img)) return null;
  const strip = JSON.parse(await fs.readFile(sj, 'utf8'));
  const {data, info} = await sharp(img).removeAlpha().raw().toBuffer({resolveWithObject: true});
  const rgb = new Uint8Array(data.buffer, data.byteOffset, data.length);
  const spans = [];
  for (const s of strip.spans) {
    const ff = path.join(FACES, run, 'pands', s.pandId, 'facts.json');
    const facts = existsSync(ff) ? JSON.parse(await fs.readFile(ff, 'utf8')) : null;
    const eavesM = facts ? facts.fronts[0].eavesM : strip.heightM * 0.7, roofM = facts ? facts.heights.roofMaxM : eavesM + 3;
    const ev = measureSpanEvidence({rgb, width: info.width, height: info.height, px: s.px, pixelsPerMetre: strip.pixelsPerMetre, eavesM, roofM, panoramas: s.panoramas});
    const v = evidenceVerdict(ev);
    spans.push({pandId: s.pandId, px: s.px, roofM, widthM: +(s.x1M - s.x0M).toFixed(2), eavesM: +eavesM.toFixed(2), ...ev, ...v});
  }
  return {run, image: img, strip: {width: info.width, height: info.height, pixelsPerMetre: strip.pixelsPerMetre}, spans, ...runVerdict(spans)};
}

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
/** Contact sheet: each run's strip at 230 px high, a pass/fail bar per span over it, the band-over-roof line dashed,
 * and the gate's numbers and reasons under it. Rejected runs first. */
async function writeSheet(results: RunEvidence[], out: string, max: number) {
  const pick = [...results.filter(r => !r.pass), ...results.filter(r => r.pass)].slice(0, max);
  const TH = 230, TW = 250, CAP = 64, cols = 5, tiles: sharp.OverlayOptions[] = [];
  for (const [k, r] of pick.entries()) {
    const sc = Math.min(TH / r.strip.height, TW / r.strip.width), w = Math.round(r.strip.width * sc), h = Math.round(r.strip.height * sc);
    const img = await sharp(r.image).resize(w, h).toBuffer();
    const bars = r.spans.map(s => {
      const x0 = s.px[0] * sc, x1 = s.px[1] * sc, yb = (r.strip.height - (s.roofM + 0.7) * r.strip.pixelsPerMetre) * sc;
      return `<rect x="${x0 + 1}" y="0" width="${Math.max(1, x1 - x0 - 2)}" height="6" fill="${s.pass ? '#1a9850' : '#d73027'}"/><line x1="${x0}" x2="${x1}" y1="${yb}" y2="${yb}" stroke="#ffd700" stroke-width="1.5" stroke-dasharray="4 3"/>`;
    }).join('');
    const reason = r.pass ? '' : r.spans.find(s => !s.pass)!.reasons[0].replace(/:.*/, '');
    const cap = `<text x="2" y="${h + 14}" font-size="12" font-family="Arial" font-weight="bold" fill="${r.pass ? '#1a9850' : '#d73027'}">${r.pass ? 'PASS' : 'REJECT'} ${esc(r.run)}</text>`
      + `<text x="2" y="${h + 29}" font-size="11" font-family="Arial" fill="#222">sky cols ${r.spans.map(s => s.skyCols.toFixed(2)).join(' / ')}</text>`
      + `<text x="2" y="${h + 43}" font-size="10" font-family="Arial" fill="#444">obl ${r.spans.map(s => s.obliquityDeg ?? '-').join('/')} deg, ${r.spans.map(s => s.distanceM ?? '-').join('/')} m</text>`
      + (reason ? `<text x="2" y="${h + 57}" font-size="10" font-family="Arial" fill="#d73027">${esc(reason)}</text>` : '');
    const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${TW}" height="${TH + CAP}">${bars}${cap}</svg>`);
    const tile = await sharp({create: {width: TW, height: TH + CAP, channels: 3, background: '#ffffff'}}).composite([{input: img, left: 0, top: 0}, {input: svg, left: 0, top: 0}]).png().toBuffer();
    tiles.push({input: tile, left: (k % cols) * (TW + 8), top: Math.floor(k / cols) * (TH + CAP + 8)});
  }
  const rows = Math.ceil(pick.length / cols);
  await fs.mkdir(path.dirname(out), {recursive: true});
  await sharp({create: {width: cols * (TW + 8), height: rows * (TH + CAP + 8), channels: 3, background: '#ffffff'}}).composite(tiles).jpeg({quality: 82}).toFile(out);
  console.log(`sheet ${out}: ${pick.length} runs`);
}

async function main() {
  const stripsDir = arg('strips');
  const calibrate = process.argv.includes('--calibrate');
  const runs = arg('runs') === 'all' && stripsDir ? (await fs.readdir(stripsDir)).filter(r => existsSync(path.join(stripsDir, r, 'strip.jpg'))) : arg('runs')?.split(',') ?? (calibrate ? [...new Set([...await installedRuns(), ...NO_FRONT_RUNS])] : await installedRuns());
  const results: RunEvidence[] = [];
  for (const r of runs) { const e = await runEvidence(r, stripsDir); if (e) results.push(e); else console.log(`${r}: no strip`); }
  const f = (v: number | null) => v === null ? '  -  ' : v.toFixed(2).padStart(5);
  console.log('  run                          pand   skyCol open  bandM  sky  reach  dist   obl  leaf  void  verdict');
  for (const e of results) for (const s of e.spans) {
    const label = calibrate ? (NO_FRONT_RUNS.includes(e.run) ? 'R' : 'P') : ' ';
    console.log(`${label} ${e.run.padEnd(28)} ${s.pandId.slice(-6)} ${f(s.skyCols)} ${f(s.open)} ${f(s.aboveM)} ${f(s.sky)} ${f(s.reach)} ${f(s.distanceM)} ${f(s.obliquityDeg)} ${f(s.foliage)} ${f(s.placeholder)}  ${s.pass ? 'pass' : 'FAIL ' + s.reasons.join('; ')}`);
  }
  if (calibrate) {
    const t = {rr: [] as string[], rp: [] as string[], pr: [] as string[], pp: [] as string[]};
    for (const e of results) {
      const bad = NO_FRONT_RUNS.includes(e.run);
      (bad ? (e.pass ? t.rp : t.rr) : (e.pass ? t.pp : t.pr)).push(e.run);
    }
    console.log(`\nconfusion (runs): no-front rejected ${t.rr.length}, no-front passed ${t.rp.length} [${t.rp}], good passed ${t.pp.length}, good rejected ${t.pr.length} [${t.pr}]`);
  }
  for (const e of results) console.log(`${e.pass ? 'PASS' : 'REJECT'} ${e.run}${e.reasons.length ? ': ' + e.reasons.join('; ') : ''}`);
  const sheet = arg('sheet');
  if (sheet) await writeSheet(results, sheet, Number(arg('sheet-max') ?? 19));
  const out = arg('json');
  if (out) { await fs.mkdir(path.dirname(out), {recursive: true}); await fs.writeFile(out, JSON.stringify(results, null, 1) + '\n'); }
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('evidence-gate.ts')) main().catch(e => { console.error(e); process.exit(1); });
