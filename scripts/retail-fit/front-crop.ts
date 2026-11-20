// Lane retail-fit: close crops for blind sheets. Projects each house-frames pose's wall (pose.json wall a/b in RD, its
// ground storey 0..topM over the ground) into the 1440x900 frame through the pose's camera (heading, look-down, vfov,
// eye 2.44 m) and prints blind.ts --crops fractions, padded and clamped.
//   npx tsx scripts/retail-fit/front-crop.ts <frames dir> [--top=5] [--pad=0.25]
import fs from 'node:fs';
const dir = process.argv[2], arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const TOP = Number(arg('top') ?? 5), PAD = Number(arg('pad') ?? 0.25), EYE = 2.44;
const out: Record<string, number[]> = {};
for (const k of fs.readdirSync(dir)) {
  const f = `${dir}/${k}/pose.json`;
  if (!fs.existsSync(f)) continue;
  const j = JSON.parse(fs.readFileSync(f, 'utf8')), { pose, wall } = j;
  const h = pose.headingDeg * Math.PI / 180, p = pose.lookDownDeg * Math.PI / 180, W = pose.width, H = pose.height;
  const focal = H / 2 / Math.tan(pose.vfovDeg * Math.PI / 360), fw = [Math.sin(h), Math.cos(h)], rt = [Math.cos(h), -Math.sin(h)];
  const xs: number[] = [], ys: number[] = [];
  for (const q of [wall.a, wall.b]) for (const z of [0, TOP]) {
    const dx = q.x - pose.rd.x, dy = q.y - pose.rd.y, fwd = dx * fw[0] + dy * fw[1], side = dx * rt[0] + dy * rt[1], up = z - EYE;
    const zc = fwd * Math.cos(p) - up * Math.sin(p), yc = up * Math.cos(p) + fwd * Math.sin(p);
    if (zc <= 0.5) continue;
    xs.push(W / 2 + focal * side / zc); ys.push(H / 2 - focal * yc / zc);
  }
  if (!xs.length) continue;
  let [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const px = (x1 - x0) * PAD, py = (y1 - y0) * PAD;
  x0 = Math.max(0, x0 - px); x1 = Math.min(W, x1 + px); y0 = Math.max(0, y0 - py); y1 = Math.min(H, y1 + py);
  if (x1 - x0 < 40 || y1 - y0 < 40) continue;
  out[k] = [x0 / W, y0 / H, x1 / W, y1 / H].map(v => Math.round(v * 1000) / 1000);
}
console.log(JSON.stringify(out));
