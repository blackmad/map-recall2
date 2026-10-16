// Per-boat orthophoto measurements for every houseboat outline: what is on top of the
// outline (roof colour, sunlit median, texture, vegetation) against the water around it.
//   npx tsx scripts/houseboat-kinds/pixels.ts [ids.json] -> artifacts/houseboat-kinds/pixels.json
import fs from 'node:fs';
import sharp from 'sharp';
import type { Houseboat } from '../../src/canalRecall/houseboats.ts';
import { OUT, PX, orthoCrop } from './ortho.ts';

type RGB = [number, number, number];
export type PixelStats = {
  id: string;
  /** Interior ≥ 0.5 m inside the outline: median colour, median of the sunlit half, luminance spread. */
  inner: RGB; sunlit: RGB; lum: [number, number, number]; std: number; grad: number; green: number; n: number;
  /** The middle 60 % of the length, ≥ 0.5 m inside: where a ship's cabin roof is. */
  core: RGB | null;
  /** 1.5–4 m outside the outline: mostly water. */
  outer: RGB; outerLum: number;
};

const lumOf = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[s.length >> 1] : 0; };
const medRGB = (px: RGB[]): RGB => [median(px.map(p => p[0])), median(px.map(p => p[1])), median(px.map(p => p[2]))];

function segDist(px: number, py: number, ring: [number, number][]) {
  let d = Infinity, inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, ay] = ring[j], [bx, by] = ring[i];
    if ((ay > py) !== (by > py) && px < ax + (bx - ax) * (py - ay) / (by - ay)) inside = !inside;
    const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
    d = Math.min(d, Math.hypot(ax + t * dx - px, ay + t * dy - py));
  }
  return inside ? d : -d; // pixels
}

export async function measureBoat(boat: Houseboat): Promise<PixelStats> {
  const c = await orthoCrop(boat);
  const { data, info } = await sharp(c.file).raw().toBuffer({ resolveWithObject: true });
  const W = info.width, ch = info.channels;
  const inner: RGB[] = [], core: RGB[] = [], outer: RGB[] = [], lums: number[] = [];
  let grad = 0, green = 0;
  const L = c.length / PX, Wd = c.width / PX, m = 4 / PX;
  for (let y = 1; y < info.height - 1; y += 2) for (let x = 1; x < W - 1; x += 2) {
    const dx = x - c.cx, dy = y - c.cy, u = dx * c.ux + dy * c.uy, v = dx * c.vx + dy * c.vy;
    if (Math.abs(u) > L / 2 + m || Math.abs(v) > Wd / 2 + m) continue;
    const d = segDist(x, y, c.ring) * PX;
    const k = (y * W + x) * ch, p: RGB = [data[k], data[k + 1], data[k + 2]];
    if (d >= 0.5) {
      inner.push(p);
      const l = lumOf(...p);
      lums.push(l);
      grad += Math.abs(l - lumOf(data[k + ch], data[k + ch + 1], data[k + ch + 2])) + Math.abs(l - lumOf(data[k + W * ch], data[k + W * ch + 1], data[k + W * ch + 2]));
      if (p[1] > p[0] + 6 && p[1] > p[2] + 6) green++;
      if (Math.abs(u) <= 0.3 * L) core.push(p);
    } else if (d <= -1.5 && d >= -4) outer.push(p);
  }
  const ls = [...lums].sort((a, b) => a - b), q = (f: number) => ls.length ? ls[Math.min(ls.length - 1, Math.floor(f * ls.length))] : 0;
  const cut = q(0.4), sunlit = inner.filter((p, i) => lums[i] >= cut);
  const mean = lums.reduce((a, b) => a + b, 0) / (lums.length || 1);
  const std = Math.sqrt(lums.reduce((a, b) => a + (b - mean) ** 2, 0) / (lums.length || 1));
  const o = medRGB(outer);
  return {
    id: boat.id, inner: medRGB(inner), sunlit: medRGB(sunlit), lum: [q(0.1), q(0.5), q(0.9)].map(Math.round) as [number, number, number],
    std: +std.toFixed(1), grad: +(grad / (inner.length || 1)).toFixed(1), green: +(green / (inner.length || 1)).toFixed(3), n: inner.length,
    core: core.length >= 20 ? medRGB(core) : null, outer: o, outerLum: Math.round(lumOf(...o)),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { boats }: { boats: Houseboat[] } = JSON.parse(fs.readFileSync('public/data/extracts/amsterdam/houseboats.json', 'utf8'));
  const want = process.argv[2] ? new Set(JSON.parse(fs.readFileSync(process.argv[2], 'utf8')) as string[]) : null;
  const todo = boats.filter(b => !want || want.has(b.id));
  const file = `${OUT}/pixels.json`;
  const done: Record<string, PixelStats> = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  let k = 0;
  for (let i = 0; i < todo.length; i += 8) {
    const batch = todo.slice(i, i + 8).filter(b => !done[b.id]);
    for (const s of await Promise.all(batch.map(b => measureBoat(b).catch(e => (console.warn(String(e)), null))))) if (s) done[s.id] = s;
    if ((k += batch.length) >= 200) { k = 0; fs.writeFileSync(file, JSON.stringify(done)); console.log(Object.keys(done).length); }
  }
  fs.writeFileSync(file, JSON.stringify(done));
  console.log(`measured ${Object.keys(done).length} -> ${file}`);
}
