/**
 * The front roof for a canal house compiled on its own (2026-11-10, belt-jordaan #366): `roof.source: front` and
 * `roof.hip` (RoofIntent) were only honoured by the block-face compile (blockFace/compile.ts `roofSourceFor`), so a
 * HouseSpec on the recipe route that said "only a dormer and a low slate slope behind the cornice" still drew the
 * 3DBAG saddle over the frieze (Bloemgracht 7, 0363100012173342). This replaces the 3DBAG roof with the forms the
 * front implies (blockFace/frontRoofSpecs.ts, blockFace/recipeRoof.ts), as the face does, before the fit.
 *
 * Opt-in and byte-identical when absent: a house without `roof.source: front` or `roof.hip`, and facts a face already
 * roofed (`facts.roofSource` set), come back unchanged. What the face adds and a lone house cannot know: the cornice
 * group's shared attic line (`ridgeCapM`), the row ridge and photo `frontRoof` hints (`PandRoofOptions`).
 *
 * `pandRoofFacts` is the one roof builder for both routes (2026-11-12, lane recipe-front-roof): the face compile's
 * per-pand closure moved here, so a lone house also gets the face's cross gables (`roof.crossGables`, and their
 * `CROSS_GABLE_BEHIND_M` attic setback) and the roof falling to a corner pand's side fronts and chamfer (`sideFronts`),
 * which the first single-house version left out.
 */
import type {BuildingFacts} from './facts.ts';
import {fitIntent, splitChain} from './fit.ts';
import type {CanalHouseIntent} from './intent.ts';
import {crossGablesOf, frontRoofSpecs, type FrontRoofHint} from '../blockFace/frontRoofSpecs.ts';
import {CROSS_GABLE_BEHIND_M, recipeRoofFacts, type RecipeRoofReport} from '../blockFace/recipeRoof.ts';

/** True when the single-house compile should roof this house from its front. */
export function wantsHouseFrontRoof(intent: CanalHouseIntent, facts: BuildingFacts): boolean {
  if (facts.roofSource) return false;
  if (intent.roof.source === '3dbag') return false;
  return intent.roof.source === 'front' || !!intent.roof.hip;
}

/** A gap this long between a corner pand's street fronts is a chamfer the roof falls to as well (sideFronts). */
const CHAMFER_MIN_M = 0.3, CHAMFER_MAX_M = 6;

/** What a block face adds to one pand's roof; the single-house route passes none of it. */
export interface PandRoofOptions {
  /** `frontRoof` hints per front id (a photo roof top and pitch for an attic band). */
  hints?: Record<string, FrontRoofHint>;
  /** The row's ridge line (rowCoherence), m above this pand's ground. */
  rowRidgeM?: number;
  /** Upper bound on the attic top (m above this pand's ground): the face's cornice group shares one attic line. */
  ridgeCapM?: number;
  /** The face's front pitch (`continuity.roof.pitchDeg`). */
  frontPitchDeg?: number;
}

/**
 * One pand's generated roof: fit once on the facts for the front eaves and storeys, then replace the 3DBAG roof
 * (blockFace/recipeRoof.ts); `front` bands take the form the street front implies (`frontRoofSpecs`).
 */
export function pandRoofFacts(intent: CanalHouseIntent, f: BuildingFacts, kind: 'recipe' | 'front', opts: PandRoofOptions = {}): {facts: BuildingFacts; report: RecipeRoofReport} {
  const fit = fitIntent(intent, f), f0 = fit.report.fronts[0];
  const pitch = opts.frontPitchDeg, ridgeCapM = opts.ridgeCapM, street = intent.fronts[0].street;
  const cross = crossGablesOf(intent, fit);
  const forms = kind === 'front' ? frontRoofSpecs(intent, fit, f, {...(opts.hints ? {hints: opts.hints} : {}), ...(opts.rowRidgeM !== undefined ? {rowRidgeM: opts.rowRidgeM} : {}), ...(Object.keys(cross).length ? {crossGables: cross} : {})}) : undefined;
  // Several fronts on the street (two houses in one pand, tower bays): each keeps its eaves (fit's own split).
  const same = intent.fronts.filter(fr => fr.street === street), ff = fit.facts.fronts.find(x => x.street === street);
  const ends = same.length > 1 && ff ? splitChain(ff, (() => { const sh = same.map(fr => fr.share ?? 1 / same.length), t = sh.reduce((a, b) => a + b, 0); return sh.map(x => x / t); })()).pairs : null;
  const fronts = ends ? same.map((fr, k) => ({id: fr.id, eavesM: fit.report.fronts.find(r => r.id === fr.id)!.eavesM, endpointsRD: ends[k], ...(fr.stepBody ? {body: true} : {}), ...(fr.dormers ? {dormers: true} : {})})) : undefined;
  // A corner pand's fronts on other streets: the roof falls to them too (recipeRoof `sideFronts`).
  const sideFronts = intent.fronts.filter(fr => fr.street && fr.street !== street).flatMap(fr => {
    const sf = fit.facts.fronts.find(x => x.street === fr.street), rf = fit.report.fronts.find(r => r.id === fr.id);
    if (!sf || !rf) return [];
    const side = {id: fr.id, eavesM: rf.eavesM, endpointsRD: sf.endpointsRD, outwardNormalRD: sf.outwardNormalRD};
    // A chamfered corner (Nassaukade 152: 2.3 m of footprint between the two fronts) falls too, at the lower eaves:
    // without it the two hips met over the chamfer and its closure rose as a 2 m brick gable at the corner.
    const pairs = ff ? ff.endpointsRD.flatMap(p => sf.endpointsRD.map(q => [p, q])) : [];
    const [p, q] = pairs.sort((x, y) => Math.hypot(x[0][0] - x[1][0], x[0][1] - x[1][1]) - Math.hypot(y[0][0] - y[1][0], y[0][1] - y[1][1]))[0] ?? [];
    const gap = p && q ? Math.hypot(q[0] - p[0], q[1] - p[1]) : 0;
    if (!ff || gap < CHAMFER_MIN_M || gap > CHAMFER_MAX_M) return [side];
    const sum = [ff.outwardNormalRD[0] + sf.outwardNormalRD[0], ff.outwardNormalRD[1] + sf.outwardNormalRD[1]];
    let n = [-(q[1] - p[1]) / gap, (q[0] - p[0]) / gap];
    if (n[0] * sum[0] + n[1] * sum[1] < 0) n = [-n[0], -n[1]];
    return [side, {id: `${fr.id}-chamfer`, eavesM: Math.min(rf.eavesM, f0.eavesM), endpointsRD: [p, q], outwardNormalRD: n}];
  });
  return recipeRoofFacts(fit.facts, {eavesM: f0.eavesM, storeyHeightsM: f0.storeyHeightsM, street, ridgeCapM, fronts, ...(forms ? {forms, frontId: intent.fronts[0].id} : {}), ...(intent.roof.squareSaddle ? {squareSaddle: true} : {}), ...(sideFronts.length ? {sideFronts} : {}),
    // Dormers stand 0.35 m behind the frontage (fit.ts): the attic face starts behind them, not through them. Cross gables
    // start behind their crown walls (CROSS_GABLE_BEHIND_M): the attic face rises from the same gutter line, so the
    // outline's millimetre wander about the frontage stays flat (a steep face rising from it closed in mm slivers).
    faceSetbackM: intent.fronts.some(fr => fr.street === intent.fronts[0].street && fr.dormers && fr.roofFront !== 'mansard') ? 0.4 : Object.keys(cross).length ? CROSS_GABLE_BEHIND_M : 0}, pitch ? {frontPitchDeg: pitch} : {});
}


/** The facts with the front roof in `roofsRD` (or the same object when the house does not ask for one). */
export function houseFrontRoofFacts(intent: CanalHouseIntent, facts: BuildingFacts): {facts: BuildingFacts; report?: RecipeRoofReport} {
  if (!wantsHouseFrontRoof(intent, facts)) return {facts};
  return pandRoofFacts(intent, facts, 'front');
}
