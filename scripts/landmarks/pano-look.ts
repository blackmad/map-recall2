/**
 * Pitched perspective view out of a Gemeente Amsterdam panorama (CC BY 4.0), cut from the full equirectangular image
 * (the public thumbnail endpoint ignores pitch, so tower tops and spires never fit in its frame).
 *
 *   node --import tsx scripts/landmarks/pano-look.ts --pano=<id> --heading=63 --pitch=30 --fov=50 --out=artifacts/... [--width=1200] [--aspect=0.75]
 *
 * World-aligned Amsterdam convention (src/canalRecall/facade/rectify.ts): north at the image centre, no vehicle orientation.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import jpeg from 'jpeg-js';
import {cachedBytes, cachedJson} from '../pand-reference/core.ts';
import {directionToPixel, sampleEquirectangular} from '../../src/canalRecall/facade/rectify.ts';

const arg = (n: string, d = '') => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const pano = arg('pano'), out = arg('out');
if (!pano || !out) { console.error('--pano and --out required'); process.exit(2); }
const heading = Number(arg('heading', '0')) * Math.PI / 180, pitch = Number(arg('pitch', '0')) * Math.PI / 180;
const fov = Number(arg('fov', '50')) * Math.PI / 180, W = Number(arg('width', '1200')), H = Math.round(W / Number(arg('aspect', '0.75')));
const rec = await cachedJson<{_links: Record<string, {href: string}>}>(`https://api.data.amsterdam.nl/panorama/panoramas/${pano}/`);
const href = rec._links.equirectangular_full?.href ?? rec._links.equirectangular_medium.href;
const d = jpeg.decode(await cachedBytes(href, '.jpg'), {useTArray: true, maxMemoryUsageInMB: 1536});
const img = {width: d.width, height: d.height, data: d.data as Uint8Array};
const buf = Buffer.alloc(W * H * 3), px = [0, 0, 0], f = (W / 2) / Math.tan(fov / 2);
// camera basis in (east, north, up)
const fwd = [Math.sin(heading) * Math.cos(pitch), Math.cos(heading) * Math.cos(pitch), Math.sin(pitch)];
const right = [Math.cos(heading), -Math.sin(heading), 0];
const up = [fwd[1] * right[2] - fwd[2] * right[1], fwd[2] * right[0] - fwd[0] * right[2], fwd[0] * right[1] - fwd[1] * right[0]].map(v => -v);
for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
  const a = (i - W / 2) / f, b = (H / 2 - j) / f;
  const dir: [number, number, number] = [fwd[0] + a * right[0] + b * up[0], fwd[1] + a * right[1] + b * up[1], fwd[2] + a * right[2] + b * up[2]];
  const [u, v] = directionToPixel(dir, img, 'centre');
  sampleEquirectangular(img, u, v, px);
  buf[(j * W + i) * 3] = px[0]; buf[(j * W + i) * 3 + 1] = px[1]; buf[(j * W + i) * 3 + 2] = px[2];
}
fs.mkdirSync(path.dirname(out), {recursive: true});
await sharp(buf, {raw: {width: W, height: H, channels: 3}}).jpeg({quality: 88}).toFile(out);
console.log(`wrote ${out} (${pano}, heading ${arg('heading')}, pitch ${arg('pitch')}, fov ${arg('fov', '50')}; Gemeente Amsterdam panoramas CC BY 4.0)`);
