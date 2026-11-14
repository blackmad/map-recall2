/**
 * Wall sample v2 calibration (lane d1-wall-colour, 2026-11-14; src/canalRecall/houseSpec/wallSample.ts).
 *
 *  transfer  the render transfer drawn wall -> pixel: every house:frames pose (rule-10 likeness frame) whose target pand drew
 *            a spec wall (pose.json drawn.specRecipeWall) against W1 wallLab of that pand in likeness.png (row-lab.ts output).
 *            Least squares: pixel L = kL x drawn L + cL; pixel (a, b) = kC x drawn (a, b) + cast (shared kC).
 *  exposure  the v2 estimate (captures.ts samples, wallSample.ts estimateWall) against W1 wallLab of the same pand in the
 *            rule-10 photo: mean dL and dC per sceneTarget, and the cross-capture spread (ICC) per correction variant.
 *
 *   node --import tsx scripts/house-specs/wall-sample/calibrate.ts transfer --frames <dir>[,<dir>] --lab <rows-lab.json>[,...]
 *   node --import tsx scripts/house-specs/wall-sample/calibrate.ts exposure --captures <file>[,...] --lab <rows-lab.json> [--target t]
 *        [--normalise-photo]   compare with the photo brought to the standard capture by its own scene reference (like with like)
 */
import fs from 'node:fs';
import path from 'node:path';
import { hexToOklab } from '../../../src/canalRecall/houseSpec/wallColour.ts';
import { WALL_SAMPLE, correctCapture, estimateWall, labOf, type CaptureSample, type WallSampleParams } from '../../../src/canalRecall/houseSpec/wallSample.ts';

const argv = process.argv.slice(2), opt = (n: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
const list = (n: string) => (opt(n) ?? '').split(',').filter(Boolean);
const readLab = () => Object.assign({}, ...list('lab').map(f => JSON.parse(fs.readFileSync(f, 'utf8')))) as Record<string, { side: string; per: Record<string, Record<string, { L: number; C: number; hex: string } | null>> }>;

export function fitTransfer(pairs: Array<{ drawn: [number, number, number]; pixel: [number, number, number] }>) {
  const n = pairs.length, mean = (f: (p: typeof pairs[0]) => number) => pairs.reduce((s, p) => s + f(p), 0) / n;
  const mx = mean(p => p.drawn[0]), my = mean(p => p.pixel[0]);
  const kL = pairs.reduce((s, p) => s + (p.drawn[0] - mx) * (p.pixel[0] - my), 0) / pairs.reduce((s, p) => s + (p.drawn[0] - mx) ** 2, 0);
  // shared kC over a and b with separate offsets
  const ma = mean(p => p.drawn[1]), mb = mean(p => p.drawn[2]), pa = mean(p => p.pixel[1]), pb = mean(p => p.pixel[2]);
  const num = pairs.reduce((s, p) => s + (p.drawn[1] - ma) * (p.pixel[1] - pa) + (p.drawn[2] - mb) * (p.pixel[2] - pb), 0);
  const den = pairs.reduce((s, p) => s + (p.drawn[1] - ma) ** 2 + (p.drawn[2] - mb) ** 2, 0);
  const kC = num / den;
  const res = pairs.map(p => Math.hypot(p.pixel[0] - (kL * p.drawn[0] + my - kL * mx), p.pixel[1] - (kC * p.drawn[1] + pa - kC * ma), p.pixel[2] - (kC * p.drawn[2] + pb - kC * mb)));
  return { n, kL: +kL.toFixed(3), cL: +(my - kL * mx).toFixed(3), kC: +kC.toFixed(3), cast: [+(pa - kC * ma).toFixed(4), +(pb - kC * mb).toFixed(4)], rmsE: +Math.sqrt(res.reduce((s, r) => s + r * r, 0) / n).toFixed(3) };
}

function transfer() {
  const lab = readLab(), pairs: Array<{ drawn: [number, number, number]; pixel: [number, number, number]; key: string }> = [];
  for (const root of list('frames')) for (const side of fs.readdirSync(root)) {
    const sd = path.join(root, side);
    if (!fs.statSync(sd).isDirectory()) continue;
    const run = path.basename(root);
    for (const k of fs.readdirSync(sd)) {
      const f = path.join(sd, k, 'pose.json');
      if (!fs.existsSync(f)) continue;
      const p = JSON.parse(fs.readFileSync(f, 'utf8')), w = p.drawn?.specRecipeWall, px = lab[k]?.per?.[p.pandId]?.[run];
      if (!w || !px) continue;
      pairs.push({ key: `${run}/${k}`, drawn: hexToOklab(w), pixel: hexToOklab(px.hex) });
    }
  }
  console.log(JSON.stringify(fitTransfer(pairs)));
}

function exposure() {
  const lab = readLab(), caps = new Map<string, any>();
  for (const f of list('captures')) for (const r of JSON.parse(fs.readFileSync(f, 'utf8')).rows) caps.set(r.pandId, r);
  // the photo as measured, or (--normalise-photo) brought to the standard capture by the same gain from its own scene
  const photoOf = new Map<string, { L: number; C: number }>(), norm = argv.includes('--normalise-photo');
  for (const row of Object.values(lab) as any[]) for (const [id, v] of Object.entries<any>(row.per)) if (v.photo) {
    if (!norm || !row.photoScene) { photoOf.set(id, v.photo); continue; }
    const o = labOf(correctCapture({ hex: v.photo.hex, refs: { white: [0, 0, 0], scene: row.photoScene, n: 0 } }).out);
    photoOf.set(id, { L: o.L, C: o.C });
  }
  const samplesOf = (r: any): CaptureSample[] => r.captures.map((c: any) => ({ hex: c.w1.hex, refs: c.refs ?? null, pinned: !!c.pinned, captured: c.captured }));
  const ids = [...caps.keys()].filter(id => photoOf.has(id) && caps.get(id).captures.length);
  const run = (name: string, P: WallSampleParams) => {
    let dL = 0, dC = 0, aL = 0, n = 0;
    for (const id of ids) {
      const e = estimateWall(samplesOf(caps.get(id)), P)!, [L, a, b] = hexToOklab(e.hex), ph = photoOf.get(id)!;
      dL += L - ph.L; dC += Math.hypot(a, b) - ph.C; aL += Math.abs(L - ph.L); n++;
    }
    console.log(`${name.padEnd(22)} n ${n}  mean dL ${(dL / n).toFixed(3)}  mean |dL| ${(aL / n).toFixed(3)}  mean dC ${(dC / n).toFixed(4)}`);
  };
  run('raw pinned', { ...WALL_SAMPLE, gainMin: 1, gainMax: 1, chromaGain: 1 });
  const t0 = Number(opt('target') ?? WALL_SAMPLE.sceneTarget);
  for (const t of [0.05, 0.06, 0.07, 0.08, 0.1, 0.12]) run(`sceneTarget ${t}`, { ...WALL_SAMPLE, sceneTarget: t, chromaGain: 1 });
  for (const g of [1, 1.2, 1.4, 1.6, 1.8, 2]) run(`t ${t0} chromaGain ${g}`, { ...WALL_SAMPLE, sceneTarget: t0, chromaGain: g });
  run('current WALL_SAMPLE', WALL_SAMPLE);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (argv[0] === 'transfer') transfer();
  else if (argv[0] === 'exposure') exposure();
  else { console.log('calibrate.ts transfer|exposure ...'); process.exit(2); }
}
