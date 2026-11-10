// What a HouseSpec changes on the generic path, measured in Node on the game chain (house line H1 hand-back).
//   npx tsx scripts/house-specs/measure-generic-effect.ts [--dir=staging/house-specs]
// For every spec'd pand the generic path draws (no installed model hides it): the mesher's wall colour (photo look)
// with specs on vs off, and the street front's cell count with the spec's bays vs the building's own jittered bay
// (frontage = the footprint's longest edge on the side facing its nearest street is not known here, so the estimate
// uses the footprint's shorter bounding side, the street front of a terrace house).
import '../world/useBrowserMath.js';
import fs from 'node:fs';
import path from 'node:path';
import { EXTRACT, ROOT, gameChain, loadTile, readJson } from '../world/pipeline.ts';
import { meshBuildingFor } from '../../src/canalRecall/threeBuildingFeatures.ts';
import { frontageLayoutScale } from '../../src/canalRecall/streetFacadeRendering.ts';
import { STYLE_DIMS } from '../../src/canalRecall/facadeCells.ts';

const dir = process.argv.find(a => a.startsWith('--dir='))?.slice(6) ?? 'staging/house-specs';
const tiles: string[] = [];
const base = path.join(EXTRACT, dir, '14');
for (const x of fs.readdirSync(base)) for (const y of fs.readdirSync(path.join(base, x))) tiles.push(`${x}/${y.replace('.json.gz', '')}`);
const covers = readJson(path.join(ROOT, 'public/canal-drive/models/covers.json'));
const hidden = new Set<string>([...Object.values<any>(covers.models).flatMap(m => m.p ?? []), ...covers.buildingTypes].map(String));
process.env.HOUSE_SPECS = '0'; const off = gameChain();
process.env.HOUSE_SPECS = '1'; process.env.HOUSE_SPECS_DIR = dir; const on = gameChain();
const hash01 = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };
const n = { pands: 0, wall: 0, bays: 0, cellsChanged: 0, gable: 0 };
for (const tile of tiles.sort()) {
  const a = await loadTile(tile, off), b = await loadTile(tile, on);
  const byId = new Map(a.map(r => [String(r.raw.properties.id), r]));
  for (const r of b) {
    const id = String(r.raw.properties.id), v = r.raw.properties.houseSpec as any;
    if (!v || hidden.has(id.slice(-16))) continue;
    const o = byId.get(id); if (!o) continue;
    n.pands++;
    if (o.styled.properties.monumentGable !== r.styled.properties.monumentGable) n.gable++;
    const mo = meshBuildingFor(o.styled as any, 'photo' as any), mn = meshBuildingFor(r.styled as any, 'photo' as any);
    if (mo && mn && mo.wallHex !== mn.wallHex) n.wall++;
    if (mn?.specRecipe?.bays && mn.openings?.upper) {
      n.bays++;
      const ring = (r.raw.geometry.type === 'Polygon' ? r.raw.geometry.coordinates : r.raw.geometry.coordinates[0])[0] as number[][];
      const kx = 111320 * Math.cos(52.37 * Math.PI / 180), xs = ring.map(p => p[0] * kx), ys = ring.map(p => p[1] * 110540);
      const len = Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
      const own = 0.88 + hash01(`${mn.id}:bay`) * 0.3, dims = STYLE_DIMS[mn.style];
      const before = Math.max(1, Math.round(len / (dims.bay * own)));
      const s = frontageLayoutScale(undefined, { bay: own, storey: 1, ground: 1 }, mn.style, len, { bays: mn.specRecipe.bays, axesPerCell: mn.openings.upper.axes.length });
      const after = Math.max(1, Math.round(len / (dims.bay * s.bay)));
      if (before !== after) n.cellsChanged++;
    }
  }
}
console.log(JSON.stringify(n));
