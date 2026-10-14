/**
 * Ride-camera before/after sheet for measured glass: two live-play-shots.mjs runs (same places, chase view) side by
 * side, each row a place, with a 2x crop of the building under it so the panes read at gallery size.
 *
 *   PORT=4522 MODE=car node scripts/live-play-shots.mjs <before> "?" waag=4.92670,52.37553,61 houthaven=4.87604,52.39481,180
 *   (rebuild the bundles, then the same into <after>)
 *   node --import tsx scripts/look/measured-glass-ride-sheet.ts --before=<dir> --after=<dir> [--jpg=docs/images/look/measured-glass-ride.jpg]
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const before = arg('before')!, after = arg('after')!, jpg = arg('jpg') ?? 'docs/images/look/measured-glass-ride.jpg';
/** Places: shot name, label, crop of the building in the 1280x800 frame. */
const PLACES = [
  {name: 'waag', label: 'Waagdragerhof 198 tower (kit glass, unmeasured since the reconcile)', crop: {left: 470, top: 40, width: 460, height: 300}},
  {name: 'houthaven', label: 'Houthavenkade 26 north front (measured column glass #8e9ea4)', crop: {left: 400, top: 120, width: 420, height: 190}},
];
const W = 760, FH = Math.round(800 * W / 1280), ZH = 300, HEAD = 26, GAP = 8, TITLE = 34;
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const bar = (w: number, text: string) => Buffer.from(`<svg width="${w}" height="${HEAD}"><rect width="100%" height="${HEAD}" fill="#1f2328"/><text x="8" y="18" font-family="Helvetica, Arial" font-size="14" fill="#fff">${esc(text)}</text></svg>`);

async function cell(file: string, crop: {left: number; top: number; width: number; height: number}, title: string) {
  const frame = await sharp(file).resize(W).png().toBuffer();
  const zoom = await sharp(file).extract(crop).resize(W, ZH, {fit: 'contain', background: '#f4f4f2'}).png().toBuffer();
  return sharp({create: {width: W, height: HEAD + FH + ZH + 4, channels: 3, background: '#f4f4f2'}})
    .composite([{input: bar(W, title), top: 0, left: 0}, {input: frame, top: HEAD, left: 0}, {input: zoom, top: HEAD + FH + 4, left: 0}]).png().toBuffer();
}
const rowH = HEAD + FH + ZH + 4, rw = 2 * W + GAP, total = TITLE + PLACES.length * (rowH + GAP);
const parts: sharp.OverlayOptions[] = [{input: Buffer.from(`<svg width="${rw}" height="${TITLE}"><text x="8" y="23" font-family="Helvetica, Arial" font-size="18" font-weight="bold" fill="#1f2328">Measured glass from the ride camera (chase view, own ground): before | glass keeps the sky</text></svg>`), top: 0, left: 0}];
for (const [i, p] of PLACES.entries()) {
  const top = TITLE + i * (rowH + GAP);
  parts.push({input: await cell(path.join(before, `${p.name}.png`), p.crop, `before: ${p.label}`), top, left: 0});
  parts.push({input: await cell(path.join(after, `${p.name}.png`), p.crop, `glass keeps the sky: ${p.label}`), top, left: W + GAP});
}
let q = 82;
const png = await sharp({create: {width: rw, height: total, channels: 3, background: '#f4f4f2'}}).composite(parts).png().toBuffer();
let buf = await sharp(png).jpeg({quality: q, mozjpeg: true}).toBuffer();
while (buf.length > 350_000 && q > 40) { q -= 6; buf = await sharp(png).jpeg({quality: q, mozjpeg: true}).toBuffer(); }
await fs.mkdir(path.dirname(jpg), {recursive: true});
await fs.writeFile(jpg, buf);
console.log(jpg, `${Math.round(buf.length / 1024)} KB`);
