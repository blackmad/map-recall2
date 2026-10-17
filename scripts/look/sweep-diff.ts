/**
 * Where a zoom-sweep step jumps: the ΔE76 > 20 pixels between two sweep frames (the first magnified about the view
 * centre, as tests/e2e/overview-transition.spec.ts compares them), painted red over the second frame.
 *
 *   node --import tsx scripts/look/sweep-diff.ts <a.png> <b.png> <zoomA> <zoomB> <out.png>
 */
import sharp from 'sharp';
import { zoomWarp, type Frame } from '../../src/canalRecall/overviewTransition/frameMetrics.ts';

const [a, b, za, zb, out] = process.argv.slice(2);
const load = async (f: string): Promise<Frame> => { const { data, info } = await sharp(f).removeAlpha().raw().toBuffer({ resolveWithObject: true }); return { data, width: info.width, height: info.height, channels: 3 }; };
const A = await load(a), B = await load(b);
const W = zoomWarp(A, 2 ** (Number(zb) - Number(za)), B.width / 2, B.height / 2);
const lab = (r: number, g: number, bl: number) => {
  const lin = [r, g, bl].map(v => { const s = v / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
  const X = (0.4124 * lin[0] + 0.3576 * lin[1] + 0.1805 * lin[2]) / 0.95047, Y = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2], Z = (0.0193 * lin[0] + 0.1192 * lin[1] + 0.9505 * lin[2]) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
};
const o = Buffer.from(B.data);
let n = 0;
for (let i = 0; i < B.width * B.height; i++) {
  const p = lab(W.data[i * 3], W.data[i * 3 + 1], W.data[i * 3 + 2]), q = lab(B.data[i * 3], B.data[i * 3 + 1], B.data[i * 3 + 2]);
  if (Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) > 20) { o[i * 3] = 255; o[i * 3 + 1] = 0; o[i * 3 + 2] = 0; n++; }
}
await sharp(o, { raw: { width: B.width, height: B.height, channels: 3 } }).png().toFile(out);
console.log(`${(100 * n / (B.width * B.height)).toFixed(1)} % over ΔE 20 → ${out}`);
