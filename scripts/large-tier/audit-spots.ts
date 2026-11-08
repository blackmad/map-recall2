// Lane blank-installs audit (#264): one aerial pose per low-glass catalogue install, for bare-fronts-shots.spec.ts.
//
// Reads artifacts/large-tier/install-glazing.json (install-glazing.ts) and the catalogue footprints; for every install
// under --max share (default 0.10) writes a spot in the bareSpots.ts shape: `camera` is the footprint centre (the map
// centre the pose looks at), `bearing` looks at the pand across its longest outward edge (the street front), zoom
// 17.3 for a ~100 m block, less for a larger one. Plus the audit table (wall/glass m2, share, centre, footprint size).
//
//   node --import tsx scripts/large-tier/audit-spots.ts [--max=0.10] [--out=artifacts/large-tier/audit-spots.json]
//   BARE_SPOTS_FILE=artifacts/large-tier/audit-spots.json ... tests/e2e/bare-fronts-shots.spec.ts

import fs from 'node:fs';
import path from 'node:path';

const arg = (name: string, fallback: string) => process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback;
const MAX = Number(arg('max', '0.10'));
const OUT = arg('out', 'artifacts/large-tier/audit-spots.json');
const glazing = JSON.parse(fs.readFileSync('artifacts/large-tier/install-glazing.json', 'utf8')) as Array<{ id: string; name: string; glassM2: number; wallM2: number; glassShare: number }>;
const catalogue = JSON.parse(fs.readFileSync('public/canal-drive/ordinary-buildings-data/catalogue.json', 'utf8')) as { models: Array<{ id: string; footprint?: any; anchor?: number[]; modelUrl: string; height?: number }> };
const byId = new Map(catalogue.models.map(m => [m.id, m]));

const M_LAT = 111_320;
/** A photo-textured install (a base-colour image in the GLB) carries its windows in the texture: it measures 0 glass. */
const textured = (url: string) => {
  const b = fs.readFileSync(path.join('public/canal-drive', url.replace(/^\.\//, ''))), json = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString('utf8'));
  return (json.images?.length ?? 0) > 0;
};
const spots = [], table = [];
for (const r of glazing.filter(g => g.glassShare < MAX)) {
  const m = byId.get(r.id)!;
  const fp = typeof m.footprint === 'string' ? JSON.parse(m.footprint.replace(/'/g, '"')) : m.footprint;
  const ring: number[][] = fp?.type === 'MultiPolygon' ? fp.coordinates[0][0] : fp?.coordinates?.[0] ?? [];
  const lat0 = ring.length ? ring.reduce((s, p) => s + p[1], 0) / ring.length : m.anchor![1];
  const M_LON = M_LAT * Math.cos(lat0 * Math.PI / 180);
  const o = ring[0] ?? m.anchor!, xy = ring.map(p => [(p[0] - o[0]) * M_LON, (p[1] - o[1]) * M_LAT]);
  // Area centroid (shoelace) in metres about the first vertex.
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i + 1 < xy.length; i++) { const [x0, y0] = xy[i], [x1, y1] = xy[i + 1], k = x0 * y1 - x1 * y0; a += k; cx += (x0 + x1) * k; cy += (y0 + y1) * k; }
  const centre = a ? [o[0] + cx / (3 * a) / M_LON, o[1] + cy / (3 * a) / M_LAT] : m.anchor!;
  const xs = xy.map(p => p[0]), ys = xy.map(p => p[1]);
  const size = [Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)];
  // Longest edge; the pose looks along its inward normal (from the street onto the front).
  let best = 0, bearing = 0;
  const C = [(centre[0] - o[0]) * M_LON, (centre[1] - o[1]) * M_LAT];
  for (let i = 0; i + 1 < xy.length; i++) {
    const [x0, y0] = xy[i], [x1, y1] = xy[i + 1], len = Math.hypot(x1 - x0, y1 - y0);
    if (len <= best) continue;
    let nx = (y1 - y0) / len, ny = -(x1 - x0) / len;
    if (nx * ((x0 + x1) / 2 - C[0]) + ny * ((y0 + y1) / 2 - C[1]) < 0) { nx = -nx; ny = -ny; }
    best = len; bearing = Math.round(((Math.atan2(-nx, -ny) * 180 / Math.PI) + 360) % 360);
  }
  const span = Math.max(...size);
  const zoom = +Math.max(16.3, Math.min(17.3, 17.3 - Math.log2(Math.max(1, span / 110)))).toFixed(2);
  const name = r.id.replace(/^ordinary-0363100012/, 'i');
  spots.push({ name, camera: centre.map(v => +v.toFixed(6)), zoom, bearing, pitch: 60, pands: [r.id.replace(/^ordinary-/, '')], id: r.id });
  table.push({ id: r.id, name: r.name, wallM2: r.wallM2, glassM2: r.glassM2, glassShare: r.glassShare, textured: textured(m.modelUrl), height: m.height, centre: centre.map(v => +v.toFixed(6)), footprintM: size.map(v => Math.round(v)), frontM: Math.round(best) });
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(spots, null, 1));
fs.writeFileSync(OUT.replace(/\.json$/, '-table.json'), JSON.stringify(table, null, 1));
console.log(JSON.stringify({ max: MAX, spots: spots.length, under006: table.filter(t => t.glassShare < 0.06).length, textured: table.filter(t => t.textured).length }));
