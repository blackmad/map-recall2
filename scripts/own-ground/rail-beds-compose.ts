// Compose the rail-beds strips (lane R3-C #232) from rail-beds-strip.mjs frames: per spot, the PDOK orthophoto (north
// up, 700 m wide round the view centre), the user's shot when the spot has one, main and after at the same pose, then a
// row of 1:1 device-pixel crops of main and after around the spot's crop point. JPEG, 1600 px wide, quality 82.
//   node --import tsx scripts/own-ground/rail-beds-compose.ts <framesDir> <device> <spot[,spot]> <out.jpg> [main] [after]
import sharp from 'sharp';
import { existsSync } from 'node:fs';
import { CRISP_SPOTS } from '../look/crispSpots.ts';
import { OrthoTiles, ORTHO_ATTRIBUTION } from './ortho.ts';
import { toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';

const [dir, device, spotArg, out, mainName = 'main', afterName = 'after'] = process.argv.slice(2);
const SHOTS = process.env.USER_SHOTS ?? '/Users/blackmad/Code/map-recall2-screenshots/engine/2026-11-06-user-shots';
const W = 1600, COL = 4, CW = Math.floor(W / COL), GAP = 0;
const label = (w: number, h: number, t: string, size = 15) => Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#222"/><text x="8" y="${Math.round(h / 2 + size / 3)}" font-family="Helvetica" font-size="${size}" fill="#fff">${t.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text></svg>`);
const ortho = new OrthoTiles();
const parts: sharp.OverlayOptions[] = [];
let top = 0;
for (const name of spotArg.split(',')) {
  const spot = CRISP_SPOTS.find(s => s.name === name);
  if (!spot) throw new Error(`unknown spot ${name}`);
  const main = `${dir}/${device}-${name}-${mainName}.png`, after = `${dir}/${device}-${name}-${afterName}.png`;
  const meta = await sharp(after).metadata(), aspect = (meta.height ?? 1) / (meta.width ?? 1), CH = Math.round(CW * aspect);
  parts.push({ input: label(W, 26, `${device} · ${name} [${spot.center.join(', ')}] z${spot.zoom} bearing ${spot.bearing} pitch ${spot.pitch ?? 'chase'} · orthophoto | user shot | ${mainName} | ${afterName}`, 14), left: 0, top });
  top += 26;
  const [x, y] = toLocal(spot.center[0], spot.center[1]), res = 700 / CW;
  const crop = await ortho.crop(x - CW * res / 2, y - CH * res / 2, CW, CH, res).catch(() => null);
  parts.push({ input: crop ? await sharp(Buffer.from(crop), { raw: { width: CW, height: CH, channels: 3 } }).png().toBuffer() : label(CW, CH, 'no orthophoto'), left: 0, top });
  const shot = spot.shot ? `${SHOTS}/${spot.shot}` : '';
  parts.push({ input: shot && existsSync(shot) ? await sharp(shot).resize(CW, CH, { fit: 'cover' }).png().toBuffer() : label(CW, CH, 'no user shot'), left: CW, top });
  parts.push({ input: await sharp(main).resize(CW, CH).png().toBuffer(), left: 2 * CW, top });
  parts.push({ input: await sharp(after).resize(CW, CH).png().toBuffer(), left: 3 * CW, top });
  top += CH + GAP;
  // 1:1 crops (device px) around the spot's crop point: main | after.
  const cw = W / 2, chh = 300, c = spot.crop ?? { x: (spot.band.x0 + spot.band.x1) / 2, y: (spot.band.y0 + spot.band.y1) / 2 };
  for (const [i, f] of [main, after].entries()) {
    const m = await sharp(f).metadata(), left = Math.max(0, Math.min((m.width ?? 0) - cw, Math.round(c.x * (m.width ?? 0) - cw / 2))), t = Math.max(0, Math.min((m.height ?? 0) - chh, Math.round(c.y * (m.height ?? 0) - chh / 2)));
    parts.push({ input: await sharp(f).extract({ left, top: t, width: cw, height: chh }).png().toBuffer(), left: i * cw, top });
  }
  top += chh + 6;
}
parts.push({ input: label(W, 22, `orthophoto ${ORTHO_ATTRIBUTION} · frames: scripts/own-ground/rail-beds-strip.mjs (the user's path: rider at the Amstel, camera panned to the spot)`, 12), left: 0, top });
top += 22;
await sharp({ create: { width: W, height: top, channels: 3, background: '#222' } }).composite(parts).jpeg({ quality: 82 }).toFile(out);
console.log(`wrote ${out} (${W}x${top})`);
