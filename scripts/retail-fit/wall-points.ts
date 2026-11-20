// Lane retail-fit: points along an all-walls crop (metres from the crop's left = wallRD.a) as lng/lat, with the median
// glass tone of the window there (u +- 0.5 m, v0..v1 m above the crop's ground). For staging reads by lng/lat.
//   npx tsx scripts/retail-fit/wall-points.ts --dir=<pand dir> --tag=w05-288b --at=3.96,7.6 [--v=3.2,5]
import fs from 'node:fs';
import sharp from 'sharp';
import { rdToLngLat } from '../../src/canalRecall/rdCoordinates.ts';
const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const dir = arg('dir')!, tag = arg('tag')!, at = arg('at')!.split(',').map(Number), [v0, v1] = (arg('v') ?? '3.2,5').split(',').map(Number);
const w = (JSON.parse(fs.readFileSync(`${dir}/walls.json`, 'utf8')) as any[] | { walls: any[] });
const wall = (Array.isArray(w) ? w : w.walls).find(r => r.tag === tag);
const { data, info } = await sharp(`${dir}/${tag}.jpg`).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const [ax, ay] = wall.wallRD.a, [bx, by] = wall.wallRD.b, L = Math.hypot(bx - ax, by - ay);
for (const m of at) {
  const f = m / L, [lng, lat] = rdToLngLat(ax + (bx - ax) * f, ay + (by - ay) * f);
  const ch: number[][] = [[], [], []];
  for (let y = Math.round(info.height - v1 * 50); y < info.height - v0 * 50; y++) for (let x = Math.max(0, Math.round((m - 0.5) * 50)); x < Math.min(info.width, (m + 0.5) * 50); x++) for (let c = 0; c < 3; c++) ch[c].push(data[(y * info.width + x) * 3 + c]);
  const hex = '#' + ch.map(a => a.sort((p, q) => p - q)[a.length >> 1].toString(16).padStart(2, '0')).join('');
  console.log(`${tag} ${m} m\t[${lng.toFixed(7)}, ${lat.toFixed(7)}]\t${hex}`);
}
