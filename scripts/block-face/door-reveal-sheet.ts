/**
 * Door reveal review sheet (#181): per door, the panorama seen from its own camera (a perspective crop of the
 * equirectangular photo) beside the installed chunk and the recompiled one rendered from the same eye, then both
 * from a cockpit eye (1.3 m up, 4.5 m out, 9 m along the street). Judge at gallery size: the reveal reads as shadow.
 *
 *   node --import tsx scripts/block-face/door-reveal-sheet.ts --face=helmers-209-253-r1 [--after=staging/block-face/<face>/chunk.glb] [--doors=3] [--pands=159748,...] [--out=...]
 *   ... --photos [--angle=38]   the measurement views only: the best panorama either side of each door
 *   ... --date=YYYY-MM-DD|any   panoramas of another day (default: the strip's)
 *   ... --match-half=1.2   half-width (m) of the photo-eye panels (default 2.4): zoom in to compare a return with the photo
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {AMSTERDAM_WORLD_ALIGNED, worldToEquirectangularPixel, sampleEquirectangular} from '../../src/canalRecall/facade/rectify.ts';
import {lngLatToRd} from '../../src/canalRecall/facade/rdNew.ts';
import {listPanos} from '../pand-reference/select.ts';
import {loadPano} from '../pand-reference/rectify.ts';
import {lensFor} from '../da-costa-block/neighbourhood-core.ts';
import {renderModels, closeRenderer, type RenderView} from '../building-recipes/render.ts';
import {doorPositions} from './door-positions.ts';
import {FACES, STAGING} from './intake.ts';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const [PW, PH] = (arg('size') ?? '360x300').split('x').map(Number), P = {width: PW, height: PH}, ANGLE = Number(arg('angle') ?? 30), HALF = Number(arg('half') ?? 1.9);

/** Perspective crop of an equirectangular panorama: eye/target in RD+NAP, vertical fov. */
function perspective(img: {width: number; height: number; data: Uint8Array}, pose: {x: number; y: number; z: number}, target: {x: number; y: number; z: number}, fovDeg: number, w: number, h: number) {
  const f = [target.x - pose.x, target.y - pose.y, target.z - pose.z], fl = Math.hypot(...f), fw = f.map(v => v / fl);
  const r0 = [fw[1], -fw[0], 0], rl = Math.hypot(...r0), right = r0.map(v => v / rl);
  const up = [right[1] * fw[2] - right[2] * fw[1], right[2] * fw[0] - right[0] * fw[2], right[0] * fw[1] - right[1] * fw[0]];
  const t = Math.tan(fovDeg * Math.PI / 360), out = Buffer.alloc(w * h * 3), px: number[] = [0, 0, 0, 0];
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const sx = (2 * (i + 0.5) / w - 1) * t * w / h, sy = (1 - 2 * (j + 0.5) / h) * t;
    const d = [0, 1, 2].map(k => fw[k] + right[k] * sx + up[k] * sy);
    const [u, v] = worldToEquirectangularPixel({x: pose.x + d[0], y: pose.y + d[1], z: pose.z + d[2]}, {...pose, headingDeg: 0, pitchDeg: 0, rollDeg: 0}, img, AMSTERDAM_WORLD_ALIGNED);
    sampleEquirectangular(img as any, u, v, px);
    out[(j * w + i) * 3] = px[0]; out[(j * w + i) * 3 + 1] = px[1]; out[(j * w + i) * 3 + 2] = px[2];
  }
  return sharp(out, {raw: {width: w, height: h, channels: 3}}).png().toBuffer();
}

async function labelled(image: Buffer, text: string) {
  const base = await sharp(image).resize(P.width, P.height, {fit: 'cover'}).png().toBuffer();
  const svg = `<svg width="${P.width}" height="24"><rect width="100%" height="100%" fill="#1f2328"/><text x="6" y="17" font-family="Helvetica, Arial" font-size="13" fill="#fff">${text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text></svg>`;
  return sharp({create: {width: P.width, height: P.height + 24, channels: 3, background: '#fff'}}).composite([{input: Buffer.from(svg), top: 0, left: 0}, {input: base, top: 24, left: 0}]).png().toBuffer();
}

async function main() {
  const face = arg('face')!, dir = path.join(FACES, face);
  const before = arg('before') ?? `public/canal-drive/models/ordinary-buildings/chunks/chunk-face-${face}.glb`, after = arg('after') ?? path.join(STAGING, face, 'chunk.glb');
  const out = arg('out') ?? path.join(STAGING, 'door-reveals', `${face}${process.argv.includes('--photos') ? '-photos' : ''}.png`);
  const strip = JSON.parse(await fs.readFile(path.join(dir, 'strip.json'), 'utf8')), {midRD, uRD, nRD} = strip.frame, g = strip.groundNAP as number;
  const all = await doorPositions(face), n = Number(arg('doors') ?? 3);
  const picks = arg('pands') ? all.filter(d => arg('pands')!.split(',').some(p => d.pand.endsWith(p))) : all.filter((_, i) => all.length <= n || i % Math.ceil(all.length / n) === Math.floor(Math.ceil(all.length / n) / 2)).slice(0, n);
  const toRD = (x: number, out_: number) => ({x: midRD[0] + uRD[0] * x + nRD[0] * out_, y: midRD[1] + uRD[1] * x + nRD[1] * out_});
  const rows: Buffer[] = [];
  for (const d of picks) {
    const xc = (d.x[0] + d.x[1]) / 2, door = toRD(xc, 0);
    // --date=YYYY-MM-DD|any: another capture when the strip's own day has a van in front of the door (#239).
    const date = arg('date') ?? strip.date;
    const panos = (await listPanos(door, 20)).filter((p: any) => date === 'any' || String(p.timestamp).slice(0, 10) === date);
    const views = panos.map((p: any) => { const c = lngLatToRd(p.geometry.coordinates); const along = (c.x - door.x) * uRD[0] + (c.y - door.y) * uRD[1], o = (c.x - door.x) * nRD[0] + (c.y - door.y) * nRD[1]; return {p, along, o, deg: Math.atan2(along, o) * 180 / Math.PI}; })
      .filter(v => v.o > 3 && Math.abs(v.deg) > 15 && Math.abs(v.deg) < 55).sort((a, b) => Math.abs(Math.abs(a.deg) - ANGLE) - Math.abs(Math.abs(b.deg) - ANGLE));
    const panels: Buffer[] = [];
    const tgt = {x: xc, y: d.bottom + 1.5};
    // --photos: the measurement views, the best panorama on each side of the door (both jamb returns), tighter.
    if (process.argv.includes('--photos')) {
      for (const v of [views.find(w => w.deg < 0), views.find(w => w.deg > 0)]) {
        if (!v) continue;
        const lens = lensFor(v.p, g)!, pano = (await loadPano({panoId: v.p.pano_id, record: v.p} as any))!, dist = Math.hypot(v.along, v.o);
        panels.push(await labelled(await perspective(pano.img, lens.pose, {...toRD(tgt.x, 0), z: g + tgt.y}, 2 * Math.atan(HALF / dist) * 180 / Math.PI, P.width, P.height), `${face} ${d.pand.slice(-6)} ${d.type ?? ''} ${v.deg.toFixed(0)}° ${String(v.p.timestamp).slice(0, 10)}`));
      }
      if (panels.length) rows.push(await sharp({create: {width: panels.length * (P.width + 6), height: P.height + 24, channels: 3, background: '#f4f4f2'}}).composite(panels.map((input, i) => ({input, left: i * (P.width + 6), top: 0}))).png().toBuffer());
      continue;
    }
    const cockpit: RenderView = {eye: [xc - 9, 1.3, 4.5], target: [xc, 1.4, 0], fov: 40, ...P, background: '#9fb8cf'};
    let matched: RenderView | null = null;
    if (views.length) {
      const v = views[0], lens = lensFor(v.p, g)!, pano = (await loadPano({panoId: v.p.pano_id, record: v.p} as any))!;
      const eyeH = lens.pose.z - g, dist = Math.hypot(v.along, v.o), fov = 2 * Math.atan(Number(arg("match-half") ?? 2.4) / dist) * 180 / Math.PI;
      panels.push(await labelled(await perspective(pano.img, lens.pose, {...toRD(tgt.x, 0), z: g + tgt.y}, fov, P.width, P.height), `photo ${d.pand.slice(-6)} ${v.p.pano_id.slice(-12)} ${v.deg.toFixed(0)}°`));
      matched = {eye: [xc + v.along, eyeH, v.o], target: [tgt.x, tgt.y, 0], fov, ...P, background: '#9fb8cf'};
    }
    const vs = matched ? [matched, cockpit] : [cockpit];
    // one at a time: the renderer is a single page, and two concurrent renderGlbs calls on it can stall for many minutes
    const draw = async (f: string) => (await fs.access(f).then(() => true, () => false)) ? renderModels([{file: f}], vs) : null;
    const b = await draw(before), a = await draw(after);
    if (matched) { if (b) panels.push(await labelled(b[0], `before (installed) ${d.type ?? ''}`)); if (a) panels.push(await labelled(a[0], 'after (recompiled)')); }
    if (b) panels.push(await labelled(b[vs.length - 1], 'before, cockpit'));
    if (a) panels.push(await labelled(a[vs.length - 1], 'after, cockpit'));
    const W = panels.length * (P.width + 6);
    rows.push(await sharp({create: {width: W, height: P.height + 24, channels: 3, background: '#f4f4f2'}}).composite(panels.map((input, i) => ({input, left: i * (P.width + 6), top: 0}))).png().toBuffer());
  }
  await closeRenderer();
  const W = Math.max(...await Promise.all(rows.map(async r => (await sharp(r).metadata()).width!)));
  const title = Buffer.from(`<svg width="${W}" height="30"><text x="6" y="21" font-family="Helvetica, Arial" font-size="17" font-weight="bold" fill="#1f2328">${face}: door reveals (#181), photo | before | after | cockpit before | after</text></svg>`);
  await fs.mkdir(path.dirname(out), {recursive: true});
  await sharp({create: {width: W, height: 30 + rows.length * (P.height + 30), channels: 3, background: '#fff'}}).composite([{input: title, left: 0, top: 0}, ...rows.map((input, i) => ({input, left: 0, top: 30 + i * (P.height + 30)}))]).png().toFile(out);
  console.log(`${out}: ${picks.length} doors`);
}
main().catch(e => { console.error(e); process.exit(1); });
