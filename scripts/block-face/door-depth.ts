/**
 * Door reveal depth from two oblique panoramas (#181): plane sweep. The door region of a face (strip frame metres) is
 * rectified from a panorama on each side of the door onto planes 0..1.8 m behind the facade; where the leaf is, the
 * two rectifications agree (normalised cross-correlation of their gradients peaks). A wall control band beside the door
 * gives the pose bias (its peak should be ~0). Depth = door peak - control peak.
 *
 *   node --import tsx scripts/block-face/door-depth.ts --face=helmers-209-253 --x=-44.2,-43.0 [--z=0.1,2.4] [--date=2024-11-29] [--control=-46,-44.6]
 *
 *   --cz=lo,hi  the control band's heights (default 1.1-1.8 m over the door region's top)
 * Writes staging/block-face/door-depth/<face>@<x>.{json,png} (the two views at depth 0 and at the peak, side by side).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {AMSTERDAM_WORLD_ALIGNED, rectifyFacade} from '../../src/canalRecall/facade/rectify.ts';
import {lngLatToRd} from '../../src/canalRecall/facade/rdNew.ts';
import {listPanos} from '../pand-reference/select.ts';
import {loadPano} from '../pand-reference/rectify.ts';
import {lensFor} from '../da-costa-block/neighbourhood-core.ts';
import {FACES, STAGING} from './intake.ts';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const pair = (s: string | undefined, d: [number, number]): [number, number] => s ? s.split(',').map(Number) as [number, number] : d;
const PPM = 100, TARGET = Number(arg('angle') ?? 28);

function gradients(rgba: Uint8ClampedArray, w: number, h: number): Float32Array {
  const g = new Float32Array(w * h), lum = (i: number) => 0.3 * rgba[i * 4] + 0.59 * rgba[i * 4 + 1] + 0.11 * rgba[i * 4 + 2];
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x; g[i] = Math.hypot(lum(i + 1) - lum(i - 1), lum(i + w) - lum(i - w)); }
  return g;
}
function ncc(a: Float32Array, b: Float32Array): number {
  let ma = 0, mb = 0; for (let i = 0; i < a.length; i++) { ma += a[i]; mb += b[i]; } ma /= a.length; mb /= b.length;
  let n = 0, da = 0, db = 0; for (let i = 0; i < a.length; i++) { const x = a[i] - ma, y = b[i] - mb; n += x * y; da += x * x; db += y * y; }
  return n / Math.sqrt(da * db + 1e-9);
}

async function main() {
  const face = arg('face')!, [xa, xb] = pair(arg('x'), [0, 0]), [z0, z1] = pair(arg('z'), [0.1, 2.4]);
  const strip = JSON.parse(await fs.readFile(path.join(FACES, face, 'strip.json'), 'utf8'));
  const {midRD, uRD, nRD} = strip.frame, g = strip.groundNAP as number, date = arg('date') ?? strip.date;
  const at = (x: number, d: number) => ({x: midRD[0] + uRD[0] * x - nRD[0] * d, y: midRD[1] + uRD[1] * x - nRD[1] * d});
  const mid = at((xa + xb) / 2, 0);
  const raw = (await listPanos(mid, 25)).filter((p: any) => String(p.timestamp).slice(0, 10) === date || arg('date') === 'any');
  // Signed view angle from the facade normal (+ = camera to the +u side), distance along the normal.
  const views = raw.map((p: any) => { const c = lngLatToRd(p.geometry.coordinates); const dx = c.x - mid.x, dy = c.y - mid.y; const along = dx * uRD[0] + dy * uRD[1], out = dx * nRD[0] + dy * nRD[1]; return {p, along, out, deg: Math.atan2(along, out) * 180 / Math.PI}; })
    .filter(v => v.out > 3 && v.out < 25 && Math.abs(v.deg) > 12 && Math.abs(v.deg) < 60);
  // Several views at different angles: a periodic leaf (two panels, glazing bars) aliases at a depth period set by each
  // pair's baseline, so the mean over pairs keeps only the true depth. The first two (sheet) are the best opposite pair.
  const byTarget = (a: typeof views[number], b: typeof views[number]) => Math.abs(Math.abs(a.deg) - TARGET) - Math.abs(Math.abs(b.deg) - TARGET);
  const left = views.filter(v => v.deg < 0).sort(byTarget), right = views.filter(v => v.deg > 0).sort(byTarget);
  if (!left.length || !right.length) throw Error(`${face}: need a panorama either side of the door on ${date} (have ${views.map(v => v.deg.toFixed(0)).join(', ')})`);
  const chosen = [left[0], right[0], ...[...left.slice(1), ...right.slice(1)].sort(byTarget)].filter((v, i, a) => a.findIndex(w => Math.abs(w.deg - v.deg) < 6) === i).slice(0, Number(arg('views') ?? 4));
  const imgs = await Promise.all(chosen.map(async v => ({v, pano: (await loadPano({panoId: v.p.pano_id, record: v.p} as any))!.img, lens: lensFor(v.p, g)!})));
  const rect = (k: number, x0: number, x1: number, d: number, zz: [number, number] = [z0, z1]) => { const {pano, lens} = imgs[k]; return rectifyFacade(pano as any, {...lens.pose, headingDeg: 0, pitchDeg: 0, rollDeg: 0}, {start: at(x0, d), end: at(x1, d), baseZ: g + zz[0], topZ: g + zz[1]}, {pixelsPerMetre: PPM, camera: AMSTERDAM_WORLD_ALIGNED}); };
  const pairs: [number, number][] = [];
  for (let i = 0; i < imgs.length; i++) for (let j = i + 1; j < imgs.length; j++) if (Math.abs(chosen[i].deg - chosen[j].deg) >= 15) pairs.push([i, j]);
  const sweep = (x0: number, x1: number, zz: [number, number] = [z0, z1]) => {
    const curve: [number, number][] = [];
    for (let d = -0.1; d <= 1.8001; d += 0.025) {
      const gs = imgs.map((_, k) => { const r = rect(k, x0, x1, d, zz); return gradients(r.data, r.width, r.height); });
      curve.push([+d.toFixed(3), +(pairs.reduce((t, [i, j]) => t + ncc(gs[i], gs[j]), 0) / pairs.length).toFixed(4)]);
    }
    const best = curve.reduce((m, c) => c[1] > m[1] ? c : m);
    return {curve, peak: best[0], score: best[1]};
  };
  const door = sweep(xa, xb);
  // Control: the wall band over the ground storey (between its heads and the first-floor sills), door +-1.5 m.
  const [ca, cb] = pair(arg('control'), [xa - 1.5, xb + 1.5]), cz = pair(arg('cz'), [z1 + 1.1, z1 + 1.8]);
  const control = sweep(ca, cb, cz);
  const depth = +(door.peak - control.peak).toFixed(3);
  const out = path.join(STAGING, 'door-depth'), name = `${face}@${xa.toFixed(2)}`;
  await fs.mkdir(out, {recursive: true});
  const report = {face, x: [xa, xb], z: [z0, z1], date, views: chosen.map(v => ({panoId: v.p.pano_id, deg: +v.deg.toFixed(1), distM: +v.out.toFixed(1)})), door: {peak: door.peak, score: door.score}, control: {x: [ca, cb], z: cz, peak: control.peak, score: control.score}, depthM: depth, curve: door.curve};
  await fs.writeFile(path.join(out, `${name}.json`), JSON.stringify(report, null, 1));
  // Sheet: left/right views at depth 0 (top) and at the door peak (bottom), the door +-0.6 m.
  const tiles: Buffer[] = [];
  for (const d of [0, door.peak]) for (const k of [0, 1]) { const r = rect(k, xa - 0.6, xb + 0.6, d); tiles.push(await sharp(Buffer.from(r.data), {raw: {width: r.width, height: r.height, channels: 4}}).png().toBuffer()); }
  const meta = await sharp(tiles[0]).metadata(), W = meta.width!, H = meta.height!;
  await sharp({create: {width: W * 2 + 10, height: H * 2 + 10, channels: 3, background: '#fff'}}).composite(tiles.map((t, i) => ({input: t, left: (i % 2) * (W + 10), top: Math.floor(i / 2) * (H + 10)}))).png().toFile(path.join(out, `${name}.png`));
  console.log(`${face} x ${xa}..${xb}: views ${report.views.map(v => `${v.deg}°@${v.distM}m`).join(' / ')}; door peak ${door.peak} m (ncc ${door.score}), wall control ${control.peak} m (ncc ${control.score}) -> depth ${depth} m; ${path.join(out, name)}.png`);
}
main().catch(e => { console.error(e); process.exit(1); });
