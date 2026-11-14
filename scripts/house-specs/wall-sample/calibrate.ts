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
 *  round2    (round 2) chroma ceiling and hue source against the photos; the dark-finish evidence (darkFinish.ts) against the
 *            photo's own dark fronts (a pand under 0.33, or 0.06 under its row's median in the same photo), and the veto's
 *            effect on |dL|.
 *   node --import tsx scripts/house-specs/wall-sample/calibrate.ts round2 --captures <file>[,...] --lab <rows-lab.json> --answers <dir>[,<dir>]
 */
import fs from 'node:fs';
import path from 'node:path';
import { hexToOklab } from '../../../src/canalRecall/houseSpec/wallColour.ts';
import { WALL_SAMPLE, correctCapture, estimateWall, labOf, type CaptureSample, type WallSampleParams } from '../../../src/canalRecall/houseSpec/wallSample.ts';
import { DARK_FINISH } from '../../../src/canalRecall/houseSpec/darkFinish.ts';
import { darkEvidence } from './evidence.ts';


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

function round2() {
  const lab = readLab(), caps = new Map<string, any>(), ans = new Map<string, any>();
  for (const f of list('captures')) for (const r of JSON.parse(fs.readFileSync(f, 'utf8')).rows) caps.set(r.pandId, r);
  for (const d of list('answers')) for (const f of fs.readdirSync(d)) if (/^\d{16}\.json$/.test(f)) ans.set(f.slice(0, 16), JSON.parse(fs.readFileSync(path.join(d, f), 'utf8')));
  const med = (xs: number[]) => { const s = [...xs].sort((p, q) => p - q), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  type Pt = { id: string; row: string; photo: { L: number; C: number; hex: string }; dark: boolean; samples: CaptureSample[] };
  const pts: Pt[] = [];
  for (const [row, r] of Object.entries<any>(lab)) {
    const ph = Object.entries<any>(r.per).filter(([, v]) => v.photo), rm = med(ph.map(([, v]) => v.photo.L));
    for (const [id, v] of ph) {
      const c = caps.get(id);
      if (!c?.captures.length) continue;
      pts.push({ id, row, photo: v.photo, dark: v.photo.L < 0.33 || v.photo.L < rm - 0.06, samples: c.captures.map((x: any) => ({ hex: x.w1.hex, refs: x.refs ?? null, pinned: !!x.pinned })) });
    }
  }
  const hueOf = (a: number, b: number) => ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
  const hd = (x: number, y: number) => ((x - y + 540) % 360) - 180;
  console.log(`round2: ${pts.length} photo pands with captures, ${pts.filter(p => p.dark).length} dark in their photo`);
  const evalP = (name: string, P: WallSampleParams, veto?: (p: Pt) => boolean) => {
    let dL = 0, aL = 0, dC = 0, aC = 0, n = 0, hn = 0, ah = 0, sh = 0;
    const wk: Record<string, number[]> = {};
    for (const p of pts) {
      const e = estimateWall(p.samples, P, veto ? veto(p) : false)!, [L, a, b] = hexToOklab(e.hex), q = hexToOklab(p.photo.hex), C = Math.hypot(a, b);
      dL += L - p.photo.L; aL += Math.abs(L - p.photo.L); dC += C - p.photo.C; aC += Math.abs(C - p.photo.C); n++;
      if (C > 0.015 && p.photo.C > 0.025) { const d = hd(hueOf(a, b), hueOf(q[1], q[2])); ah += Math.abs(d); sh += d; hn++; }
      if (p.row.startsWith('weteringschans')) (wk[p.row] ??= []).push(C, hueOf(a, b), L);
    }
    const w = Object.entries(wk).map(([k, v]) => `${k.slice(15)} C ${(v.filter((_, i) => i % 3 === 0).reduce((s, x) => s + x, 0) / (v.length / 3)).toFixed(3)} h ${(v.filter((_, i) => i % 3 === 1).reduce((s, x) => s + x, 0) / (v.length / 3)).toFixed(0)}`).join(' ; ');
    console.log(`${name.padEnd(30)} dL ${(dL / n).toFixed(3)} |dL| ${(aL / n).toFixed(3)} dC ${(dC / n).toFixed(4)} |dC| ${(aC / n).toFixed(4)} hue d ${(sh / hn).toFixed(1)} |d| ${(ah / hn).toFixed(1)} (n ${hn}) | ${w}`);
  };
  evalP('round 1 (chromaMax 0, hue all)', WALL_SAMPLE);
  for (const t of [0.35, 0.45, 0.55, 0.65, 0.75]) evalP(`gain white ${t}`, { ...WALL_SAMPLE, gainFrom: 'white', whiteTarget: t });
  for (const t of [0.45, 0.55, 0.65]) evalP(`gain mix ${t}`, { ...WALL_SAMPLE, gainFrom: 'mix', whiteTarget: t });
  if (opt('pages')) {
    const pages = JSON.parse(fs.readFileSync(opt('pages')!, 'utf8')) as Record<string, string[]>;
    const byPage = (P: WallSampleParams) => Object.entries(pages).map(([pg, ks]) => { const s = pts.filter(p => ks.includes(p.row)); const d = s.map(p => hexToOklab(estimateWall(p.samples, P)!.hex)[0] - p.photo.L); return `${pg} ${(d.reduce((a, x) => a + x, 0) / s.length).toFixed(3)}`; }).join('  ');
    console.log('  per page dL, scene:', byPage(WALL_SAMPLE));
    for (const t of [0.55, 0.65]) console.log(`  per page dL, white ${t}:`, byPage({ ...WALL_SAMPLE, gainFrom: 'white', whiteTarget: t }));
    console.log('  per page dL, mix 0.55:', byPage({ ...WALL_SAMPLE, gainFrom: 'mix', whiteTarget: 0.55 }));
    for (const m of [0.08, 0.12, 0.16]) { evalP(`maxDL ${m}`, { ...WALL_SAMPLE, maxDL: m }); console.log(`  per page dL, maxDL ${m}:`, byPage({ ...WALL_SAMPLE, maxDL: m })); }
    for (const t of [0.07, 0.1]) { evalP(`sceneTarget ${t}`, { ...WALL_SAMPLE, sceneTarget: t }); console.log(`  per page dL, sceneTarget ${t}:`, byPage({ ...WALL_SAMPLE, sceneTarget: t })); }
  }
  for (const m of [0.025, 0.03, 0.035, 0.04, 0.05]) evalP(`chromaMax ${m}`, { ...WALL_SAMPLE, chromaMax: m });
  for (const m of [0, 0.035, 0.04]) evalP(`hue dim, chromaMax ${m}`, { ...WALL_SAMPLE, hueFrom: 'dim', chromaMax: m });
  // dark-finish evidence against the photo's dark fronts
  const ev = new Map(pts.map(p => [p.id, darkEvidence(caps.get(p.id), ans.get(p.id))]));
  const pr = (name: string, f: (p: Pt) => boolean) => { const s = pts.filter(f), tp = s.filter(p => p.dark).length; console.log(`  ${name.padEnd(34)} flagged ${String(s.length).padStart(3)}  photo-dark ${tp}  precision ${s.length ? (tp / s.length).toFixed(2) : '-'}  recall ${(tp / pts.filter(p => p.dark).length).toFixed(2)}`); };
  pr('describer', p => !!ev.get(p.id)!.describer);
  pr('captures', p => !!ev.get(p.id)!.captures?.dark);
  pr('neighbours', p => !!ev.get(p.id)!.neighbours?.dark);
  pr('any', p => ev.get(p.id)!.dark);
  pr('painted-brick (finish only)', p => ans.get(p.id)?.finish === 'painted-brick');
  pr('painted-brick, not pale', p => ans.get(p.id)?.finish === 'painted-brick' && ans.get(p.id)?.pale === false);
  // the veto's effect on |dL| per rule (the photo itself, not the dark label, is the judge)
  const eff = (name: string, f: (p: Pt) => boolean) => { const s = pts.filter(f); if (!s.length) return; const P = { ...WALL_SAMPLE, chromaMax: 0.04 };
    const d0 = s.map(p => hexToOklab(estimateWall(p.samples, P)!.hex)[0] - p.photo.L), d1 = s.map(p => hexToOklab(estimateWall(p.samples, P, true)!.hex)[0] - p.photo.L);
    const m = (d: number[]) => `dL ${(d.reduce((a, x) => a + x, 0) / d.length).toFixed(3)} |dL| ${(d.reduce((a, x) => a + Math.abs(x), 0) / d.length).toFixed(3)}`;
    console.log(`  veto effect ${name.padEnd(30)} n ${String(s.length).padStart(3)}  lifted ${m(d0)}  vetoed ${m(d1)}`); };
  eff('describer', p => !!ev.get(p.id)!.describer);
  eff('captures', p => !!ev.get(p.id)!.captures?.dark);
  eff('neighbours', p => !!ev.get(p.id)!.neighbours?.dark);
  eff('painted-brick, not pale', p => ans.get(p.id)?.finish === 'painted-brick' && ans.get(p.id)?.pale === false);
  eff('everything (veto all)', () => true);
  for (const v of [0.44, 0.48]) { const DD = { ...DARK_FINISH, capMaxL: v }; eff(`captures capMaxL ${v}`, p => !!darkEvidence(caps.get(p.id), ans.get(p.id), WALL_SAMPLE, DD).captures?.dark); }
  for (const v of [-0.04]) { const DD = { ...DARK_FINISH, nbRel: v }; eff(`neighbours nbRel ${v}`, p => !!darkEvidence(caps.get(p.id), ans.get(p.id), WALL_SAMPLE, DD).neighbours?.dark); }
  console.log(`  neighbour evidence on ${pts.filter(p => ev.get(p.id)!.neighbours).length} pands`);
  for (const [k, D] of Object.entries({ capMaxL: [0.36, 0.4, 0.44, 0.48], nbRel: [-0.04, -0.07, -0.1, -0.13] })) for (const v of D) {
    const DD = { ...DARK_FINISH, [k]: v }, e2 = new Map(pts.map(p => [p.id, darkEvidence(caps.get(p.id), ans.get(p.id), WALL_SAMPLE, DD)]));
    pr(`${k} ${v}: ${k === 'capMaxL' ? 'captures' : 'neighbours'}`, p => k === 'capMaxL' ? !!e2.get(p.id)!.captures?.dark : !!e2.get(p.id)!.neighbours?.dark);
  }
  const best = { ...WALL_SAMPLE, chromaMax: Number(opt('chroma-max') ?? 0.04) };
  evalP('chosen, no veto', best);
  evalP('chosen + veto', best, p => ev.get(p.id)!.dark);
  const dk = (P: WallSampleParams, veto: boolean) => { const s = pts.filter(p => ev.get(p.id)!.dark); const d = s.map(p => hexToOklab(estimateWall(p.samples, P, veto)!.hex)[0] - p.photo.L); return `n ${s.length} dL ${(d.reduce((a, x) => a + x, 0) / s.length).toFixed(3)} |dL| ${(d.reduce((a, x) => a + Math.abs(x), 0) / s.length).toFixed(3)}`; };
  console.log(`  vetoed pands: lifted ${dk(best, false)}  |  vetoed ${dk(best, true)}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (argv[0] === 'round2') round2();
  else if (argv[0] === 'transfer') transfer();
  else if (argv[0] === 'exposure') exposure();
  else { console.log('calibrate.ts transfer|exposure ...'); process.exit(2); }
}
