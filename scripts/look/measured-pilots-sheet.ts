/**
 * Before/after sheet of the measured pilots in game tints, beside the photo: one row per pilot wall,
 *   photo | old sheet column (raw GLB colours x trial tiles) | game before | game after,
 * with the measured materials' rendered RGB (÷ the facing's baked shade) against their authored hex under each image.
 * Reads two measured-walls.ts runs (labels), e.g. a `before` run on the parent commit and an `after` run:
 *
 *   node --import tsx scripts/look/measured-pilots-sheet.ts --before=before --before-raw=before-raw --after=after \
 *     [--dir=artifacts/look/measured-walls] [--out=artifacts/look/measured-pilots.png] [--jpg=docs/images/look/measured-pilots.jpg]
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {PILOTS, type Row} from './measured-walls.ts';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const dir = arg('dir') ?? 'artifacts/look/measured-walls', out = arg('out') ?? 'artifacts/look/measured-pilots.png', jpg = arg('jpg') ?? 'docs/images/look/measured-pilots.jpg';
const load = async (label: string) => JSON.parse(await fs.readFile(path.join(dir, `${label}.json`), 'utf8')) as {rows: Row[]; images: Record<string, string>};
const before = await load(arg('before') ?? 'before'), beforeRaw = await load(arg('before-raw') ?? arg('before') ?? 'before'), after = await load(arg('after') ?? 'after');

const W = 420, H = 294, CAP = 58, GAP = 6, TITLE = 30;
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const hex = (rgb: number[]) => '#' + rgb.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

async function panel(image: Buffer, title: string, lines: {text: string; swatch?: string; authored?: string}[]) {
  const pic = await sharp(image).resize(W, H, {fit: 'contain', background: '#ffffff'}).png().toBuffer();
  const head = `<svg width="${W}" height="24"><rect width="100%" height="24" fill="#1f2328"/><text x="8" y="17" font-family="Helvetica, Arial" font-size="13" fill="#fff">${esc(title)}</text></svg>`;
  const caption = `<svg width="${W}" height="${CAP}">${
    lines.map((l, i) => `${l.authored ? `<rect x="8" y="${4 + i * 14}" width="10" height="10" fill="${l.authored}"/>` : ''}${l.swatch ? `<rect x="20" y="${4 + i * 14}" width="10" height="10" fill="${l.swatch}"/>` : ''}<text x="36" y="${13 + i * 14}" font-family="Helvetica, Arial" font-size="11" fill="#1f2328">${esc(l.text)}</text>`).join('')}</svg>`;
  return sharp({create: {width: W, height: H + CAP + 24, channels: 3, background: '#ffffff'}}).composite([{input: Buffer.from(head), top: 0, left: 0}, {input: pic, top: 24, left: 0}, {input: Buffer.from(caption), top: 24 + H, left: 0}]).png().toBuffer();
}
const linesOf = (rows: Row[], k: number, p: string) => rows.filter(r => r.path === p && PILOTS[k].id === r.pilot && r.groups.join() === PILOTS[k].groups.join())
  .map(r => ({authored: r.authored, swatch: hex(r.unshaded), text: `${r.role} ${r.authored} → ${r.unshaded.join(',')} (ΔL ${r.dL >= 0 ? '+' : ''}${r.dL.toFixed(2)})`}));

const rows: Buffer[] = [];
for (const [k, pl] of PILOTS.entries()) {
  let photo = sharp(await fs.readFile(pl.photo));
  if (pl.crop) photo = photo.extract(pl.crop);
  const panels = await Promise.all([
    panel(await photo.png().toBuffer(), `photo ${path.basename(pl.photo)} (panorama, CC BY 4.0)`, [{text: `${pl.id} walls[${pl.groups.join(',')}]`}]),
    panel(await fs.readFile(beforeRaw.images[`${k}-raw`]), 'old sheet column: raw GLB colours (not the game)', linesOf(beforeRaw.rows, k, 'raw')),
    panel(await fs.readFile(before.images[`${k}-city`]), 'game before (city look)', linesOf(before.rows, k, 'city')),
    panel(await fs.readFile(after.images[`${k}-city`]), 'game after (city look)', linesOf(after.rows, k, 'city')),
  ]);
  const rw = panels.length * W + (panels.length - 1) * GAP, rh = H + CAP + 24;
  rows.push(await sharp({create: {width: rw, height: rh, channels: 3, background: '#f4f4f2'}}).composite(panels.map((input, i) => ({input, left: i * (W + GAP), top: 0}))).png().toBuffer());
}
const rw = 4 * W + 3 * GAP, rh = H + CAP + 24, total = TITLE + rows.length * (rh + GAP);
const title = `<svg width="${rw}" height="${TITLE}"><text x="8" y="21" font-family="Helvetica, Arial" font-size="17" font-weight="bold" fill="#1f2328">Measured pilots in game tints (swatches: authored | rendered ÷ baked shade)</text></svg>`;
await fs.mkdir(path.dirname(out), {recursive: true});
await sharp({create: {width: rw, height: total, channels: 3, background: '#f4f4f2'}})
  .composite([{input: Buffer.from(title), top: 0, left: 0}, ...rows.map((input, i) => ({input, left: 0, top: TITLE + i * (rh + GAP)}))]).png().toFile(out);
await fs.mkdir(path.dirname(jpg), {recursive: true});
let q = 82, buf = await sharp(out).jpeg({quality: q, mozjpeg: true}).toBuffer();
while (buf.length > 300_000 && q > 40) { q -= 6; buf = await sharp(out).resize({width: Math.round(rw * (q < 60 ? 0.8 : 1))}).jpeg({quality: q, mozjpeg: true}).toBuffer(); }
await fs.writeFile(jpg, buf);
console.log(out, jpg, `${Math.round(buf.length / 1024)} KB`);
