import { roofPlanForFeature, type RoofPlan } from './roofMesh.js';
import { admittedStreetAppearanceVisualClass, type StreetAppearanceProfile } from './streetAppearance.js';

type Feature = { type: 'Feature'; properties: Record<string, unknown>; geometry: unknown };
/** A reviewed, baked frontage may guide an unsurveyed procedural crown.
 * It never changes the native height, footprint, construction date or source facts.
 */
export function sourceVisualRoof<T extends Feature>(feature: T, profiles: readonly StreetAppearanceProfile[]): { feature: T; plan: RoofPlan } | undefined {
  const p = feature.properties;
  const geometry = feature.geometry as { type?: string; coordinates?: unknown[] };
  // A generic crown is withheld on open courts and multipart source geometry.
  if (geometry.type !== 'Polygon' || !geometry.coordinates || geometry.coordinates.length !== 1) return;
  if (!p.facade || p.kitWall || p.frontCarrier || p.facadeMappedColour || p.sideColourSource === 'measured-accepted') return;
  // Roof decoration marks generated eaves. Unmarked eaves and explicit tags remain authoritative.
  if (Number(p.roofEavesHeightM) > 0 && !p.roofPlanned || p.roofShapeTag || p.roofVertices || p.roofGeometry || p.roofHeightSource === 'measured-accepted') return;
  if (!p.roofPlanned && p.roofShape && p.roofShape !== 'flat') return;
  const id = String(p.id ?? '');
  const candidates = profiles.filter(admittedStreetAppearanceVisualClass);
  for (const profile of candidates) {
    const front = profile.frontages?.find(f => f.buildingId === id);
    if (!front) continue; // Complete source-cohort admission, never a tile-local guessed membership.
    const selected = profile.recipes[front.recipeIndex];
    if (!front.frontage || selected?.heightMin != null && Number(p.height) < selected.heightMin || selected?.heightMax != null && Number(p.height) > selected.heightMax) continue;
    if (selected?.frontageMin != null && front.frontage.widthM < selected.frontageMin || selected?.frontageMax != null && front.frontage.widthM > selected.frontageMax) continue;
    const recipe = selected?.recipe;
    if (!recipe?.crownShape) continue;
    const roofFeature = { ...feature, properties: { ...p, facadeStyle: 'canal', monumentGable: recipe.crownShape, roofPlanned: true } };
    const plan = roofPlanForFeature(roofFeature);
    if (!plan || plan.kind !== 'gable') continue;
    const eaves = Number(p.height) - plan.riseM;
    if (!Number.isFinite(eaves) || eaves < 4.5) continue;
    return { feature: { ...feature, properties: { ...p, roofPlanned: true, roofShape: plan.kind, roofEavesHeightM: eaves } }, plan };
  }
}
