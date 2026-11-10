/**
 * The front roof for a recipe house compiled on its own (belt builder lanes 2026-11-10, Grachtengordel-West).
 *
 * A block face replaces a `front` pand's 3DBAG roof with one the street front implies (blockFace/compile.ts
 * `withRoofs`: a saddle under a gable's crown outline, a flat top behind a cornice, an attic band). A house on the
 * recipe route (`scripts/building-recipes/houses/<id>`, a HouseSpec's `toRecipe`) was compiled straight on its
 * facts.json, so the same intent drew 3DBAG's roof: a red pyramid or hip over Herengracht 92-96 and Keizersgracht 254/258's
 * cornices and red saddle ends beside Keizersgracht 256's neck, where the quay photo shows sky.
 *
 * `houseFrontRoof` runs the face's own front-roof step for one house: fit once on the 3DBAG facts, plan each street
 * band (`frontRoofSpecs`: `roof.form` forces one form, `rakeClear` keeps the saddle under the crown), and replace the
 * roof (`recipeRoofFacts`). It applies only when the intent says `roof.source: "front"` and the facts carry no
 * generated roof yet; every other house compiles on the very same facts (byte-identical). Pure.
 */
import type {BuildingFacts} from '../buildingRecipe/facts.ts';
import {fitIntent} from '../buildingRecipe/fit.ts';
import type {CanalHouseIntent} from '../buildingRecipe/intent.ts';
import {crossGablesOf, frontRoofSpecs} from './compile.ts';
import {CROSS_GABLE_BEHIND_M, recipeRoofFacts, type RecipeRoofReport} from './recipeRoof.ts';

/** Dormers stand 0.35 m behind the frontage (fit.ts): the attic face starts behind them (as blockFace/compile.ts). */
const DORMER_FACE_SETBACK_M = 0.4;

export function houseFrontRoof(intent: CanalHouseIntent, facts: BuildingFacts): {facts: BuildingFacts; report: RecipeRoofReport | null} {
  if (intent.roof.source !== 'front' || facts.roofSource) return {facts, report: null};
  const fit = fitIntent(intent, facts), f0 = fit.report.fronts[0], street = intent.fronts[0].street;
  const cross = crossGablesOf(intent, fit);
  const forms = frontRoofSpecs(intent, fit, facts, Object.keys(cross).length ? {crossGables: cross} : {});
  const dormers = intent.fronts.some(fr => fr.street === street && fr.dormers && fr.roofFront !== 'mansard');
  const made = recipeRoofFacts(fit.facts, {eavesM: f0.eavesM, storeyHeightsM: f0.storeyHeightsM, street, forms, frontId: intent.fronts[0].id,
    ...(intent.roof.squareSaddle ? {squareSaddle: true} : {}), faceSetbackM: dormers ? DORMER_FACE_SETBACK_M : Object.keys(cross).length ? CROSS_GABLE_BEHIND_M : 0});
  return {facts: made.facts, report: made.report};
}
