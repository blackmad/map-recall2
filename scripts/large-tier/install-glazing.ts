// Lane R5-D (#264): how much of each installed ordinary building's walls is glass.
//
// Two of the user's three "flat block" shots (2026-11-08: Van Oldenbarneveldtstraat 48-56, the Van der Palmkade 191
// serpentine block by the Kattensloot) are not bare facades at all: the generic facade is hidden under an installed
// large-recipe GLB (ordinary-buildings catalogue) whose walls carry a few dozen windows on a 300-600 m perimeter.
// This measures, per non-instanced catalogue model, the glass area against the wall area (vertical faces of the
// wall materials) and writes the table; `blankInstalls.ts` pins the ones under the threshold.
//
//   node --import tsx scripts/large-tier/install-glazing.ts [--out=artifacts/large-tier/install-glazing.json]

import fs from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { BLANK_INSTALL_MAX_GLASS_SHARE } from '../../src/canalRecall/landmarks/blankInstalls.ts';

const arg = (name: string, fallback: string) => process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback;
const OUT = arg('out', 'artifacts/large-tier/install-glazing.json');
const ROOT = 'public/canal-drive';
const catalogue = JSON.parse(fs.readFileSync(`${ROOT}/ordinary-buildings-data/catalogue.json`, 'utf8')) as { models: Array<{ id: string; name: string; modelUrl: string; height: number; instance?: unknown }> };
const WALL = /brick|stone|render|wall|plaster|concrete|clad|panel|metal|timber|stucco|tile_wall|facade/i;

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
type Row = { id: string; name: string; glassM2: number; wallM2: number; glassShare: number };
const rows: Row[] = [];
for (const m of catalogue.models) {
  if (m.instance) continue; // street-survey recipe houses share one frontage mesh; not large blocks
  const file = path.join(ROOT, m.modelUrl.replace(/^\.\//, ''));
  if (!fs.existsSync(file)) continue;
  const doc = await io.read(file);
  let glass = 0, wall = 0;
  for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) {
    const name = prim.getMaterial()?.getName() ?? '', pos = prim.getAttribute('POSITION'), ind = prim.getIndices();
    if (!pos) continue;
    const n = ind ? ind.getCount() : pos.getCount(), A = [0, 0, 0], B = [0, 0, 0], C = [0, 0, 0];
    for (let t = 0; t + 2 < n; t += 3) {
      pos.getElement(ind ? ind.getScalar(t) : t, A); pos.getElement(ind ? ind.getScalar(t + 1) : t + 1, B); pos.getElement(ind ? ind.getScalar(t + 2) : t + 2, C);
      const u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], v = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
      const nx = u[1] * v[2] - u[2] * v[1], ny = u[2] * v[0] - u[0] * v[2], nz = u[0] * v[1] - u[1] * v[0], len = Math.hypot(nx, ny, nz);
      if (!(len > 0)) continue;
      // glTF is y-up: a wall face has a small y normal.
      if (/glass/i.test(name)) glass += len / 2;
      else if (Math.abs(ny) < 0.3 * len && WALL.test(name)) wall += len / 2;
    }
  }
  rows.push({ id: m.id, name: m.name, glassM2: Math.round(glass), wallM2: Math.round(wall), glassShare: +(glass / Math.max(1, glass + wall)).toFixed(3) });
}
rows.sort((a, b) => a.glassShare - b.glassShare);
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(rows, null, 1));
const under = rows.filter(r => r.glassShare < BLANK_INSTALL_MAX_GLASS_SHARE);
console.log(JSON.stringify({ models: rows.length, threshold: BLANK_INSTALL_MAX_GLASS_SHARE, under: under.length, lowest: under.slice(0, 40).map(r => `${r.id} ${r.glassShare} (${r.glassM2}/${r.wallM2} m2) ${r.name.slice(0, 60)}`) }, null, 1));
