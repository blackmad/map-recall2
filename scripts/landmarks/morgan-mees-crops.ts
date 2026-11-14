/**
 * Whole-face rectified crops of Morgan & Mees (Tweede Hugo de Grootstraat 2): the street front of the 1880 school block,
 * its east face over the wing (the one with the MORGAN & MEES lettering), the Nassaukade line (the one-storey wing and
 * the garden wall down to the street corner) and the wing's garden wall. landmark-brief.ts splits the Nassaukade line
 * at every BAG jog and stops at the pand edge, so this script draws each face once, as one plane, for counting bays.
 *
 *   node --import tsx scripts/landmarks/morgan-mees-crops.ts [--per=4]
 *
 * Gemeente Amsterdam panoramas (CC BY 4.0). Writes artifacts/landmark-briefs/morgan-mees/face-<name>-<n>.jpg (60 px/m)
 * with the panorama id, date, distance and obliquity printed to the console. Not committed.
 */
import fs from 'node:fs';
import src from './morgan-mees-footprints.json' with {type: 'json'};
import {listPanos, rankPanos, type Wall} from '../pand-reference/select';
import {loadPano, rectifyWall} from '../pand-reference/rectify';

type XY = {x: number; y: number};
const R = src.ringRD as number[][];
const P = (i: number): XY => ({x: R[i][0], y: R[i][1]});
const along = (a: XY, b: XY, s: number): XY => { const L = Math.hypot(b.x - a.x, b.y - a.y); return {x: a.x + (b.x - a.x) * s / L, y: a.y + (b.y - a.y) * s / L}; };
/** Intersection of lines a1-a2 and b1-b2. */
function meet(a1: XY, a2: XY, b1: XY, b2: XY): XY {
  const d1 = {x: a2.x - a1.x, y: a2.y - a1.y}, d2 = {x: b2.x - b1.x, y: b2.y - b1.y}, den = d1.x * d2.y - d1.y * d2.x;
  const t = ((b1.x - a1.x) * d2.y - (b1.y - a1.y) * d2.x) / den;
  return {x: a1.x + d1.x * t, y: a1.y + d1.y * t};
}
/** The street corner the garden wall and the hedge meet at: street line (ring 0-1) x Nassaukade line (ring 3-12). */
const K = meet(P(0), P(1), P(3), P(12));
const FACES: Record<string, [XY, XY, number]> = {
  street: [P(0), P(1), 16],
  eastMain: [P(1), along(P(1), P(2), 12.4), 16],
  nassau: [K, P(12), 16],
  garden: [P(2), P(3), 12],
  hedge: [P(1), K, 8],
};
const per = Number(process.argv.find(a => a.startsWith('--per='))?.slice(6) ?? 3);
const out = 'artifacts/landmark-briefs/morgan-mees';
fs.mkdirSync(out, {recursive: true});
for (const [name, [a, b, h]] of Object.entries(FACES)) {
  const len = Math.hypot(b.x - a.x, b.y - a.y), tx = (b.x - a.x) / len, ty = (b.y - a.y) / len;
  const wall: Wall = {a, b, len, nx: ty, ny: -tx, mid: {x: (a.x + b.x) / 2, y: (a.y + b.y) / 2}, roadDistM: 0, facing: 0};
  const panos = await listPanos(wall.mid, 45);
  const win = {minD: 5, maxD: 40, strict: [9, 30] as [number, number], maxObliquityDeg: 45};
  let picks = rankPanos(wall, panos, win);
  if (!picks.length) { wall.nx = -wall.nx; wall.ny = -wall.ny; picks = rankPanos(wall, panos, win); }
  console.log(name, len.toFixed(2), 'm', picks.length, 'candidates');
  let n = 0;
  for (const p of picks) {
    if (n >= per) break;
    const img = await loadPano(p);
    if (!img) continue;
    const c = rectifyWall(img.img, p, wall, h - 1.5, 60, undefined, h);
    if (!c || c.missingFraction > 0.35) continue;
    const f = `${out}/face-${name}-${n}.jpg`;
    fs.writeFileSync(f, c.jpeg);
    console.log(' ', f, p.panoId, String(p.timestamp).slice(0, 10), `d=${p.distM.toFixed(0)} obl=${p.obliquityDeg.toFixed(0)} ppm=${c.ppm.toFixed(1)} ${c.width}x${c.height} miss=${c.missingFraction.toFixed(2)}`);
    n++;
  }
}
