// Usage: npx tsx scripts/landmarks/footprint-fit.ts <id>
// Checks that a GLB's plan sits on its BAG footprint: rasterises the top-down projection of every non-vertical
// triangle (roofs and tops cover the plan) at 0.5 m and compares it with the BAG ring. Also reports the same figures
// for the model mirrored across its own centre line in x and in z, so a mirrored or shifted model stands out.
import fs from 'node:fs';
import path from 'node:path';
import {loadSoup} from '../audit-glb-quality';

const id = process.argv[2];
const ROOT = path.resolve(import.meta.dirname, '../..');
const ring: [number, number][] = JSON.parse(fs.readFileSync(path.join(ROOT, `scripts/landmarks/${id}-footprints.json`), 'utf8')).nativeRing;
const soup = await loadSoup(path.join(ROOT, `public/canal-drive/models/${id}.glb`));
const inside = (x: number, z: number) => {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) if ((ring[i][1] > z) !== (ring[j][1] > z) && x < (ring[j][0] - ring[i][0]) * (z - ring[i][1]) / (ring[j][1] - ring[i][1]) + ring[i][0]) c = !c;
  return c;
};
const STEP = 0.5, occ = new Set<string>();
const P = soup.positions, I = soup.indices;
for (let t = 0; t * 3 + 2 < I.length; t++) {
  const v = [0, 1, 2].map(k => I[t * 3 + k] * 3), a = v.map(i => [P[i], P[i + 2]] as [number, number]);
  const area = (a[1][0] - a[0][0]) * (a[2][1] - a[0][1]) - (a[2][0] - a[0][0]) * (a[1][1] - a[0][1]);
  if (Math.abs(area) < 1e-3) continue;
  const [minX, maxX] = [Math.min(...a.map(p => p[0])), Math.max(...a.map(p => p[0]))], [minZ, maxZ] = [Math.min(...a.map(p => p[1])), Math.max(...a.map(p => p[1]))];
  for (let gx = Math.ceil(minX / STEP); gx * STEP <= maxX; gx++) for (let gz = Math.ceil(minZ / STEP); gz * STEP <= maxZ; gz++) {
    const x = gx * STEP, z = gz * STEP;
    const s = (p: [number, number], q: [number, number]) => (q[0] - p[0]) * (z - p[1]) - (q[1] - p[1]) * (x - p[0]);
    const d1 = s(a[0], a[1]), d2 = s(a[1], a[2]), d3 = s(a[2], a[0]);
    if (!((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))) occ.add(`${gx},${gz}`);
  }
}
const cells = [...occ].map(s => s.split(',').map(Number));
const cx = Math.round(cells.reduce((s, c) => s + c[0], 0) / cells.length), cz = Math.round(cells.reduce((s, c) => s + c[1], 0) / cells.length);
const score = (f: (c: number[]) => number[]) => {
  let both = 0, bag = 0;
  const m = new Set(cells.map(c => f(c).join(',')));
  const xs = ring.map(p => p[0] / STEP), zs = ring.map(p => p[1] / STEP);
  for (let gx = Math.floor(Math.min(...xs)); gx <= Math.ceil(Math.max(...xs)); gx++) for (let gz = Math.floor(Math.min(...zs)); gz <= Math.ceil(Math.max(...zs)); gz++) {
    if (!inside(gx * STEP, gz * STEP)) continue;
    bag++;
    if (m.has(`${gx},${gz}`)) both++;
  }
  return `${(100 * both / bag).toFixed(0)}% of BAG covered, ${(100 * both / m.size).toFixed(0)}% of model on BAG`;
};
console.log(`${id}: as built ${score(c => c)}; mirrored in x ${score(c => [2 * cx - c[0], c[1]])}; mirrored in z ${score(c => [c[0], 2 * cz - c[1]])}`);
// --map: 1 m character map, x east across, z south down: '#' both, 'B' BAG only, 'M' model only.
if (process.argv.includes('--map')) {
  const xs = ring.map(p => p[0]), zs = ring.map(p => p[1]);
  for (let z = Math.floor(Math.min(...zs)) - 2; z <= Math.max(...zs) + 2; z += 1) {
    let line = '';
    for (let x = Math.floor(Math.min(...xs)) - 2; x <= Math.max(...xs) + 2; x += 1) {
      const b = inside(x, z), m = occ.has(`${Math.round(x / STEP)},${Math.round(z / STEP)}`);
      line += b && m ? '#' : b ? 'B' : m ? 'M' : '.';
    }
    console.log(line);
  }
}
