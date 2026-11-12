/**
 * Wall-colour trace (lane wall-colour-truth, 2026-11-12): for each pand, the wall colour at every step the generic path
 * takes, in Node, under the flags in force (SPEC_WALLS=0|1, BRICK_LIFT=v1|v2):
 *   spec extract reading (p.houseSpec.wallHex) -> decorate (specRecipe.wallHex | heldBrick) -> meshBuildingFor
 *   (bay/period wall, sourced wall, final MeshBuilding.wallHex) -> the vertex tint the generic mesher writes.
 *   node --import tsx scripts/house-frames/trace-wall.ts <pandId,...>   (JSON lines on stdout)
 */
import { PreviewSession } from '../house-preview/preview.ts';
import { meshBuildingFor } from '../../src/canalRecall/threeBuildingFeatures.ts';
import { specWallsOn } from '../../src/canalRecall/houseSpec/wallColour.ts';
import { brickLiftOn } from '../../src/canalRecall/look/brickLift.ts';

const ids = (process.argv[2] ?? '').split(',').filter(Boolean);
const session = new PreviewSession('photo');
for (const id of ids) {
  const rows = await session.rows(session.tileOf(id));
  const row = rows.find(r => String(r.raw.properties?.id ?? '').endsWith(id));
  if (!row) { console.log(JSON.stringify({ id, error: 'no row' })); continue; }
  const p = row.styled.properties as Record<string, any>, raw = row.raw.properties as Record<string, any>;
  const b = meshBuildingFor(row.styled as any, 'photo');
  console.log(JSON.stringify({
    id, specWalls: specWallsOn(), brickLift: brickLiftOn() ? 'v2' : 'v1',
    year: p.constructionYear, registerFinish: p.registerFinish, style: p.facadeStyle,
    specReading: raw.houseSpec?.wallHex ?? p.houseSpec?.wallHex ?? null, specMaterial: p.houseSpec?.wallMaterial ?? null, specFamily: p.houseSpec?.wallFamily ?? null, specSrc: p.houseSpec?.src?.wallHex ?? null,
    specRecipeWall: p.specRecipe?.wallHex ?? null, heldBrick: !!p.specRecipe?.heldBrick,
    facadeMappedColour: p.facadeMappedColour ?? null, sideColour: p.sideColour ?? null, sideColourSource: p.sideColourSource ?? null, materialPrior: p.facadeMaterialColourPrior ?? null, periodWallHex: p.periodWallHex ?? null,
    meshWall: b?.wallHex ?? null, accent: b?.accentHex ?? null, style2: b?.style, recipe: !!b?.recipe,
  }));
}
