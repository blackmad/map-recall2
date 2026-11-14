/**
 * Market likeness sheets (lane markets-20261114): photo | today | with the market, per pose of
 * tests/e2e/market-poses.ts, from the frames tests/e2e/market-frames.spec.ts wrote. The photo is the market-day
 * panorama (Gemeente Amsterdam, CC BY 4.0) cut to the game's pose: 72 deg vertical FOV at 1440x900 (98.6 deg
 * horizontal), 5 deg down. Ride sheets are today | with the market.
 *
 *   node --import tsx scripts/markets/frames-sheet.ts [--frames artifacts/markets/frames]
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { perspectiveCrop } from '../street-appearance/perspective.ts';
import { MARKET_POSES, MARKET_RIDES } from '../../tests/e2e/market-poses.ts';

const sharp = createRequire(import.meta.url)('sharp');
const UA = 'map-recall2 market frames (+https://github.com/blackmad/map-recall2)';
const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const FRAMES = arg('frames') ?? 'artifacts/markets/frames';
const PANOS = 'artifacts/markets/panos';
const W = 1440, H = 900, VFOV = 72, PW = 960, PH = 600;
const HFOV = 2 * Math.atan(Math.tan(VFOV * Math.PI / 360) * W / H) * 180 / Math.PI;

async function pano(id: string): Promise<Buffer> {
  const file = path.join(PANOS, `${id}.jpg`);
  if (!fs.existsSync(file)) {
    const meta: any = await (await fetch(`https://api.data.amsterdam.nl/panorama/panoramas/${id}/`, { headers: { 'User-Agent': UA } })).json();
    const r = await fetch(meta._links.equirectangular_medium.href, { headers: { 'User-Agent': UA } });
    fs.mkdirSync(PANOS, { recursive: true }); fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
  }
  return fs.readFileSync(file);
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
async function panel(input: Buffer | string, label: string): Promise<Buffer> {
  const img = await sharp(input).resize(PW, PH, { fit: 'fill' }).toBuffer();
  const svg = `<svg width="${PW}" height="34"><rect width="100%" height="100%" fill="#111"/><text x="10" y="23" font-family="Helvetica" font-size="18" fill="#fff">${esc(label)}</text></svg>`;
  return sharp({ create: { width: PW, height: PH + 34, channels: 3, background: '#111' } }).composite([{ input: Buffer.from(svg), top: 0, left: 0 }, { input: img, top: 34, left: 0 }]).png().toBuffer();
}
async function sheet(panels: Buffer[], caption: string, out: string): Promise<void> {
  const svg = `<svg width="${PW * panels.length}" height="40"><rect width="100%" height="100%" fill="#222"/><text x="10" y="26" font-family="Helvetica" font-size="17" fill="#ddd">${esc(caption)}</text></svg>`;
  await sharp({ create: { width: PW * panels.length, height: PH + 34 + 40, channels: 3, background: '#000' } })
    .composite([...panels.map((p, i) => ({ input: p, top: 0, left: i * PW })), { input: Buffer.from(svg), top: PH + 34, left: 0 }])
    .jpeg({ quality: 86 }).toFile(out);
}

async function main(): Promise<void> {
  const made: string[] = [];
  for (const p of MARKET_POSES) {
    const dir = path.join(FRAMES, p.key);
    if (!fs.existsSync(path.join(dir, 'markets.png')) || !fs.existsSync(path.join(dir, 'today.png'))) { console.warn(`${p.key}: frames missing`); continue; }
    const photo = perspectiveCrop(await pano(p.pano), p.headingDeg, W, H, HFOV, -(p.lookDownDeg ?? 5));
    fs.writeFileSync(path.join(dir, 'photo.jpg'), photo);
    const meta = JSON.parse(fs.readFileSync(path.join(dir, 'markets.json'), 'utf8'));
    const out = path.join(dir, 'sheet.jpg');
    await sheet([await panel(photo, `photo ${p.pano.slice(0, 28)}`), await panel(path.join(dir, 'today.png'), 'today (?markets=0)'), await panel(path.join(dir, 'markets.png'), 'with the market (?markets=1)')],
      `${p.key}: ${p.note} | first person, vfov 72, 1440x900 DPR 2, own engine, default world-v1 | markets draws ${meta.debug?.draws} tris ${meta.debug?.triangles}`, out);
    made.push(out);
  }
  for (const r of MARKET_RIDES) {
    const dir = path.join(FRAMES, r.key);
    if (!fs.existsSync(path.join(dir, 'markets.png'))) continue;
    const meta = JSON.parse(fs.readFileSync(path.join(dir, 'markets.json'), 'utf8'));
    const out = path.join(dir, 'sheet.jpg');
    await sheet([await panel(path.join(dir, 'today.png'), 'today (?markets=0)'), await panel(path.join(dir, 'markets.png'), 'with the market (?markets=1)')],
      `${r.key}: ${r.note} | as played: default chase camera, DPR 2, own engine | draws ${meta.debug?.draws} tris ${meta.debug?.triangles}`, out);
    made.push(out);
  }
  console.log(made.join('\n'));
}

void main();
