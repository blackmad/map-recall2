/**
 * Rectified Gemeente Amsterdam panorama crops (CC BY 4.0) along every front of the Oranje-Nassau Kazerne, in the
 * building frame of oranje-nassau-kazerne-footprints.json, with a metre ruler in u (or v) burnt into the bottom so
 * window axes can be read straight off the crop.
 *
 *   node --import tsx scripts/landmarks/oranje-nassau-kazerne-crops.ts [--side=nw|se|sw|ne|pav-nw-sw|...] [--ppm=36]
 *
 * Writes artifacts/landmark-lanes/oranje-nassau-kazerne/crops/<side>-<u0>-<u1>.jpg and crops.json (panorama id,
 * capture time, camera distance, obliquity per crop). Not committed; the panorama ids go in the inventory/sources.
 */
import fs from 'node:fs';
import sharp from 'sharp';
import {listPanos, rankPanos} from '../pand-reference/select.ts';
import {loadPano, rectifyWall} from '../pand-reference/rectify.ts';

const arg = (n: string, d = '') => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const src = JSON.parse(fs.readFileSync('scripts/landmarks/oranje-nassau-kazerne-footprints.json', 'utf8'));
const [ax, ay] = src.anchorRD as number[];
const th = (90 - src.axis.alongBearing) * Math.PI / 180;
const U = [Math.cos(th), Math.sin(th)], V = [-U[1], U[0]];
const rd = (u: number, v: number) => ({x: ax + U[0] * u + V[0] * v, y: ay + U[1] * u + V[1] * v});
const OUT = 'artifacts/landmark-lanes/oranje-nassau-kazerne/crops';
fs.mkdirSync(OUT, {recursive: true});
const ppm = Number(arg('ppm', '36'));

/** A straight wall run: `fixed` is the constant coordinate, `axis` which one varies, `out` the outward sign. */
type Run = {name: string; axis: 'u' | 'v'; fixed: number; from: number; to: number; out: 1 | -1; step: number};
const RUNS: Run[] = [
  {name: 'nw', axis: 'u', fixed: 14.4, from: -163.7, to: 116.0, out: 1, step: 20},
  {name: 'se', axis: 'u', fixed: -1.4, from: -141.7, to: 94.0, out: -1, step: 20},
  {name: 'pav-sw-se', axis: 'u', fixed: -12.6, from: -163.7, to: -141.7, out: -1, step: 22},
  {name: 'pav-ne-se', axis: 'u', fixed: -12.6, from: 94.0, to: 116.0, out: -1, step: 22},
  {name: 'sw-end', axis: 'v', fixed: -163.7, from: -12.6, to: 14.6, out: -1, step: 27.2},
  {name: 'ne-end', axis: 'v', fixed: 116.0, from: -12.6, to: 14.6, out: 1, step: 27.2},
  {name: 'pav-sw-ne', axis: 'v', fixed: -141.7, from: -12.6, to: -1.4, out: 1, step: 11.2},
  {name: 'pav-ne-sw', axis: 'v', fixed: 94.0, from: -12.6, to: -1.4, out: -1, step: 11.2},
];
const only = arg('side');
const log: unknown[] = [];
for (const run of RUNS.filter(r => !only || only.split(',').includes(r.name))) {
  for (let s0 = run.from; s0 < run.to - 1; s0 += run.step) {
    const s1 = Math.min(run.to, s0 + run.step + 2), a0 = Math.max(run.from, s0 - 2);
    const P = (s: number) => (run.axis === 'u' ? rd(s, run.fixed) : rd(run.fixed, s));
    // outward normal in RD
    const n = run.axis === 'u' ? [V[0] * run.out, V[1] * run.out] : [U[0] * run.out, U[1] * run.out];
    // CCW convention: a -> b runs with the outward normal on its right; image left = a
    const pa = P(a0), pb = P(s1);
    const dir = [pb.x - pa.x, pb.y - pa.y];
    const rightOfDir = [dir[1], -dir[0]];
    const flip = rightOfDir[0] * n[0] + rightOfDir[1] * n[1] < 0;
    const [A, B, sA, sB] = flip ? [pb, pa, s1, a0] : [pa, pb, a0, s1];
    const len = Math.hypot(B.x - A.x, B.y - A.y), mid = {x: (A.x + B.x) / 2, y: (A.y + B.y) / 2};
    const wall = {a: A, b: B, len, nx: n[0], ny: n[1], mid, roadDistM: 0, facing: 1};
    const panos = await listPanos(mid, 40);
    const ranked = rankPanos(wall as never, panos).filter(p => p.missionYear >= 2016);
    const tag = `${run.name}-${a0.toFixed(0)}_${s1.toFixed(0)}`;
    if (!ranked.length) { console.log(tag, 'no panorama'); log.push({tag, none: true}); continue; }
    let done = false;
    for (const pick of ranked.slice(0, 3)) {
      const pano = await loadPano(pick);
      if (!pano) continue;
      const crop = rectifyWall(pano.img, pick, wall as never, 20.5, ppm, src.groundNAP);
      if (!crop || crop.missingFraction > 0.3) continue;
      // ruler: a tick every metre of the running coordinate, labelled every 5 m
      const W = crop.width, H = crop.height, k = crop.ppm, ticks: string[] = [];
      for (let s = Math.ceil(Math.min(sA, sB)); s <= Math.max(sA, sB); s++) {
        const x = ((s - sA) / (sB - sA)) * W;
        const big = s % 5 === 0;
        ticks.push(`<line x1="${x}" y1="${H}" x2="${x}" y2="${H - (big ? 26 : 12)}" stroke="#ff0" stroke-width="2"/>`);
        if (big) ticks.push(`<text x="${x + 2}" y="${H - 28}" font-size="16" fill="#ff0" font-family="sans-serif">${s}</text>`);
      }
      for (let m = 0; m <= H / k; m += 1) ticks.push(`<line x1="0" y1="${H - m * k}" x2="${m % 5 ? 8 : 20}" y2="${H - m * k}" stroke="#0ff" stroke-width="2"/>`);
      const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${ticks.join('')}</svg>`);
      const file = `${OUT}/${tag}.jpg`;
      await sharp(crop.jpeg).composite([{input: svg}]).jpeg({quality: 78}).toFile(file);
      const rec = {tag, file, panoId: pick.panoId, ts: pick.timestamp, camDist: +pick.distM.toFixed(1), obl: +pick.obliquityDeg.toFixed(0), ppm: +k.toFixed(1), left: +sA.toFixed(2), right: +sB.toFixed(2), ground: crop.baseZ, missing: +crop.missingFraction.toFixed(2)};
      console.log(JSON.stringify(rec));
      log.push(rec);
      done = true;
      break;
    }
    if (!done) { console.log(tag, 'no usable crop'); log.push({tag, none: true}); }
  }
}
const logFile = `${OUT}/crops.json`;
const prior = fs.existsSync(logFile) ? JSON.parse(fs.readFileSync(logFile, 'utf8')) : [];
const merged = [...prior.filter((p: {tag: string}) => !log.some((l: any) => l.tag === p.tag)), ...log];
fs.writeFileSync(logFile, JSON.stringify(merged, null, 1));
