// The held walls of the house-spec extract and what they draw (lane H9g, #345).
//   npx tsx scripts/house-specs/held-wall-audit.ts [--dir=house-specs] [--json]
// A pand is held when the pale-warm guard (wallColour.ts paleWarmHeld, via decorate.ts specWallColour) refuses its measured
// wall; it then keeps the period colour (bayLook.ts), measured here on the game chain with the photo look. Prints the held
// count, how many draw a grey/neutral wall, and the held brick pands that do (heldBrickWall must make that zero).
import '../world/useBrowserMath.js';
import fs from 'node:fs';
import path from 'node:path';
import { EXTRACT, ROOT, gameChain, loadTile, readJson } from '../world/pipeline.ts';
import { meshBuildingFor } from '../../src/canalRecall/threeBuildingFeatures.ts';
import { specWallColour, type HouseSpecView } from '../../src/canalRecall/houseSpec/decorate.ts';
import { wallColourFamily } from '../../src/canalRecall/houseSpec/wallColour.ts';

const dir = process.argv.find(a => a.startsWith('--dir='))?.slice(6) ?? 'house-specs';
process.env.HOUSE_SPECS = '1'; process.env.HOUSE_SPECS_DIR = dir;
const chain = gameChain();
const base = path.join(EXTRACT, dir, '14'), tiles: string[] = [];
for (const x of fs.readdirSync(base)) for (const y of fs.readdirSync(path.join(base, x))) tiles.push(`${x}/${y.replace('.json.gz', '')}`);
const covers = readJson(path.join(ROOT, 'public/canal-drive/models/covers.json'));
const hidden = new Set<string>([...Object.values<any>(covers.models).flatMap(m => m.p ?? []), ...covers.buildingTypes].map(String));
// decorate.ts `excluded`: measured fronts, kits and the large tier never take a spec wall.
const excluded = (p: Record<string, unknown>) => (p.appearanceStyleSource !== undefined && p.appearanceStyleSource !== 'citywide-identity-palette-v3-not-measured') || !!p.kitWall || !!p.largeTier;
const rows: { id: string; wall: string; family: string; material: string; finish: string; brick: boolean }[] = [];
for (const tile of tiles.sort()) {
  for (const r of await loadTile(tile, chain)) {
    const view = r.raw.properties.houseSpec as HouseSpecView | undefined, p = r.styled.properties;
    if (!view || !view.wallHex || excluded(p) || hidden.has(String(p.id).slice(-16)) || specWallColour(view, p) !== null) continue;
    const m = meshBuildingFor(r.styled as never, 'photo' as never);
    if (!m) continue;
    const finish = String(p.registerFinish ?? ''), material = String(view.wallMaterial ?? '');
    rows.push({ id: String(p.id), wall: m.wallHex, family: wallColourFamily(m.wallHex), material, finish, brick: material === 'brick' || (!material && finish === 'brick') });
  }
}
const grey = rows.filter(r => r.family.startsWith('neutral')), greyBrick = grey.filter(r => r.brick);
console.log(JSON.stringify({ held: rows.length, heldBrick: rows.filter(r => r.brick).length, greyAny: grey.length, greyBrick: greyBrick.length }));
if (process.argv.includes('--json')) console.log(JSON.stringify(rows));
else for (const r of grey) console.log(r.id.slice(-16), r.wall, r.family, r.material || '-', r.finish || '-');
