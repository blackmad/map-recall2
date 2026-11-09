// Citywide step-0 measure (#316): of the pands monument-gables.json names a gable for, how many does the game chain
// roof with a planned roof (and which kind), and how many fall to a flat lid / parapet.
//   npx tsx scripts/register-facts/measure-gable-routing.ts [--ids]
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { gameChain, loadTile } from '../world/pipeline.ts';
import { tileKeyAt } from '../../src/canalRecall/galleryPipeline.ts';
import { roofPlanForFeature } from '../../src/canalRecall/roofMesh.ts';

const gables = JSON.parse(readFileSync('public/data/extracts/amsterdam/monument-gables.json', 'utf8')).buildings as Record<string, string>;
const snap = JSON.parse(gunzipSync(readFileSync('scripts/data/amsterdam-monument-register/records.json.gz')).toString('utf8'));
const tiles = new Set<string>();
for (const r of snap.rce) for (const l of r.locations) { const m = /Point\s*\(\s*([\d.]+)\s+([\d.]+)/i.exec(l.value); if (m) tiles.add(tileKeyAt(Number(m[1]), Number(m[2]))); }
const chain = gameChain();
const seen = new Set<string>(), out: Record<string, number> = {}, flatIds: string[] = [];
for (const tile of [...tiles].sort()) {
  for (const row of await loadTile(tile, chain)) {
    const id = String(row.raw.properties.id);
    if (!gables[id] || seen.has(id)) continue;
    seen.add(id);
    const p = row.styled.properties as Record<string, unknown>;
    const kind = !p.facade ? 'noFacade(landmark/kit)' : p.kitRoof ? 'kitRoof' : !p.roofPlanned ? 'unplanned' : String(p.roofShape);
    const key = `${gables[id]}:${kind}`;
    out[key] = (out[key] ?? 0) + 1;
    if (kind === 'unplanned' || kind === 'parapet') flatIds.push(id);
    void roofPlanForFeature;
  }
}
const total = seen.size, flat = flatIds.length;
console.log(JSON.stringify({ registerGablePands: Object.keys(gables).length, inLoadedTiles: total, flatOrParapet: flat, byGableAndRoof: Object.fromEntries(Object.entries(out).sort()) }, null, 1));
if (process.argv.includes('--ids')) console.log(flatIds.join('\n'));
