/**
 * Rectified crops of the two long street faces of Nieuw Engeland (Singel 29 m, Koningsplein 26 m) and of the
 * Koningsplein end wall, each as one plane through the BAG chord ends, from the straightest Gemeente Amsterdam panoramas
 * (CC BY 4.0). landmark-brief.ts splits these faces at every 0.2 m pier jog and keeps only the 4-7 m pieces between them,
 * so this script draws the whole face once for counting bays and storeys.
 *
 *   node --import tsx scripts/landmarks/nieuw-engeland-crops.ts
 *
 * Writes artifacts/landmark-briefs/nieuw-engeland/face-<name>-<n>.jpg (40 px/m, 30 m tall). Not committed.
 */
import fs from 'node:fs';
import src from './nieuw-engeland-footprints.json' with {type: 'json'};
import {listPanos, rankPanos, type Wall} from '../pand-reference/select';
import {loadPano, rectifyWall} from '../pand-reference/rectify';

const R = src.ringRD as number[][];
/** Ring vertex indices (nieuw-engeland-footprints.json ringRD) of each face's ends, in ring order (outside on the left). */
const FACES: Record<string, [number, number]> = {singel: [29, 58], koningsplein: [7, 20], kpWest: [0, 1]};
const out = 'artifacts/landmark-briefs/nieuw-engeland';
fs.mkdirSync(out, {recursive: true});
for (const [name, [i, j]] of Object.entries(FACES)) {
  const a = {x: R[i][0], y: R[i][1]}, b = {x: R[j][0], y: R[j][1]};
  const len = Math.hypot(b.x - a.x, b.y - a.y), tx = (b.x - a.x) / len, ty = (b.y - a.y) / len;
  // RD ring is counter-clockwise (outside on the right of travel in x-east/y-north): outward normal (ty, -tx)
  const wall: Wall = {a, b, len, nx: ty, ny: -tx, mid: {x: (a.x + b.x) / 2, y: (a.y + b.y) / 2}, roadDistM: 0, facing: 0};
  const panos = await listPanos(wall.mid, 45);
  let picks = rankPanos(wall, panos, {minD: 8, maxD: 45, strict: [12, 40], maxObliquityDeg: 40});
  if (!picks.length) { wall.nx = -wall.nx; wall.ny = -wall.ny; picks = rankPanos(wall, panos, {minD: 8, maxD: 45, strict: [12, 40], maxObliquityDeg: 40}); }
  console.log(name, len.toFixed(1), 'm', picks.length, 'candidates');
  let n = 0;
  for (const p of picks) {
    if (n >= 3) break;
    const img = await loadPano(p);
    if (!img) continue;
    const c = rectifyWall(img.img, p, wall, 28.5, 40, undefined, 30);
    if (!c || c.missingFraction > 0.35) continue;
    const f = `${out}/face-${name}-${n}.jpg`;
    fs.writeFileSync(f, c.jpeg);
    console.log(' ', f, p.panoId, String(p.timestamp).slice(0, 10), `d=${p.distM.toFixed(0)} obl=${p.obliquityDeg.toFixed(0)} ppm=${c.ppm.toFixed(1)} ${c.width}x${c.height} miss=${c.missingFraction.toFixed(2)}`);
    n++;
  }
}
