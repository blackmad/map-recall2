/**
 * Facade benchmark (lane F4, #379): labelling sheets from a house:frames prep run. Each tile is the pose photo, cropped as
 * the critic's pair is (house:frames cropBox) with the cyan wall outline, captioned with the key, address, BAG year and
 * capture; two tiles a sheet, per group. Readers label from these (labels.md), never from the game half.
 *
 *   node --import tsx scripts/house-line/benchmark/label-sheets.ts --frames artifacts/critic/frames-round-0 [--out artifacts/critic/label-sheets] [--keys keys.json]
 *   (--keys: only those pands, e.g. the poses a re-pick changed, which must be read again)
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { cropBox, outlineSvg } from '../../house-frames/frames.ts';
import { BENCHMARK_FILE } from './build.ts';

const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const T = 760;

if (import.meta.url === `file://${process.argv[1]}`) {
  const frames = path.resolve(arg('frames') ?? 'artifacts/critic/frames-round-0'), out = path.resolve(arg('out') ?? 'artifacts/critic/label-sheets');
  const { prepared, skipped } = JSON.parse(fs.readFileSync(path.join(frames, 'prepared.json'), 'utf8'));
  const bench = JSON.parse(fs.readFileSync(BENCHMARK_FILE, 'utf8'));
  const only = arg('keys') ? new Set<string>(JSON.parse(fs.readFileSync(arg('keys')!, 'utf8'))) : null;
  const prep = new Map<string, any>(prepared.filter((p: any) => !only || only.has(p.key)).map((p: any) => [p.key, p]));
  fs.mkdirSync(out, { recursive: true });
  const index: Record<string, Array<{ sheet: string; keys: string[] }>> = {};
  for (const g of bench.groups) {
    const pands = bench.pands.filter((p: any) => p.group === g.id && prep.has(p.key));
    for (let s = 0; s * 2 < pands.length; s++) {
      const two = pands.slice(s * 2, s * 2 + 2), tiles: Buffer[] = [];
      for (const p of two) {
        const r = prep.get(p.key), box = cropBox(r.pose, r.wall);
        const base = await sharp(path.join(frames, p.key, 'photo.jpg')).resize(r.pose.width, r.pose.height, { fit: 'fill' }).composite([{ input: Buffer.from(outlineSvg(r.pose, r.wall)) }]).png().toBuffer();
        const img = await sharp(base).extract(box).resize(T, T, { fit: 'contain', background: '#1d1d1d' }).png().toBuffer();
        const cap = `${p.key}  ${p.addresses.slice(0, 3).join(', ')}${p.addresses.length > 3 ? ' …' : ''}  |  BAG ${p.buildYear}  |  ${String(r.pick.timestamp).slice(0, 10)} ${r.pick.distM.toFixed(0)} m obl ${r.pick.obliquityDeg.toFixed(0)}°`;
        tiles.push(await sharp({ create: { width: T, height: T + 30, channels: 3, background: '#111' } }).composite([{ input: img, left: 0, top: 30 }, { input: Buffer.from(`<svg width="${T}" height="30" xmlns="http://www.w3.org/2000/svg"><text x="6" y="20" font-family="Helvetica, Arial" font-size="13" fill="#fff">${esc(cap)}</text></svg>`), left: 0, top: 0 }]).png().toBuffer());
      }
      const file = path.join(out, `${g.id}-${String(s + 1).padStart(2, '0')}.jpg`);
      await sharp({ create: { width: T * 2 + 10, height: T + 30, channels: 3, background: '#000' } }).composite(tiles.map((t, i) => ({ input: t, left: i * (T + 10), top: 0 }))).jpeg({ quality: 85 }).toFile(file);
      (index[g.id] ??= []).push({ sheet: file, keys: two.map((p: any) => p.key) });
    }
  }
  fs.writeFileSync(path.join(out, 'index.json'), JSON.stringify({ frames, skipped, index }, null, 1));
  console.log(Object.entries(index).map(([g, l]) => `${g}: ${l.length} sheets`).join('\n') + `\nskipped (no pose): ${skipped.length}`);
}
