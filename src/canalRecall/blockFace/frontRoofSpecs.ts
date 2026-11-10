/**
 * The form of every street front band of a pand whose roof follows its front (`roof.source: front`, `roof.hip`): moved
 * out of blockFace/compile.ts (2026-11-10, belt-jordaan #366) so the single canal-house compile can use it without
 * the face compiler (GLB I/O, street chunks). blockFace/compile.ts re-exports everything here.
 */
import type {BuildingFacts} from '../buildingRecipe/facts.ts';
import type {CanalHouseIntent} from '../buildingRecipe/intent.ts';
import type {CanalhousePoint} from '../canalhouseRecipes.ts';
import {RAKE_CLEAR_M, saddleUnderProfile, type CrossGable, type FrontRoofSpec} from './recipeRoof.ts';
import {ROW_COHERENCE} from './rowCoherence.ts';

const cm = (v: number) => Math.round(v * 100) / 100;

/** How far a saddle's sides may drop under the cornice behind a crown that spans the whole front (m). */
export const SADDLE_FULL_FRONT_DROP_M = 3;

/**
 * Gables with curved flanks (`crownShoulder`) whose crown hides the roof behind it: the front view over the whole plot
 * stays under the outline, and the saddle may drop its sides `SADDLE_FULL_FRONT_DROP_M` under the cornice. Step, spout
 * and point crowns are not held yet: the front view finds bilder-081118-155417 156287/155418 with their attic faces
 * 2.3 m over the lower treads (the attic fallback of a saddle that would drop over a metre), a separate change.
 */
export const CURVED_GABLES = new Set(['neck', 'raised-neck', 'bell']);

export interface FrontRoofHint { topM?: number; pitchDeg?: number }

/**
 * The form of every street front band of a `front` pand (blockFace/recipeRoof.ts `FrontRoofSpec`): a saddle under a
 * gable's crown outline (`saddleUnderProfile`; an attic face when the saddle's side eaves would drop over a metre under
 * the cornice), an attic face behind dormers or a `frontRoof` hint (the hint's top row and pitch, no 3DBAG p95 cap),
 * and the 3DBAG-bounded attic for the rest; that one goes flat by itself when 3DBAG stands under a metre over the
 * eaves (a measured cornice says where the cornice is, not that nothing rises behind it: De Clercqstraat's parapets
 * hide 1.5 m of roof). A row ridge caps every attic band. `roof.form` on the house forces one form for all its bands;
 * `flat` is the only way to a flat band.
 */
export function frontRoofSpecs(intent: CanalHouseIntent, fit: {recipe: {elevations: {id: string; crown?: {value: {profile: CanalhousePoint[]}}}[]}; report: {fronts: {id: string; widthM: number; eavesM: number; storeyHeightsM?: number[]}[]}}, facts: BuildingFacts, opts: {hints?: Record<string, FrontRoofHint>; rowRidgeM?: number; crossGables?: Record<string, CrossGable[]>} = {}): Record<string, FrontRoofSpec> {
  const street = intent.fronts[0].street, forced = intent.roof.form, pitchOpt = intent.roof.pitchDeg, out: Record<string, FrontRoofSpec> = {};
  for (const fr of intent.fronts) {
    if (fr.street !== street) continue;
    const rf = fit.report.fronts.find(x => x.id === fr.id), el = fit.recipe.elevations.find(x => x.id === fr.id);
    if (!rf) continue;
    const gabled = !['cornice', 'flat'].includes(fr.gable), hint = opts.hints?.[fr.id], profile = el?.crown?.value.profile;
    let note: string | undefined;
    if (forced === 'saddle' || (!forced && gabled)) {
      if (intent.roof.hip === 'front' && !gabled && pitchOpt !== undefined) {
        // A saddle ridged front to back behind a cornice, hipped down to the eaves behind it (RoofIntent.hip): the ridge
        // from the pitch over half the front, capped (a flat top) by a hint's top or the row ridge; recipeRoof caps it by
        // the 3DBAG max as well.
        const capH = Math.min(hint?.topM ?? Infinity, opts.rowRidgeM !== undefined ? opts.rowRidgeM + ROW_COHERENCE.ridgeCapAboveM : Infinity);
        out[fr.id] = {form: 'saddle', hip: 'front', ridgeM: cm(rf.eavesM + Math.tan(pitchOpt * Math.PI / 180) * rf.widthM / 2), pitchDeg: pitchOpt, sideEavesM: rf.eavesM, ...(Number.isFinite(capH) ? {capM: cm(capH)} : {})};
        continue;
      }
      // A neck or bell crown over the whole front stands in front of the whole roof, so the saddle's sides may meet the party walls
      // under the cornice: concave neck/bell flanks hug the eaves line and only rise at the neck (2026-10-16), and a
      // saddle under them drops its sides 1-2.5 m. A crown on part of the front, and a step/spout/point crown, keep the 1 m limit.
      const fullFront = CURVED_GABLES.has(fr.gable) && !fr.crownAt && !fr.crownBays && !fr.crownGroups;
      const s = profile ? saddleUnderProfile(profile, rf.widthM, rf.eavesM, {...(pitchOpt !== undefined ? {pitchDeg: pitchOpt} : {}), ...(fullFront ? {maxDropM: SADDLE_FULL_FRONT_DROP_M} : {}), ...(intent.roof.rakeClear ? {clearM: RAKE_CLEAR_M} : {})}) : null;
      if (s) { out[fr.id] = {form: 'saddle', ridgeM: s.ridgeM, pitchDeg: s.pitchDeg, sideEavesM: s.sideEavesM, lineM: cm(Math.max(...profile!.map(p => p[1])))}; continue; }
      note = profile ? `saddle under the ${fr.gable} crown would drop its side eaves over ${fullFront ? SADDLE_FULL_FRONT_DROP_M + ' m' : 'a metre'} under the cornice (a crown on part of the front); attic face instead` : `no crown outline on the ${fr.gable} front; attic face instead`;
    }
    if (forced === 'flat') { out[fr.id] = {form: 'flat', lineM: rf.eavesM, ...(note ? {note} : {})}; continue; }
    const capM = Math.min(hint?.topM ?? Infinity, opts.rowRidgeM !== undefined ? opts.rowRidgeM + ROW_COHERENCE.ridgeCapAboveM : Infinity);
    const cross = opts.crossGables?.[fr.id];
    out[fr.id] = {form: 'attic', ...(hint?.pitchDeg !== undefined ? {pitchDeg: hint.pitchDeg} : pitchOpt !== undefined ? {pitchDeg: pitchOpt} : {}), ...(Number.isFinite(capM) ? {capM: cm(capM)} : {}), surveyCap: !hint, ...(note ? {note} : {}),
      ...(intent.roof.rise !== undefined ? {riseM: cm(intent.roof.rise * (rf.storeyHeightsM?.at(-1) ?? 3))} : {}), ...(intent.roof.rearPitchDeg !== undefined ? {rearPitchDeg: intent.roof.rearPitchDeg} : {}), ...(cross?.length ? {crossGables: cross} : {})};
  }
  return out;
}
