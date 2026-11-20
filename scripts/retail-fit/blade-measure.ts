// Lane retail-fit: measure a blade sign (uithangbord) on a house:frames pose photo through the pose's own camera
// (pose.ts frameFor / rayFor: the frame the photo was cut to, elevation 0 = the camera's ground). The bracket's root is on the wall
// plane: its pixel gives the mount height and its place along the wall exactly. The board hangs in the vertical plane
// through the root along the wall normal; its corner pixels give its reach out from the wall and its top and bottom.
//   npx tsx scripts/retail-fit/blade-measure.ts <pose.json> --root=x,y --inner=x,y --outer=x,y --bottom=x,y [--grid=out.png --box=x0,y0,x1,y1]
//   root: where the bracket meets the wall; inner/outer: the board's top corners nearest and farthest from the wall;
//   bottom: the board's lowest point. --ground=x,y: a pixel where the facade meets the pavement near the blade: the
//   panorama's position can be metres off, so the facade stands nearer or farther than the BAG wall plane; the ground
//   line calibrates it (heights scale about the eye height by k = eye / (eye - z_ground), lengths by k). Prints at (share of the wall a->b, seen from the street), z (bracket over the
//   ground), w, h, and the board's gap from the wall.
import fs from 'node:fs';
import sharp from 'sharp';
import { frameFor, rayFor, rdToLocal } from '../house-frames/pose.ts';
const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const xy = (n: string) => arg(n)?.split(',').map(Number) as [number, number] | undefined;
const j = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')), { pose, wall } = j;
const frame = frameFor(pose), [Ax, Ay] = rdToLocal(wall.a, pose.lngLat), [Bx, By] = rdToLocal(wall.b, pose.lngLat);
const ax = Ax, ay = Ay, ex = Bx - ax, ey = By - ay, len = Math.hypot(ex, ey), ux = ex / len, uy = ey / len;
const [cx, cy, cz] = frame.eye;
let nx = -uy, ny = ux; // the wall normal, turned towards the camera
if ((cx - ax) * nx + (cy - ay) * ny < 0) { nx = -nx; ny = -ny; }
/** Intersect the pixel's ray with the vertical plane through point q with horizontal normal m; return (along a->b, out, z). */
function hit(u: number, v: number, qx: number, qy: number, mx: number, my: number): [number, number, number] {
  const [dx, dy, dz] = rayFor(frame, u, v), den = dx * mx + dy * my, t = ((qx - cx) * mx + (qy - cy) * my) / den;
  const X = cx + dx * t, Y = cy + dy * t, Z = cz + dz * t;
  return [(X - ax) * ux + (Y - ay) * uy, (X - ax) * nx + (Y - ay) * ny, Z];
}
const r = xy('root'), gr = xy('ground');
const k = gr ? cz / (cz - hit(gr[0], gr[1], ax, ay, nx, ny)[2]) : 1, Z = (z: number) => cz + (z - cz) * k;
if (gr) console.log(`ground calibration k = ${k.toFixed(3)} (eye ${cz.toFixed(2)} m)`);
if (r) {
  const [a, , z] = hit(r[0], r[1], ax, ay, nx, ny); // on the wall plane
  // The board's plane: vertical, through the root, along the normal (its own normal is the wall direction).
  const qx = ax + ux * a, qy = ay + uy * a;
  const P = (n: string) => { const q = xy(n); return q ? hit(q[0], q[1], qx, qy, ux, uy) : undefined; };
  const inner = P('inner'), outer = P('outer'), bottom = P('bottom');
  const out = { at: +(a / len).toFixed(3), alongM: +a.toFixed(2), wallLenM: +len.toFixed(2), z: +Z(z).toFixed(2),
    ...(inner && outer ? { gapM: +(inner[1] * k).toFixed(2), w: +((outer[1] - inner[1]) * k).toFixed(2), top: +Z((inner[2] + outer[2]) / 2).toFixed(2) } : {}),
    ...(bottom && inner && outer ? { h: +(((inner[2] + outer[2]) / 2 - bottom[2]) * k).toFixed(2), bottom: +Z(bottom[2]).toFixed(2) } : {}) };
  console.log(JSON.stringify(out));
}
const g = arg('grid');
if (g) {
  const [x0, y0, x1, y1] = arg('box')!.split(',').map(Number), S = 3;
  const img = await sharp(process.argv[2].replace(/pose\.json$/, 'photo.jpg')).extract({ left: x0, top: y0, width: x1 - x0, height: y1 - y0 }).resize({ width: (x1 - x0) * S, kernel: 'nearest' }).png().toBuffer();
  const lines: string[] = [];
  for (let x = Math.ceil(x0 / 10) * 10; x <= x1; x += 10) lines.push(`<line x1="${(x - x0) * S}" x2="${(x - x0) * S}" y1="0" y2="${(y1 - y0) * S}" stroke="${x % 50 ? '#00ffff40' : '#ffff00a0'}"/>${x % 50 ? '' : `<text x="${(x - x0) * S + 2}" y="12" font-size="12" fill="#ffff00">${x}</text>`}`);
  for (let y = Math.ceil(y0 / 10) * 10; y <= y1; y += 10) lines.push(`<line y1="${(y - y0) * S}" y2="${(y - y0) * S}" x1="0" x2="${(x1 - x0) * S}" stroke="${y % 50 ? '#00ffff40' : '#ffff00a0'}"/>${y % 50 ? '' : `<text x="2" y="${(y - y0) * S - 2}" font-size="12" fill="#ffff00">${y}</text>`}`);
  await sharp(img).composite([{ input: Buffer.from(`<svg width="${(x1 - x0) * S}" height="${(y1 - y0) * S}">${lines.join('')}</svg>`) }]).png().toFile(g);
  console.log(g);
}
