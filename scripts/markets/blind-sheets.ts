/**
 * Blind A/B sheets for the market frames (lane market-stalls-20261120): per pose, photo | A | B where A and B are
 * today (?markets=0) and with the market (?markets=1) in a side order drawn from a seeded hash of the pose key, so a
 * judge cannot learn the side. Writes <frames>/blind/<n>.jpg (numbered, no key names on the sheet) and
 * <frames>/blind/key.json (sheet -> pose, which side is the market). Run after scripts/markets/frames-sheet.ts (it cuts
 * the photos).
 *
 *   node --import tsx scripts/markets/blind-sheets.ts [--frames=artifacts/markets/frames] [--only=key,key] [--seed=s]
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { hash01 } from '../../src/canalRecall/markets/placer.ts';
import { MARKET_POSES } from '../../tests/e2e/market-poses.ts';

const sharp = createRequire(import.meta.url)('sharp');
const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const FRAMES = arg('frames') ?? 'artifacts/markets/frames', only = arg('only')?.split(','), seed = arg('seed') ?? 'market-stalls-20261120';
const PW = 960, PH = 600;

async function panel(input: Buffer | string, label: string): Promise<Buffer> {
  const img = await sharp(input).resize(PW, PH, { fit: 'fill' }).toBuffer();
  const svg = `<svg width="${PW}" height="40"><rect width="100%" height="100%" fill="#111"/><text x="12" y="28" font-family="Helvetica" font-size="24" fill="#fff">${label}</text></svg>`;
  return sharp({ create: { width: PW, height: PH + 40, channels: 3, background: '#111' } }).composite([{ input: Buffer.from(svg), top: 0, left: 0 }, { input: img, top: 40, left: 0 }]).png().toBuffer();
}

async function main(): Promise<void> {
  const out = path.join(FRAMES, 'blind'); fs.mkdirSync(out, { recursive: true });
  const key: { sheet: string; pose: string; marketSide: 'A' | 'B'; note: string }[] = [];
  let n = 0;
  for (const p of MARKET_POSES) {
    if (only && !only.includes(p.key)) continue;
    const dir = path.join(FRAMES, p.key), photo = path.join(dir, 'photo.jpg');
    if (![photo, path.join(dir, 'today.png'), path.join(dir, 'markets.png')].every(f => fs.existsSync(f))) { console.warn(`${p.key}: frames or photo missing`); continue; }
    const marketSide = hash01(`${seed}:${p.key}`) < 0.5 ? 'A' : 'B';
    const [a, b] = marketSide === 'A' ? ['markets.png', 'today.png'] : ['today.png', 'markets.png'];
    const panels = [await panel(photo, 'photo'), await panel(path.join(dir, a), 'A'), await panel(path.join(dir, b), 'B')];
    const sheet = `${++n}.jpg`;
    await sharp({ create: { width: PW * 3, height: PH + 40, channels: 3, background: '#000' } })
      .composite(panels.map((input, i) => ({ input, top: 0, left: i * PW }))).jpeg({ quality: 86 }).toFile(path.join(out, sheet));
    key.push({ sheet, pose: p.key, marketSide, note: p.note });
  }
  fs.writeFileSync(path.join(out, 'key.json'), JSON.stringify(key, null, 1) + '\n');
  console.log(`${key.length} blind sheets in ${out}`);
}

void main();
