// Trace one pand's bay count end to end (house line H1b, #349): the extract's view, the mesher's cell scale, the
// layout's cell count and the drawn window columns, with the spec's bays forced on (SPEC_BAYS_HELD ignored).
//   npx tsx scripts/house-specs/trace-bays.ts <pand> [<pand>...]   (16-digit ids)
import '../world/useBrowserMath.js';
import fs from 'node:fs';
import path from 'node:path';
import { EXTRACT, gameChain, loadTile } from '../world/pipeline.ts';
import { meshBuildingFor } from '../../src/canalRecall/threeBuildingFeatures.ts';
import { frontageLayoutScale } from '../../src/canalRecall/streetFacadeRendering.ts';
import { layoutWall } from '../../src/canalRecall/facadeLayout.ts';
import { STYLE_DIMS } from '../../src/canalRecall/facadeCells.ts';

export const HELP = `trace-bays <pand>...  print source bays -> view -> axes per cell -> cells -> drawn columns for each pand`;
if (process.argv.includes('--help')) { console.log(HELP); process.exit(0); }
const wanted = process.argv.slice(2).filter(a => /^\d{16}$/.test(a));
process.env.HOUSE_SPECS = '1'; process.env.HOUSE_SPECS_DIR = 'house-specs';
const chain = gameChain();
const base = path.join(EXTRACT, 'house-specs', '14');
for (const x of fs.readdirSync(base)) for (const y of fs.readdirSync(path.join(base, x))) {
  for (const r of await loadTile(`${x}/${y.replace('.json.gz', '')}`, chain)) {
    const id = String(r.raw.properties.id);
    if (!wanted.includes(id.slice(-16))) continue;
    const view = r.raw.properties.houseSpec as { bays?: number } | undefined;
    const styled = { ...r.styled, properties: { ...r.styled.properties, specRecipe: view?.bays ? { bays: view.bays } : undefined } };
    const mb = meshBuildingFor(styled as never, 'photo' as never)!;
    const ring = (r.raw.geometry.type === 'Polygon' ? r.raw.geometry.coordinates : r.raw.geometry.coordinates[0])[0] as number[][];
    const kx = 111320 * Math.cos(52.37 * Math.PI / 180), xs = ring.map(p => p[0] * kx), ys = ring.map(p => p[1] * 110540);
    const len = Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    const axes = mb.openings?.upper?.axes.length ?? 1, dims = STYLE_DIMS[mb.style];
    const own = mb.layoutScale?.bay ?? 0.88 + 0.15; // fallback only used for the trace when the mesher stamps none
    const row = (spec: { bays: number; axesPerCell: number } | undefined) => {
      const s = frontageLayoutScale(mb.recipe, { bay: own, storey: 1, ground: 1 }, mb.style, len, spec);
      const l = layoutWall(mb.style, len, 12, 0.3, true, s)!;
      return { scaleBay: +s.bay.toFixed(3), cells: l.bays, drawnColumns: l.bays * axes };
    };
    console.log(JSON.stringify({ pand: id.slice(-16), specBays: view?.bays, style: mb.style, axesPerCell: axes, frontM: +len.toFixed(2), nominalBayM: dims.bay, without: row(undefined), with: view?.bays ? row({ bays: view.bays, axesPerCell: axes }) : null }));
  }
}
