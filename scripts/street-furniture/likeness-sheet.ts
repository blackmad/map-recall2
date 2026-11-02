// Likeness sheets (lane #170): per spot, the data.amsterdam panorama of the same corner beside the ride's before
// (`?furniture=0`) and after frames, desktop and iPhone rows (frames from tests/e2e/street-furniture-shots.spec.ts).
//
//   npx tsx scripts/street-furniture/likeness-sheet.ts [--frames=staging/street-furniture/frames] [--out=staging/street-furniture]
import { existsSync, mkdirSync } from 'node:fs';
import sharp from 'sharp';
import { SPOTS } from '../../tests/e2e/street-furniture-spots.ts';
import { panoBytes, pickPanos } from './pano.ts';
import { perspectiveCrop } from '../street-appearance/perspective.ts';

const arg = (n: string, d: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const H = 560;

async function label(img: Buffer, text: string): Promise<Buffer> {
  const m = await sharp(img).metadata();
  const svg = Buffer.from(`<svg width="${m.width}" height="34"><rect width="${m.width}" height="34" fill="black" opacity="0.72"/><text x="10" y="23" font-size="17" font-family="Helvetica" fill="white">${text.replace(/&/g, '&amp;')}</text></svg>`);
  return sharp(img).composite([{ input: svg, top: 0, left: 0 }]).jpeg({ quality: 85 }).toBuffer();
}

async function main(): Promise<void> {
  const frames = arg('frames', 'staging/street-furniture/frames'), out = arg('out', 'staging/street-furniture');
  mkdirSync(out, { recursive: true });
  for (const spot of SPOTS) {
    const [lng, lat] = spot.object;
    const pick = (await pickPanos(lng, lat, 2, 16)).find(p => p.panoId === spot.pano);
    if (!pick) { console.log(`${spot.name}: panorama ${spot.pano} not found`); continue; }
    const rows: Buffer[] = [];
    for (const project of ['desktop', 'iphone']) {
      const files = ['before', 'after'].map(v => `${frames}/${spot.name}-${v}-${project}.png`);
      if (!files.every(existsSync)) continue;
      const meta = await sharp(files[0]).metadata(), aspect = (meta.width ?? 1) / (meta.height ?? 1);
      const pw = Math.round(H * aspect), ph = H;
      const pano = await label(await sharp(perspectiveCrop(await panoBytes(pick), pick.bearingDeg, Math.round(900 * aspect), 900, project === 'iphone' ? 60 : 75, -6)).resize(pw, ph).jpeg().toBuffer(), `panorama ${pick.panoId} (${pick.timestamp.slice(0, 10)}), CC BY 4.0`);
      const shots = await Promise.all(files.map(async (f, i) => label(await sharp(f).resize(pw, ph).jpeg().toBuffer(), `${project} ${i ? 'after: street furniture' : 'before: ?furniture=0'}`)));
      rows.push(await sharp({ create: { width: pw * 3 + 8, height: ph, channels: 3, background: '#111' } }).composite([pano, ...shots].map((input, i) => ({ input, left: i * (pw + 4), top: 0 }))).jpeg().toBuffer());
    }
    if (!rows.length) { console.log(`${spot.name}: no frames`); continue; }
    const metas = await Promise.all(rows.map(r => sharp(r).metadata()));
    const W = Math.max(...metas.map(m => m.width ?? 0)), Ht = metas.reduce((s, m) => s + (m.height ?? 0) + 4, 0);
    let y = 0; const comp = rows.map((input, i) => { const c = { input, left: 0, top: y }; y += (metas[i].height ?? 0) + 4; return c; });
    const file = `${out}/sheet-${spot.name}.jpg`;
    await sharp({ create: { width: W, height: Ht, channels: 3, background: '#111' } }).composite(comp).jpeg({ quality: 84 }).toFile(file);
    console.log(`wrote ${file}`);
  }
}
void main();
