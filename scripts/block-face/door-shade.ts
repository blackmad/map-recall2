/**
 * Door reveal shading from oblique panoramas (#239, Part 1 item 1): how much darker a reveal's jamb is toward the leaf.
 * The door region is rectified onto the facade plane (depth 0) from the best panorama on each side of the door; there a
 * jamb `deep` metres long, seen at view angle θ, covers `deep · tan θ` of the plane beside the door edge on the side away
 * from the camera (mouth at the door edge, back at the leaf). Its luma, sampled in bands from mouth to back, is divided by
 * the wall beside the door at the same heights: the profile the kit's lining shade (canalhouseOpeningRecess.ts `shade`)
 * reproduces. The rows of the white frame at the back (`deep` - 0.135 .. `deep`) are left out.
 *
 *   node --import tsx scripts/block-face/door-shade.ts --face=burger-45-131-r1 --x=-5.54,-4.19 --deep=0.45 [--z=0.4,2.0] [--date=YYYY-MM-DD|any] [--bands=4]
 *
 * Writes staging/block-face/door-shade/<face>@<x>.{json,png} (each view's depth-0 rectification with the jamb strip marked).
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
const PPM = 200, FRAME_M = 0.135;

/** Mean Rec. 601 luma of the columns [c0, c1) and rows [r0, r1) of an RGBA raster, skipping transparent (unsampled) pixels. */
export function meanLuma(rgba: Uint8ClampedArray | Uint8Array, w: number, c0: number, c1: number, r0: number, r1: number): number {
  let s = 0, n = 0;
  for (let y = r0; y < r1; y++) for (let x = Math.max(0, c0); x < Math.min(w, c1); x++) {
    const i = (y * w + x) * 4; if (rgba[i + 3] === 0) continue;
    s += 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2]; n++;
  }
  return n ? s / n : NaN;
}

async function main() {
  const face = arg('face')!, [xa, xb] = pair(arg('x'), [0, 0]), [z0, z1] = pair(arg('z'), [0.4, 2.0]), deep = Number(arg('deep')), bands = Number(arg('bands') ?? 4);
  if (!(deep > 0.15)) throw Error('--deep: the reveal depth (m) the shade is measured over');
  const strip = JSON.parse(await fs.readFile(path.join(FACES, face, 'strip.json'), 'utf8'));
  const {midRD, uRD, nRD} = strip.frame, g = strip.groundNAP as number, date = arg('date') ?? strip.date;
  const at = (x: number) => ({x: midRD[0] + uRD[0] * x, y: midRD[1] + uRD[1] * x});
  const mid = at((xa + xb) / 2);
  const views = (await listPanos(mid, 25)).filter((p: any) => String(p.timestamp).slice(0, 10) === date || arg('date') === 'any')
    .map((p: any) => { const c = lngLatToRd(p.geometry.coordinates); const dx = c.x - mid.x, dy = c.y - mid.y; const along = dx * uRD[0] + dy * uRD[1], out = dx * nRD[0] + dy * nRD[1]; return {p, out, deg: Math.atan2(along, out) * 180 / Math.PI}; })
    .filter(v => v.out > 3 && v.out < 25 && Math.abs(v.deg) > 18 && Math.abs(v.deg) < 60)
    .sort((a, b) => Math.abs(Math.abs(a.deg) - 35) - Math.abs(Math.abs(b.deg) - 35));
  const picks = [views.find(v => v.deg < 0), views.find(v => v.deg > 0)].filter(Boolean) as typeof views;
  if (!picks.length) throw Error(`${face}: no oblique panorama of the door on ${date}`);
  const pad = 0.45, out = path.join(STAGING, 'door-shade'), name = `${face}@${xa.toFixed(2)}`;
  await fs.mkdir(out, {recursive: true});
  const report: any[] = [], tiles: Buffer[] = [];
  for (const v of picks) {
    const pano = (await loadPano({panoId: v.p.pano_id, record: v.p} as any))!.img, lens = lensFor(v.p, g)!;
    const r = rectifyFacade(pano as any, {...lens.pose, headingDeg: 0, pitchDeg: 0, rollDeg: 0}, {start: at(xa - pad), end: at(xb + pad), baseZ: g + z0, topZ: g + z1}, {pixelsPerMetre: PPM, camera: AMSTERDAM_WORLD_ALIGNED});
    const col = (x: number) => Math.round((x - (xa - pad)) * PPM), tan = Math.tan(Math.abs(v.deg) * Math.PI / 180);
    // Camera on +u (deg > 0) sees the jamb at xa, spread toward +u; on -u the jamb at xb, spread toward -u.
    // --edges=a,b: the opening's edges read off this sheet's 10 cm ticks when the kit's door x is off the photo's door.
    const [ea, eb] = pair(arg('edges'), [xa, xb]);
    const sign = v.deg > 0 ? 1 : -1, edge = v.deg > 0 ? ea : eb, visible = arg(v.deg > 0 ? "visible-right" : "visible-left") ? Number(arg(v.deg > 0 ? "visible-right" : "visible-left")) : (deep - FRAME_M) * tan;
    const wall = meanLuma(r.data, r.width, sign > 0 ? col(edge - 0.3) : col(edge + 0.06), sign > 0 ? col(edge - 0.06) : col(edge + 0.3), 0, r.height);
    const profile: number[] = [];
    for (let k = 0; k < bands; k++) {
      const a = edge + sign * visible * k / bands, b = edge + sign * visible * (k + 1) / bands;
      profile.push(+(meanLuma(r.data, r.width, col(Math.min(a, b)), col(Math.max(a, b)), 0, r.height) / wall).toFixed(3));
    }
    report.push({panoId: v.p.pano_id, deg: +v.deg.toFixed(1), distM: +v.out.toFixed(1), jambAt: edge, visibleM: +visible.toFixed(3), wallLuma: +wall.toFixed(1), profile});
    // Sheet tile: the rectification with the jamb strip outlined in red.
    const x0 = col(Math.min(edge, edge + sign * visible)), x1 = col(Math.max(edge, edge + sign * visible));
    const ticks = Array.from({length: Math.floor((xb - xa + 2 * pad) * 10) + 1}, (_, i) => { const x = Math.ceil((xa - pad) * 10) / 10 + i / 10, c = col(x); return `<line x1="${c}" y1="0" x2="${c}" y2="${Math.round(x * 10) % 5 === 0 ? 24 : 10}" stroke="yellow" stroke-width="1"/>${Math.round(x * 10) % 5 === 0 ? `<text x="${c + 2}" y="36" font-size="11" fill="yellow">${x.toFixed(1)}</text>` : ''}`; }).join('');
    const svg = `<svg width="${r.width}" height="${r.height}">${ticks}<rect x="${x0}" y="1" width="${Math.max(1, x1 - x0)}" height="${r.height - 2}" fill="none" stroke="red" stroke-width="2"/></svg>`;
    tiles.push(await sharp(Buffer.from(r.data), {raw: {width: r.width, height: r.height, channels: 4}}).composite([{input: Buffer.from(svg)}]).png().toBuffer());
  }
  const metas = await Promise.all(tiles.map(t => sharp(t).metadata()));
  const W = metas.reduce((s, m) => s + m.width! + 10, 0), H = Math.max(...metas.map(m => m.height!));
  let left = 0;
  await sharp({create: {width: W, height: H, channels: 3, background: '#fff'}}).composite(tiles.map((input, i) => { const o = {input, left, top: 0}; left += metas[i].width! + 10; return o; })).png().toFile(path.join(out, `${name}.png`));
  await fs.writeFile(path.join(out, `${name}.json`), JSON.stringify({face, x: [xa, xb], deep, date, bands, views: report}, null, 1));
  console.log(`${face} x ${xa}..${xb} deep ${deep}: ${report.map(r => `${r.deg}° jamb/wall ${r.profile.join(' ')}`).join(' | ')}; ${path.join(out, name)}.png`);
}
if (process.argv[1]?.endsWith('door-shade.ts')) main().catch(e => { console.error(e); process.exit(1); });
