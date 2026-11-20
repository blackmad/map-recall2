// Lane retail-fit: close crops for blind sheets where two renders of the same poses differ. Per key, the bounding box of
// the pixels that changed (sum |dRGB| > 30) between <off>/<key>/<file> and <fit>/<key>/<file>, padded to at least
// --min of the frame and to a 16:10-ish box, as blind.ts --crops fractions. Keys under --minPct changed pixels are left out.
//   npx tsx scripts/retail-fit/diff-crop.mts <off> <fit> [--file=game.png] [--pad=0.6] [--min=0.22] [--minPct=0.05]
import fs from 'node:fs';
import sharp from 'sharp';
const [OFF, FIT] = process.argv.slice(2), arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const file = arg('file') ?? 'game.png', PAD = Number(arg('pad') ?? 0.6), MIN = Number(arg('min') ?? 0.22), MINPCT = Number(arg('minPct') ?? 0.05);
const out: Record<string, number[]> = {};
for (const k of fs.readdirSync(OFF).sort()) {
  const a = `${OFF}/${k}/${file}`, b = `${FIT}/${k}/${file}`;
  if (!fs.existsSync(a) || !fs.existsSync(b)) continue;
  const A = await sharp(a).removeAlpha().raw().toBuffer({ resolveWithObject: true }), B = await sharp(b).removeAlpha().raw().toBuffer();
  const { width: W, height: H } = A.info;
  let x0 = W, y0 = H, x1 = -1, y1 = -1, n = 0;
  for (let i = 0; i < W * H; i++) {
    const d = Math.abs(A.data[i * 3] - B[i * 3]) + Math.abs(A.data[i * 3 + 1] - B[i * 3 + 1]) + Math.abs(A.data[i * 3 + 2] - B[i * 3 + 2]);
    if (d > 30) { const x = i % W, y = (i / W) | 0; n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (100 * n / (W * H) < MINPCT) continue;
  let cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, w = Math.max((x1 - x0) * (1 + PAD), MIN * W), h = Math.max((y1 - y0) * (1 + PAD), MIN * H);
  if (w / h < 1.6) w = h * 1.6; else h = w / 1.6;
  w = Math.min(w, W); h = Math.min(h, H);
  cx = Math.min(Math.max(cx, w / 2), W - w / 2); cy = Math.min(Math.max(cy, h / 2), H - h / 2);
  out[k] = [(cx - w / 2) / W, (cy - h / 2) / H, (cx + w / 2) / W, (cy + h / 2) / H].map(v => Math.round(v * 1000) / 1000);
}
console.log(JSON.stringify(out));
