import fs from 'node:fs';
import {lngLatToRd} from '../../src/canalRecall/facade/rdNew';

const anchorRD = [122601.68, 486292.94];
const rows = JSON.parse(fs.readFileSync('/private/tmp/claude-501/panels.json', 'utf8')) as {i: number; b: number; w: number; eaves: number; g: number; x: number; z: number}[];
const walls = JSON.parse(fs.readFileSync('scripts/landmarks/roeterseiland-rec-a-inventory.json', 'utf8')).walls.map((w: any) => ({tag: w.tag, bearing: w.bearing, lengthM: w.lengthM, centre: w.centre}));
for (const w of walls) {
  const rd = lngLatToRd(w.centre), x = rd.x - anchorRD[0], z = anchorRD[1] - rd.y;
  const near = rows.filter(r => Math.abs(((r.b - w.bearing + 540) % 360) - 180) < 14).map(r => ({r, d: Math.hypot(r.x - x, r.z - z)})).sort((a, b) => a.d - b.d).slice(0, 3);
  console.log(w.tag, 'x', x.toFixed(1), 'z', z.toFixed(1), 'len', w.lengthM, '->', near.map(n => `#${n.r.i} (b${n.r.b} w${n.r.w} e${n.r.eaves} g${n.r.g} @${n.r.x},${n.r.z} d${n.d.toFixed(0)})`).join('  '));
}
