/**
 * `roof.form` and `roof.source: 'front'` for a canal-house intent compiled on its own (the recipe route of the house line,
 * docs/house-line.md; belt lane Haarlemmerbuurt, #356).
 *
 * Block faces already generate the roof from the street front (compile.ts `roofSourceFor` -> `frontRoofSpecs` ->
 * recipeRoof.ts `recipeRoofFacts`): 3DBAG keeps the footprint and an upper bound. A house compiled alone
 * (buildingRecipe/compile.ts `compileBuilding`) read neither field and drew 3DBAG's roof behind its crown: Haarlemmerdijk 6
 * (176172) stood a 3DBAG hip over a cream cornice where the strip shows sky (roof max 11.84 m over a 10.9 m cornice).
 *
 * `withFrontRoof` runs that same generation for one house: when the intent asks for it (`roof.source: 'front'`, or a forced
 * `roof.form`) and the facts carry no generated roof yet, the facts' roof surfaces are replaced by the front-derived ones
 * and `roofSource` marks them (the fit then skips roofCleanup). Without either field, or with `roof.source: '3dbag'`, or
 * when the facts already carry a `roofSource`, the facts come back as the same object: byte-identical.
 */
import type {BuildingFacts} from '../buildingRecipe/facts.ts';
import {fitIntent} from '../buildingRecipe/fit.ts';
import type {CanalHouseIntent} from '../buildingRecipe/intent.ts';
import {frontRoofSpecs} from './compile.ts';
import {recipeRoofFacts} from './recipeRoof.ts';

/** Whether the intent asks for a front-derived roof. */
export const wantsFrontRoof = (intent: CanalHouseIntent): boolean => intent.roof.source !== '3dbag' && (intent.roof.source === 'front' || intent.roof.form !== undefined);

/** `FrontIntent.eavesHeight` -> `facts.measuredEavesM[front.id]` where the facts carry none; no front states one = the same facts. */
export function withMeasuredEaves(intent: CanalHouseIntent, facts: BuildingFacts): BuildingFacts {
  const own = intent.fronts.filter(f => f.eavesHeight !== undefined && facts.measuredEavesM?.[f.id] === undefined);
  if (!own.length) return facts;
  return {...facts, measuredEavesM: {...(facts.measuredEavesM ?? {}), ...Object.fromEntries(own.map(f => [f.id, f.eavesHeight!]))}};
}

export function withFrontRoof(intent: CanalHouseIntent, facts: BuildingFacts): BuildingFacts {
  if (facts.roofSource || !wantsFrontRoof(intent)) return withMeasuredEaves(intent, facts);
  facts = withMeasuredEaves(intent, facts);
  const fit = fitIntent(intent, facts), f0 = fit.report.fronts[0], street = intent.fronts[0].street;
  const forms = frontRoofSpecs(intent, fit, fit.facts);
  return recipeRoofFacts(fit.facts, {
    eavesM: f0.eavesM, storeyHeightsM: f0.storeyHeightsM, street, forms, frontId: intent.fronts[0].id,
    ...(intent.roof.squareSaddle ? {squareSaddle: true} : {}),
    faceSetbackM: intent.fronts.some(fr => fr.street === street && fr.dormers && fr.roofFront !== 'mansard') ? 0.4 : 0,
  }).facts;
}
