/**
 * The front roof for a canal house compiled on its own (2026-11-10, belt-jordaan #366): `roof.source: front` and
 * `roof.hip` (RoofIntent) were only honoured by the block-face compile (blockFace/compile.ts `roofSourceFor`), so a
 * HouseSpec on the recipe route that said "only a dormer and a low slate slope behind the cornice" still drew the
 * 3DBAG saddle over the frieze (Bloemgracht 7, 0363100012173342). This replaces the 3DBAG roof with the forms the
 * front implies (blockFace/frontRoofSpecs.ts, blockFace/recipeRoof.ts), as the face does, before the fit.
 *
 * Opt-in and byte-identical when absent: a house without `roof.source: front` or `roof.hip`, and facts a face already
 * roofed (`facts.roofSource` set), come back unchanged. What the face adds and a lone house cannot know: the cornice
 * group's shared attic line (`ridgeCapM`), the row ridge, photo `frontRoof` hints, and the roof falling to a corner
 * pand's side fronts (`sideFronts`).
 */
import type {BuildingFacts} from './facts.ts';
import {fitIntent, splitChain} from './fit.ts';
import type {CanalHouseIntent} from './intent.ts';
import {frontRoofSpecs} from '../blockFace/frontRoofSpecs.ts';
import {recipeRoofFacts, type RecipeRoofReport} from '../blockFace/recipeRoof.ts';

/** True when the single-house compile should roof this house from its front. */
export function wantsHouseFrontRoof(intent: CanalHouseIntent, facts: BuildingFacts): boolean {
  if (facts.roofSource) return false;
  if (intent.roof.source === '3dbag') return false;
  return intent.roof.source === 'front' || !!intent.roof.hip;
}

/** The facts with the front roof in `roofsRD` (or the same object when the house does not ask for one). */
export function houseFrontRoofFacts(intent: CanalHouseIntent, facts: BuildingFacts): {facts: BuildingFacts; report?: RecipeRoofReport} {
  if (!wantsHouseFrontRoof(intent, facts)) return {facts};
  const fit = fitIntent(intent, facts), f0 = fit.report.fronts[0], street = intent.fronts[0].street;
  const forms = frontRoofSpecs(intent, fit, facts);
  // Several fronts on the street (two houses in one pand): each keeps its eaves, as in the face compile.
  const same = intent.fronts.filter(fr => fr.street === street), ff = fit.facts.fronts.find(x => x.street === street);
  const ends = same.length > 1 && ff ? splitChain(ff, (() => { const sh = same.map(fr => fr.share ?? 1 / same.length), t = sh.reduce((a, b) => a + b, 0); return sh.map(x => x / t); })()).pairs : null;
  const fronts = ends ? same.map((fr, k) => ({id: fr.id, eavesM: fit.report.fronts.find(r => r.id === fr.id)!.eavesM, endpointsRD: ends[k], ...(fr.stepBody ? {body: true} : {}), ...(fr.dormers ? {dormers: true} : {})})) : undefined;
  const out = recipeRoofFacts(fit.facts, {eavesM: f0.eavesM, storeyHeightsM: f0.storeyHeightsM, street, ...(fronts ? {fronts} : {}), forms, frontId: intent.fronts[0].id,
    ...(intent.roof.squareSaddle ? {squareSaddle: true} : {}),
    // Dormers stand 0.35 m behind the frontage (fit.ts): the attic face starts behind them (blockFace/compile.ts).
    faceSetbackM: intent.fronts.some(fr => fr.street === street && fr.dormers && fr.roofFront !== 'mansard') ? 0.4 : 0});
  return out;
}
