// The rail-look round-3 strip (lane rail-look 2026-10-31): per place, photo (PDOK orthophoto or a data.amsterdam.nl
// panorama) | before (main) | after (lane) | the player's screenshot where there is one. The views are rail-view.ts's
// offline renders (flat colours, no textures; buildings as plain extrusions), not game frames.
//
//   npx tsx scripts/own-ground/rail-strip-r3.ts [--out=artifacts/rail-look/strip-rail-look-r3.jpg]
import { existsSync } from 'node:fs';
import sharp from 'sharp';
import { toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { OrthoTiles, ORTHO_ATTRIBUTION } from './ortho.ts';

const OUT = process.argv.find(a => a.startsWith('--out='))?.slice(6) ?? 'artifacts/rail-look/strip-rail-look-r3.jpg';
const D = 'artifacts/rail-look/r3';
const ROWS: { label: string; at: [number, number]; photo?: string; before: string; after: string; shot?: string }[] = [
  { label: 'Oostertoegang: rail decks get through girders over water, piers off the road', at: [4.9036, 52.3772], before: `${D}/ooster-main.png`, after: `${D}/ooster-r3.png`, shot: 'artifacts/rail-look/5d5b56c4-6799-4ccd-87ef-6caf47824cd4.jpg' },
  { label: 'Centraal shed: tracks at the platforms\' level (+5), platforms drawn', at: [4.9000, 52.3788], before: `${D}/centraal-main.png`, after: `${D}/centraal-r3.png` },
  { label: 'Osdorp tram deck (was unanchored: 2.4 m OSM gap, now snapped)', at: [4.79876, 52.35791], before: `${D}/deck1-main.png`, after: `${D}/deck1-r3.png` },
  { label: 'Osdorp tram deck (was unanchored: no approach, now spans its ends)', at: [4.80242, 52.35256], before: `${D}/deck2-main.png`, after: `${D}/deck2-r3.png` },
  { label: 'Amstel: the flat white slab becomes canopies over the platforms', at: [4.9175, 52.3466], photo: `${D}/infra-amstel.png`, before: `${D}/amstel-a1-before.png`, after: `${D}/amstel-a1-after.png`, shot: 'artifacts/rail-look/user-amstel-flat-white.png' },
  { label: 'Amstel: the station pand and pavilions under the tracks are no longer houses', at: [4.9171, 52.3474], photo: 'artifacts/rail-look/photos/amstel-canopy-e.jpg', before: `${D}/amstel-a2-before.png`, after: `${D}/amstel-a2-after.png`, shot: 'artifacts/rail-look/user-amstel-houses-under-tracks.png' },
];
const W = 560, H = 315, GAP = 6, HEAD = 26;
const text = (w: number, h: number, t: string, size = 15) => Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#222"/><text x="8" y="${Math.round(h / 2 + size / 3)}" font-family="Helvetica" font-size="${size}" fill="#fff">${t.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text></svg>`);
const fit = (f: string) => sharp(f).resize(W, H, { fit: 'cover' }).png().toBuffer();

const o = new OrthoTiles(), total = { w: 4 * W + 3 * GAP, h: 34 + ROWS.length * (HEAD + H + GAP) };
const parts: sharp.OverlayOptions[] = [{ input: text(total.w, 34, `rail look round 3: photo | before (main) | after (lane) | player screenshot · offline renders, not game frames · ${ORTHO_ATTRIBUTION}; panoramas data.amsterdam.nl`), left: 0, top: 0 }];
let top = 34;
for (const r of ROWS) {
  parts.push({ input: text(total.w, HEAD, r.label), left: 0, top }); top += HEAD;
  let photo: Buffer;
  if (r.photo && existsSync(r.photo)) photo = await fit(r.photo);
  else { const [x, y] = toLocal(r.at[0], r.at[1]), half = 110, res = (2 * half) / H, crop = await o.crop(x - half * W / H, y - half, W, H, res); photo = await sharp(Buffer.from(crop), { raw: { width: W, height: H, channels: 3 } }).png().toBuffer(); }
  const cols = [photo, await fit(r.before), await fit(r.after), r.shot && existsSync(r.shot) ? await fit(r.shot) : await sharp(text(W, H, 'no player screenshot')).png().toBuffer()];
  cols.forEach((input, i) => parts.push({ input, left: i * (W + GAP), top }));
  top += H + GAP;
}
await sharp({ create: { width: total.w, height: total.h, channels: 3, background: '#111' } }).composite(parts).jpeg({ quality: 84 }).toFile(OUT);
console.log(JSON.stringify({ out: OUT, size: [total.w, total.h] }));
