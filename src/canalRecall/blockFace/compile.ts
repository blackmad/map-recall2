/**
 * Block-face compile: face intent + per-pand facts → ONE chunk GLB (via
 * streetChunks: party walls dropped by construction, exposed walls above lower
 * neighbours kept, per-pand ranges in extras) plus gates measured on the
 * decoded GLB and interference checks along every party line.
 *
 * Face-level continuity comes from the intent, not from heuristics: one street
 * level, and the cornice groups the author read off the photo set the eaves
 * lines (snapped to the group median when 3DBAG agrees within `maxGroupSpreadM`;
 * otherwise left as surveyed and reported, because photo and survey disagree).
 */
import {NodeIO} from '@gltf-transform/core';
import * as T from 'three';
import {KHRMeshQuantization} from '@gltf-transform/extensions';
import type {BuildingFacts} from '../buildingRecipe/facts.ts';
import {pointInRing, trustFactsGround} from '../buildingRecipe/facts.ts';
import type {TerrainAt} from '../bag3dCityJson.ts';
import {fitIntent, splitChain} from '../buildingRecipe/fit.ts';
import type {CompiledBuilding} from '../buildingRecipe/compile.ts';
import {BUDGET_TRIANGLES} from '../buildingRecipe/gates.ts';
import {ringToFrame, type FrontFrame} from '../buildingRecipe/instances.ts';
import {compileChunk, chunkFrame} from '../streetChunks/compileChunk.ts';
import {findContacts} from '../streetChunks/party.ts';
import {fitEaves, shiftFactsHeights} from '../streetChunks/ground.ts';
import type {ChunkResult} from '../streetChunks/types.ts';
import {houseIntents, rigidCanopyFront, type BlockFaceIntent} from './intent.ts';
import type {CanalHouseIntent} from '../buildingRecipe/intent.ts';
import {addInferredRear, type RearReport} from './rear.ts';
import {planInstancing, type FitSize, type InstancingPlan} from './instancing.ts';
import {applyPhotoCrowns, facePhotoPatches, type PhotoCrownPatch, type PhotoGable} from './gableFromStrip.ts';
import {recipeRoofFacts, saddleUnderProfile, type FrontRoofSpec, type RecipeRoofReport} from './recipeRoof.ts';
import {clampRoofVertices, findRows, rowClampFor, rowLines, ROW_COHERENCE, type RowClamp, type RowMember} from './rowCoherence.ts';
import {roofHeightAt} from '../buildingRecipe/facts.ts';
import type {CanalhousePoint} from '../canalhouseRecipes.ts';

export interface FaceGate { pand: string; id: string; pass: boolean; value: unknown; limit: string }
export interface Interference {
  left: string; right: string;
  /** Facade ends along the street: + gap, - overlap (m). */
  frontGapM: number;
  frontDepthStepM: number;
  /** Area (m2, plan-projected triangle area) of one house's geometry inside the other's footprint, beyond 5 cm. */
  penetrationM2: {leftIntoRight: number; rightIntoLeft: number};
  /** Street-side details (cornices, sills, balconies, signs) of one house that reach > 3 cm past the party line. */
  detailOverhangM: {left: number; right: number};
  /** Coplanar, same-facing overlapping faces of the two houses (z-fighting), m2. */
  zFightM2: number;
  /** The same for roof planes (seen from above only). */
  roofZFightM2: number;
  /** Eaves step left → right after alignment, and whether the photo supports it (same cornice group ⇒ ~0). */
  eavesStepM: number;
  sameCorniceGroup: boolean;
  corniceVerdict: 'aligned' | 'step-supported' | 'step-not-supported' | 'missing-step';
  pass: boolean;
}
export interface FaceGroundPlan { sharedNapM: number; shiftsM: number[]; eavesBefore: number[]; eavesAfter: number[]; groups: {pands: string[]; spreadM: number; snapped: boolean; trust?: 'photo'; reference?: string}[]; facts: BuildingFacts[];
  /** Photo-measured eaves (continuity.measuredEaves) per pand: front id -> metres above the shared street level. */
  measured?: Record<string, Record<string, number>>;
  /** Row coherence (blockFace/rowCoherence.ts): every member the row line or ridge clamped, and why. */
  rowClamps?: RowClamp[] }
/** The strip's vertical scale (strip.json): pixel rows to metres above the strip's ground line. */
export interface StripScale { heightPx: number; pixelsPerMetre: number; groundNAP: number }
export interface BlockFaceResult {
  /** Roofs generated from the recipe or the front (`roofSourceFor`), per pand; pands that kept 3DBAG are absent. */
  recipeRoofs?: RecipeRoofReport[];
  /** Row coherence: every member the row line or ridge clamped. */
  rowClamps?: RowClamp[];
  /** Crowns taken from the photo (`continuity.crownFromPhoto`): applied patches and fronts that kept their authored crown. */
  photoCrowns?: {patches: PhotoCrownPatch[]; kept: {pand: string; front: string; why: string}[]};
  instancing: InstancingPlan; slitsClosed: {left: string; right: string; gapM: number}[]; frontSnaps: FrontSnap[]; rears: RearReport[]; chunk: ChunkResult; ground: FaceGroundPlan; gates: FaceGate[]; interference: Interference[]; perPand: {pand: string; slug: string; triangles: number; eavesM: number; roofMaxM: number; roofMaxFactsM: number; storeyHeightsM: number[]; fronts: {id: string; widthM: number; eavesM: number; storeyHeightsM: number[]}[]}[]; passed: boolean }

const median = (v: number[]) => { const s = [...v].sort((a, b) => a - b); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };
const cm = (v: number) => Math.round(v * 100) / 100;

/** One street level (median ground, shifts <= 1 m) and the intent's cornice groups. */
export function planFaceGround(face: BlockFaceIntent, facts: BuildingFacts[], maxGroupSpreadM = 0.8, strip?: StripScale, extras: {
  /** Photo skyline eaves per pand (m above the pand's ground), a row member's confirmation that it really stands off the row line. */
  skylineEavesM?: Map<string, number>} = {}): FaceGroundPlan {
  const sharedNapM = cm(median(facts.map(f => f.heights.groundNAP)));
  const forced = new Set(face.continuity.streetLevelPands?.pands ?? []);
  const shiftsM = facts.map(f => { const d = f.heights.groundNAP - sharedNapM; return face.continuity.streetLevel === 'shared' && (Math.abs(d) <= 1 || forced.has(f.pandId)) ? cm(d) : 0; });
  const grounded = facts.map((f, i) => shiftsM[i] ? shiftFactsHeights(f, shiftsM[i], sharedNapM) : f);
  const eavesBefore = grounded.map(fitEaves), eavesAfter = [...eavesBefore];
  const index = new Map(face.houses.map((h, i) => [h.pandId, i]));
  const groups = face.continuity.corniceGroups.map(g => {
    const ids = g.pands.map(p => index.get(p)!), vals = ids.map(i => eavesBefore[i]), spreadM = cm(Math.max(...vals) - Math.min(...vals));
    const photo = g.trust === 'photo' && g.reference !== undefined;
    const snapped = ids.length > 1 && spreadM <= (photo ? 2.5 : maxGroupSpreadM);
    if (snapped) { const t = photo ? eavesBefore[index.get(g.reference!)!] : cm(median(vals)); for (const i of ids) eavesAfter[i] = t; }
    return {pands: g.pands, spreadM, snapped, ...(photo ? {trust: 'photo' as const, reference: g.reference} : {})};
  });
  const out = grounded.map((f, i) => {
    const d = eavesAfter[i] - eavesBefore[i];
    return d ? {...f, fronts: f.fronts.map(fr => ({...fr, eavesM: fr.eavesM + d, topProfile: fr.topProfile.map(p => ({...p, heightM: p.heightM + d}))}))} : f;
  });
  // Photo-measured eaves: strip row -> metres above the strip ground -> metres above this pand's (shifted) ground.
  const measuredList = face.continuity.measuredEaves ?? [];
  if (measuredList.length && !strip) throw Error('continuity.measuredEaves needs the strip scale (strip.json)');
  const intents = houseIntents(face), measured: Record<string, Record<string, number>> = {};
  for (const m of measuredList) {
    const i = index.get(m.pand)!, aboveStrip = (strip!.heightPx - m.stripRow) / strip!.pixelsPerMetre;
    const value = cm(aboveStrip + strip!.groundNAP - facts[i].heights.groundNAP + shiftsM[i]);
    for (const fr of intents[i].fronts) if (m.front === undefined || m.front === fr.id) (measured[m.pand] ??= {})[fr.id] = value;
  }
  // Row coherence: a typed row's cornice is one line and its roof one ridge (blockFace/rowCoherence.ts). Runs after the
  // cornice groups (a member's line is its group's) and before the explicit measurements, which always win.
  const rowClamps: RowClamp[] = [], rowed = [...out];
  if (face.continuity.rowCoherence !== false) {
    const thresholdM = face.continuity.rowCoherence?.thresholdM ?? ROW_COHERENCE.thresholdM;
    const rows = findRows(face.houses.map((h, i) => ({pandId: h.pandId, typeId: h.type?.type, builtYear: grounded[i].heights.builtYear})));
    for (const row of rows) {
      const members: RowMember[] = row.map(i => {
        // Each street front's own fitted eaves (modules of one pand read their own stretch of the 3DBAG profile).
        const street = intents[i].fronts[0].street, fit = fitIntent(intents[i], out[i]).report;
        const frontEavesM = Object.fromEntries(intents[i].fronts.filter(fr => fr.street === street).map(fr => [fr.id, fit.fronts.find(x => x.id === fr.id)?.eavesM ?? eavesAfter[i]]));
        return {i, pandId: face.houses[i].pandId, eavesM: eavesAfter[i], frontEavesM, stripEavesM: measured[face.houses[i].pandId]?.[intents[i].fronts[0].id], ridgeM: out[i].heights.ridgeM, roofMaxM: out[i].heights.roofMaxM, skylineEavesM: extras.skylineEavesM?.get(face.houses[i].pandId)};
      });
      const lines = rowLines(members, thresholdM), rowId = `${face.houses[row[0]].type!.type} ${m6(face.houses[row[0]].pandId)}..${m6(face.houses[row.at(-1)!].pandId)}`;
      for (const m of members) {
        const clamp = rowClampFor(m, lines, rowId, {thresholdM});
        if (!clamp) continue;
        let f = rowed[m.i];
        if (clamp.fronts) {
          const mine: Record<string, number> = Object.fromEntries(Object.entries(clamp.fronts).map(([id, c]) => [id, c.to]));
          measured[m.pandId] = {...(measured[m.pandId] ?? {}), ...mine};
          if (mine[intents[m.i].fronts[0].id] !== undefined) eavesAfter[m.i] = mine[intents[m.i].fronts[0].id];
          f = {...f, measuredEavesM: {...(f.measuredEavesM ?? {}), ...mine}};
        }
        if (clamp.ridgeM) f = clampRoofVertices(f, clamp.ridgeM.to);
        rowed[m.i] = {...f, rowClamp: clamp};
        rowClamps.push(clamp);
      }
    }
  }
  if (!measuredList.length && !rowClamps.length) return {sharedNapM, shiftsM, eavesBefore, eavesAfter, groups, facts: out};
  const withMeasured = rowed.map((f, i) => {
    const mine = measured[face.houses[i].pandId];
    if (!mine) return f;
    for (const pitch of measuredList.filter(m => m.pand === face.houses[i].pandId && m.frontRoof)) {
      const row = (r: number) => strip!.groundNAP + (strip!.heightPx - r) / strip!.pixelsPerMetre, fr = pitch.frontRoof!;
      const fronts = intents[i].fronts, k = pitch.front === undefined ? 0 : fronts.findIndex(x => x.id === pitch.front), value = mine[fronts[k].id];
      // One front of several: re-pitch only along its stretch of the frontage (the fit's own split of the chain).
      let along: [number, number] | undefined;
      if (fronts.length > 1) {
        const ff = f.fronts[0], shares = fronts.map(x => x.share ?? 1 / fronts.length), cut = splitChain(ff, shares.map(x => x / shares.reduce((t, y) => t + y, 0))), [p0] = ff.endpointsRD, wv = [ff.endpointsRD[1][0] - p0[0], ff.endpointsRD[1][1] - p0[1]], wl = Math.hypot(wv[0], wv[1]);
        const at = (q: number[]) => ((q[0] - p0[0]) * wv[0] + (q[1] - p0[1]) * wv[1]) / wl;
        along = [at(cut.pairs[k][0]), at(cut.pairs[k][1])];
      }
      // The survey roof must stand clear above the measured eaves at the facade (a mansard top, a dormer, or a ridge run out
      // to the front: Bilderdijkstraat 199, ridge end 18.8 m over a 15.9 m cornice), else there is nothing to re-pitch.
      const ff0 = f.fronts[0], [q0] = ff0.endpointsRD, nq = ff0.outwardNormalRD, onFront = (v: number[]) => Math.abs((v[0] - q0[0]) * nq[0] + (v[1] - q0[1]) * nq[1]) <= 0.05;
      const facadeTop = Math.max(...f.roofsRD.flatMap(r => r.vertices).filter(onFront).map(v => v[2] - f.heights.groundNAP));
      if (!(facadeTop > value + 0.5)) throw Error(`${m6(face.houses[i].pandId)}: frontRoof needs survey roof above the measured eaves at the facade; roof ${cm(facadeTop)} m vs eaves ${value} m`);
      // The eaves in this pand's own height datum (the fit reads roof heights above heights.groundNAP), rounded as the fit rounds it.
      f = repitchFrontRoof(f, value + f.heights.groundNAP, {topNap: fr.topRow === undefined ? undefined : row(fr.topRow), pitchDeg: fr.pitchDeg, along});
    }
    // The first front's line drives the party-line eaves verdicts.
    eavesAfter[i] = mine[intents[i].fronts[0].id] ?? eavesAfter[i];
    return {...f, measuredEavesM: {...(f.measuredEavesM ?? {}), ...mine}};
  });
  return {sharedNapM, shiftsM, eavesBefore, eavesAfter, groups, facts: withMeasured, measured, ...(rowClamps.length ? {rowClamps} : {})};
}

export type RoofSourceKind = 'survey' | 'recipe' | 'front';

/**
 * Where one pand's roof comes from. The house says so (`roof.source`: `3dbag` keeps LoD2.2, `front` follows the
 * front), a `keepSurvey` entry keeps LoD2.2, and otherwise the roof follows the front as soon as a street front
 * carries a measured crown: a gable (the crown outline was read off the strip when the house was typed) or a measured
 * eaves line (strip or row). Cornice fronts, capped or plain, keep the face rule (a wide cap is a parapet on De
 * Clercqstraat and a cornice band under a steep roof elsewhere; the parapet alone says nothing about the roof).
 */
export function roofSourceFor(intent: CanalHouseIntent, facts: BuildingFacts, faceRule: 'recipe' | 'survey', keepSurvey: Set<string> = new Set()): RoofSourceKind {
  if (intent.roof.source === '3dbag') return 'survey';
  if (intent.roof.source === 'front') return 'front';
  if (keepSurvey.has(intent.pandId)) return 'survey';
  const street = intent.fronts[0].street;
  const measuredCrown = intent.fronts.some(fr => fr.street === street && (!['cornice', 'flat'].includes(fr.gable) || facts.measuredEavesM?.[fr.id] !== undefined));
  return measuredCrown ? 'front' : faceRule;
}

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
export function frontRoofSpecs(intent: CanalHouseIntent, fit: {recipe: {elevations: {id: string; crown?: {value: {profile: CanalhousePoint[]}}}[]}; report: {fronts: {id: string; widthM: number; eavesM: number}[]}}, facts: BuildingFacts, opts: {hints?: Record<string, FrontRoofHint>; rowRidgeM?: number} = {}): Record<string, FrontRoofSpec> {
  const street = intent.fronts[0].street, forced = intent.roof.form, pitchOpt = intent.roof.pitchDeg, out: Record<string, FrontRoofSpec> = {};
  for (const fr of intent.fronts) {
    if (fr.street !== street) continue;
    const rf = fit.report.fronts.find(x => x.id === fr.id), el = fit.recipe.elevations.find(x => x.id === fr.id);
    if (!rf) continue;
    const gabled = !['cornice', 'flat'].includes(fr.gable), hint = opts.hints?.[fr.id], profile = el?.crown?.value.profile;
    let note: string | undefined;
    if (forced === 'saddle' || (!forced && gabled)) {
      const s = profile ? saddleUnderProfile(profile, rf.widthM, rf.eavesM, pitchOpt !== undefined ? {pitchDeg: pitchOpt} : {}) : null;
      if (s) { out[fr.id] = {form: 'saddle', ridgeM: s.ridgeM, pitchDeg: s.pitchDeg, sideEavesM: s.sideEavesM, lineM: cm(Math.max(...profile!.map(p => p[1])))}; continue; }
      note = profile ? `saddle under the ${fr.gable} crown would drop its side eaves over a metre under the cornice (a crown on part of the front); attic face instead` : `no crown outline on the ${fr.gable} front; attic face instead`;
    }
    if (forced === 'flat') { out[fr.id] = {form: 'flat', lineM: rf.eavesM, ...(note ? {note} : {})}; continue; }
    const capM = Math.min(hint?.topM ?? Infinity, opts.rowRidgeM !== undefined ? opts.rowRidgeM + ROW_COHERENCE.ridgeCapAboveM : Infinity);
    out[fr.id] = {form: 'attic', ...(hint?.pitchDeg !== undefined ? {pitchDeg: hint.pitchDeg} : pitchOpt !== undefined ? {pitchDeg: pitchOpt} : {}), ...(Number.isFinite(capM) ? {capM: cm(capM)} : {}), surveyCap: !hint, ...(note ? {note} : {})};
  }
  return out;
}

/** Highest crown outline value at x (vertical risers take their upper end). */
function profileAt(profile: CanalhousePoint[], x: number): number {
  let h = -Infinity;
  for (let i = 1; i < profile.length; i++) {
    const [x0, y0] = profile[i - 1], [x1, y1] = profile[i];
    if (x < Math.min(x0, x1) - 1e-6 || x > Math.max(x0, x1) + 1e-6) continue;
    h = Math.max(h, Math.abs(x1 - x0) < 1e-9 ? Math.max(y0, y1) : y0 + (y1 - y0) * (x - x0) / (x1 - x0));
  }
  return h;
}

/**
 * How far the roof stands above the crown outline along the facade line of every street front (m; negative = under),
 * sampled every 0.1 m, 5 cm inside the frontage. The `roof-under-crown` gate for front roofs.
 */
export function roofAboveCrown(intent: CanalHouseIntent, fit: {recipe: {elevations: {id: string; polygonIndex: number; edgeIndex: number; endEdgeIndex?: number; crown?: {value: {profile: CanalhousePoint[]}}; bodyEavesM?: {value: number}}[]; footprint: {value: {outer: CanalhousePoint[]}[]}; house: {eavesHeightM: {value: number}}}; anchorRD: [number, number]}, facts: BuildingFacts): number {
  const street = intent.fronts[0].street, n = facts.fronts[0].outwardNormalRD, nl = Math.hypot(n[0], n[1]) || 1, inward = [-n[0] / nl, -n[1] / nl];
  let worst = -Infinity;
  for (const el of fit.recipe.elevations) {
    const fr = intent.fronts.find(f => f.id === el.id);
    if (!fr || fr.street !== street) continue;
    const ring = fit.recipe.footprint.value[el.polygonIndex].outer, a = ring[el.edgeIndex], b = ring[el.endEdgeIndex ?? (el.edgeIndex + 1) % ring.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
    const eaves = el.bodyEavesM?.value ?? fit.recipe.house.eavesHeightM.value, profile = el.crown?.value.profile ?? [[0, eaves], [len, eaves]] as CanalhousePoint[];
    for (let x = 0.05; x < len - 0.05; x += 0.1) {
      // 5 mm inside the facade line: an attic face rising at 72 degrees gains 1.5 cm there, within the gate's 3 cm.
      const lx = a[0] + u[0] * x, lz = a[1] + u[1] * x, p = [fit.anchorRD[0] + lx + inward[0] * 0.005, fit.anchorRD[1] - lz + inward[1] * 0.005];
      const h = roofHeightAt(facts.roofsRD, p, facts.heights.groundNAP);
      if (h === null) continue;
      worst = Math.max(worst, h - profileAt(profile, x));
    }
  }
  return worst;
}

const m6 = (p: string) => p.slice(-6);

/**
 * The roof behind a photo-measured cornice that sits BELOW 3DBAG's eaves. LoD2.2 carries the flat (or dormer-raised) top
 * of a mansard roof out to the facade line, so the fit's eaves read 2.5-3.5 m above the cornice (Bilderdijkstraat 133,
 * 145, 147, 153). Every roof surface with a vertex on the frontage line is split at depth d = (top - eaves) / tan(pitch):
 * the front strip becomes a steep roof face rising from the measured eaves (NAP) at the facade to the surface's own height
 * at d; the rest keeps the survey heights. `topNap` (the photo's roof top beside a dormer) first caps those surfaces, for a
 * dormer that 3DBAG merged into the roof. The shell top (lowest roof vertex) then falls to the eaves.
 */
export function repitchFrontRoof(f: BuildingFacts, eavesNap: number, opts: {topNap?: number; pitchDeg?: number; tolM?: number; along?: [number, number]} = {}): BuildingFacts {
  const out = structuredClone(f), fr = out.fronts[0], [a, b] = fr.endpointsRD, n = fr.outwardNormalRD, tol = opts.tolM ?? 0.05;
  const tan = Math.tan((opts.pitchDeg ?? 72) * Math.PI / 180), w = Math.hypot(b[0] - a[0], b[1] - a[1]), u = [(b[0] - a[0]) / w, (b[1] - a[1]) / w];
  const depth = (v: number[]) => -((v[0] - a[0]) * n[0] + (v[1] - a[1]) * n[1]);
  // Metres along the frontage from its first (viewer's left) endpoint; `along` limits the re-pitch to one front of a pand.
  const alongOf = (v: number[]) => (v[0] - a[0]) * u[0] + (v[1] - a[1]) * u[1];
  const [a0, a1] = opts.along ?? [-Infinity, Infinity];
  // Sutherland-Hodgman against one half-plane (keep where sign * (fn - c) <= 0); z interpolated along cut edges.
  const clip = (ring: number[][], fn: (v: number[]) => number, c: number, sign: 1 | -1) => {
    const res: number[][] = [];
    for (let k = 0; k < ring.length; k++) {
      const p = ring[k], q = ring[(k + 1) % ring.length], fp = sign * (fn(p) - c), fq = sign * (fn(q) - c);
      if (fp <= 0) res.push([...p]);
      if ((fp < 0 && fq > 0) || (fp > 0 && fq < 0)) { const t = fp / (fp - fq); res.push(p.map((x, i) => x + (q[i] - x) * t)); }
    }
    return res.length >= 3 ? res : null;
  };
  const area = (r: number[][]) => Math.abs(r.reduce((s, p, k) => { const q = r[(k + 1) % r.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2);
  // Cut a convex ring by fn = c when both sides keep more than a sliver; else keep it whole.
  const split = (ring: number[][], fn: (v: number[]) => number, c: number): number[][][] => {
    const lo = clip(ring, fn, c, 1), hi = clip(ring, fn, c, -1);
    return lo && hi && area(lo) >= 0.01 && area(hi) >= 0.01 ? [lo, hi] : [ring];
  };
  const mean = (ring: number[][], fn: (v: number[]) => number) => ring.reduce((s, v) => s + fn(v), 0) / ring.length;
  const roofs: BuildingFacts['roofsRD'] = [];
  for (const r of out.roofsRD) {
    // Touches the frontage inside the front's stretch: an edge on the facade line overlapping [a0, a1].
    const onFacade = r.vertices.filter(v => depth(v) <= tol).map(alongOf);
    if (!onFacade.length || Math.max(...onFacade) < a0 - tol || Math.min(...onFacade) > a1 + tol) { roofs.push(r); continue; }
    if (r.ringsRD.length > 1) throw Error(`${r.surfaceId}: a front roof surface with holes cannot be re-pitched`);
    const ring = r.vertices.map(v => [v[0], v[1], opts.topNap === undefined ? v[2] : Math.min(v[2], opts.topNap)]);
    // A face 3DBAG already pitches up from the facade (Bilderdijkstraat 113's mansard, 57 degrees): only its foot moves.
    if (r.slopeDeg >= 30 && !opts.along) {
      const moved = ring.map(v => depth(v) <= tol ? [v[0], v[1], eavesNap] : v);
      roofs.push({...r, vertices: moved, ringsRD: [moved]});
      continue;
    }
    // A flat top carried out to the facade: the strip in front of depth d (and inside `along`) becomes a steep face,
    // z' = eaves + (z - eaves) * depth / d. Non-convex surfaces are cut triangle by triangle (a half-plane clip of a
    // non-convex ring bridges its disjoint parts with zero-width spikes); a cut that would leave a sliver keeps the piece
    // whole. Pieces outside the front's range keep their heights; the library closes the step between them with a wall.
    const d = Math.max(0.3, (Math.max(...ring.map(v => v[2])) - eavesNap) / tan);
    const pitch = (v: number[]) => { const s = depth(v); return s >= d ? v : [v[0], v[1], eavesNap + (v[2] - eavesNap) * Math.max(0, s) / d]; };
    const turn = (k: number) => { const p = ring[k], q = ring[(k + 1) % ring.length], s = ring[(k + 2) % ring.length]; return (q[0] - p[0]) * (s[1] - q[1]) - (q[1] - p[1]) * (s[0] - q[0]); };
    const turns = ring.map((_, k) => turn(k)).filter(x => Math.abs(x) > 1e-9), convex = turns.every(x => x > 0) || turns.every(x => x < 0);
    let pieces = convex ? [ring] : T.ShapeUtils.triangulateShape(ring.map(v => new T.Vector2(v[0], v[1])), []).map(t => t.map(k => ring[k]));
    pieces = pieces.flatMap(t => split(t, depth, d));
    if (opts.along) pieces = pieces.flatMap(t => mean(t, depth) < d ? split(t, alongOf, a0).flatMap(x => split(x, alongOf, a1)) : [t]);
    pieces.forEach((t, k) => {
      const front = mean(t, depth) < d && (!opts.along || (mean(t, alongOf) > a0 && mean(t, alongOf) < a1)), v = front ? t.map(pitch) : t;
      roofs.push({...r, surfaceId: `${r.surfaceId}:${front ? 'f' : 'r'}${k}`, vertices: v, ringsRD: [v], areaM2: area(v), ...(front ? {slopeDeg: Math.round(Math.atan(tan) * 180 / Math.PI)} : {})});
    });
  }
  out.roofsRD = roofs;
  const z = roofs.flatMap(r => r.vertices.map(v => v[2] - out.heights.groundNAP));
  out.heights = {...out.heights, roofMinM: Math.min(...z)};
  return out;
}

interface Tri { p: number[][]; n: number[]; slot: string; surface: string }

export async function decodePands(glb: Uint8Array, pandCount: number): Promise<Tri[][]> {
  const doc = await new NodeIO().registerExtensions([KHRMeshQuantization]).readBinary(glb);
  const out: Tri[][] = Array.from({length: pandCount}, () => []);
  for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION')!, idx = prim.getIndices()!, mat = prim.getMaterial()!, ex = mat.getExtras() as any;
    for (const [pand, first, count] of (prim.getExtras() as any).pandRanges as number[][]) for (let t = first; t < first + count; t++) {
      const p = [0, 1, 2].map(k => pos.getElement(idx.getScalar(t * 3 + k), []));
      const u = p[1].map((v, i) => v - p[0][i]), w = p[2].map((v, i) => v - p[0][i]);
      const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]], l = Math.hypot(n[0], n[1], n[2]) || 1;
      out[pand].push({p, n: n.map(v => v / l), slot: ex.materialSlot, surface: ex.canalhouseSurface});
    }
  }
  return out;
}

/** Masonry wall slots: brick, or rendered stucco (intent palette.wallMaterial). */
const isWall = (slot: string) => slot === 'brick' || slot === 'stucco';
const area3 = (t: Tri) => { const u = t.p[1].map((v, i) => v - t.p[0][i]), w = t.p[2].map((v, i) => v - t.p[0][i]); return Math.hypot(u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]) / 2; };

/** Sutherland-Hodgman: convex polygon ∩ convex polygon (2D), area. */
function convexOverlap(a: number[][], b: number[][]): number {
  let out = a;
  for (let i = 0; i < b.length && out.length; i++) {
    const p = b[i], q = b[(i + 1) % b.length], side = (v: number[]) => (q[0] - p[0]) * (v[1] - p[1]) - (q[1] - p[1]) * (v[0] - p[0]);
    const orient = Math.sign(side(b[(i + 2) % b.length])) || 1, input = out; out = [];
    for (let k = 0; k < input.length; k++) {
      const c = input[k], d = input[(k + 1) % input.length], sc = side(c) * orient, sd = side(d) * orient;
      if (sc >= 0) out.push(c);
      if ((sc >= 0) !== (sd >= 0)) { const t = sc / (sc - sd); out.push([c[0] + (d[0] - c[0]) * t, c[1] + (d[1] - c[1]) * t]); }
    }
  }
  let s = 0; for (let i = 0; i < out.length; i++) { const p = out[i], q = out[(i + 1) % out.length]; s += p[0] * q[1] - q[0] * p[1]; }
  return Math.abs(s) / 2;
}

/** Coplanar same-facing overlap between two triangle sets (z-fighting candidates), m2. */
export function zFightArea(a: Tri[], b: Tri[], planeTolM = 0.01, log?: (s: Tri, t: Tri, area: number) => void, abutM = 0): number {
  let total = 0;
  // Two houses' coplanar walls and doors meet at a party line to within the recipe's centimetre rounding: a strip a few
  // millimetres wide where both lie on the line is an abutment, not z-fighting (nothing is visible at that width).
  // Shrinking every triangle inward by `abutM` removes such strips; a real overlap stays (its area loses perimeter x abutM).
  const shrink = (t: Tri): Tri | null => {
    if (!abutM) return t;
    const [p, q, r] = t.p, d = (u: number[], v: number[]) => Math.hypot(u[0] - v[0], u[1] - v[1], u[2] - v[2]);
    const la = d(q, r), lb = d(p, r), lc = d(p, q), perimeter = la + lb + lc, inradius = 2 * area3(t) / perimeter;
    if (inradius <= abutM) return null;
    const centre = [0, 1, 2].map(k => (la * p[k] + lb * q[k] + lc * r[k]) / perimeter), k = (inradius - abutM) / inradius;
    return {...t, p: t.p.map(v => v.map((x, j) => centre[j] + k * (x - centre[j])))};
  };
  if (abutM) { a = a.map(shrink).filter((t): t is Tri => !!t); b = b.map(shrink).filter((t): t is Tri => !!t); }
  // Undersides on the ground are never seen (both shells close at y = 0).
  const seen = (t: Tri) => !(t.n[1] < -0.9 && Math.max(...t.p.map(v => v[1])) <= 0.05);
  for (const s of a.filter(seen)) for (const t of b.filter(seen)) {
    if (s.n[0] * t.n[0] + s.n[1] * t.n[1] + s.n[2] * t.n[2] < 0.999) continue;
    const d = s.n[0] * (t.p[0][0] - s.p[0][0]) + s.n[1] * (t.p[0][1] - s.p[0][1]) + s.n[2] * (t.p[0][2] - s.p[0][2]);
    if (Math.abs(d) > planeTolM) continue;
    // Project onto the plane's two largest axes.
    const ax = Math.abs(s.n[0]) > Math.abs(s.n[1]) && Math.abs(s.n[0]) > Math.abs(s.n[2]) ? [1, 2] : Math.abs(s.n[1]) > Math.abs(s.n[2]) ? [0, 2] : [0, 1];
    const pa = s.p.map(v => [v[ax[0]], v[ax[1]]]), pb = t.p.map(v => [v[ax[0]], v[ax[1]]]);
    const scale = 1 / Math.max(Math.abs(s.n[3 - ax[0] - ax[1]]), 1e-6);
    const o = convexOverlap(pa, pb) * scale;
    if (o > 1e-5) log?.(s, t, o);
    total += o;
  }
  return total;
}

function rasterIoU(tris: Tri[], ring: number[][][], step = 0.1): number {
  const pts = ring.flat(), xs = pts.map(p => p[0]), zs = pts.map(p => p[1]);
  const covered = new Set<string>(), [x0, x1, z0, z1] = [Math.min(...xs) - 3, Math.max(...xs) + 3, Math.min(...zs) - 3, Math.max(...zs) + 3];
  for (const t of tris) {
    const tx = t.p.map(v => v[0]), tz = t.p.map(v => v[2]);
    for (let x = Math.max(x0, Math.min(...tx)); x <= Math.min(x1, Math.max(...tx)); x += step) for (let z = Math.max(z0, Math.min(...tz)); z <= Math.min(z1, Math.max(...tz)); z += step) {
      const gx = Math.round(x / step), gz = Math.round(z / step), cx = gx * step, cz = gz * step;
      if (pointInRing([cx, cz], t.p.map(v => [v[0], v[2]]))) covered.add(`${gx},${gz}`);
    }
  }
  let inter = 0, union = covered.size;
  for (let gx = Math.round(x0 / step); gx <= Math.round(x1 / step); gx++) for (let gz = Math.round(z0 / step); gz <= Math.round(z1 / step); gz++) {
    const inside = ring.some(r => pointInRing([gx * step, gz * step], r)), c = covered.has(`${gx},${gz}`);
    if (inside && c) inter++; else if (inside) union++;
  }
  return union ? inter / union : 0;
}

/** Area 3DBAG's LoD2.2 ground (the survey rings the model is built from) misses against the BAG LoD0 polygon. */
export function surveyShortfall(f: BuildingFacts): {bagM2: number; surveyM2: number; fraction: number} {
  const area = (r: number[][]) => Math.abs(r.reduce((s, p, k) => { const q = r[(k + 1) % r.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2);
  const bag = f.bagFootprintRD.reduce((s, r, k) => s + (k === 0 ? area(r) : -area(r)), 0);
  const survey = f.surveyFootprintPolygonsRD.reduce((s, poly) => s + poly.reduce((t, r, k) => t + (k === 0 ? area(r) : -area(r)), 0), 0);
  return {bagM2: cm(bag), surveyM2: cm(survey), fraction: bag > 0 ? Math.max(0, (bag - survey) / bag) : 0};
}

const samePoint = (p: number[], q: number[]) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 1e-6;
/** Move one plan corner in place everywhere it appears in a pand's facts: survey rings, roof partition, front chains (heights kept). */
function moveCorner(f: BuildingFacts, from: number[], to: [number, number]) {
  const same = samePoint;
  for (const poly of f.surveyFootprintPolygonsRD) for (const ring of poly) for (const v of ring) if (same(v, from)) { v[0] = to[0]; v[1] = to[1]; }
  // Roof rings share the ground corner: move it there too (heights kept) so the roof partition still covers the footprint.
  for (const r of f.roofsRD) { for (const ring of r.ringsRD) for (const v of ring) if (same(v, from)) { v[0] = to[0]; v[1] = to[1]; } for (const v of r.vertices) if (same(v, from)) { v[0] = to[0]; v[1] = to[1]; } }
  for (const fr of f.fronts) { for (const v of [...fr.endpointsRD, ...fr.chainRD]) if (same(v, from)) { v[0] = to[0]; v[1] = to[1]; } fr.widthM = Math.hypot(fr.endpointsRD[1][0] - fr.endpointsRD[0][0], fr.endpointsRD[1][1] - fr.endpointsRD[0][1]); }
}

/**
 * Close front slits between neighbours: LoD2.2 ground polygons of two neighbours sometimes stop a few centimetres
 * apart at the street (Utrechtsestraat 48/50: 7.7 cm), which renders as a see-through slit. When the front end of one
 * and the front start of the next are within `maxM`, both corners move to their midpoint (survey rings and frontage).
 */
export function closeFrontSlits(facts: BuildingFacts[], maxM = 0.15): {facts: BuildingFacts[]; closed: {left: string; right: string; gapM: number}[]} {
  const out = facts.map(f => structuredClone(f)), closed: {left: string; right: string; gapM: number}[] = [];
  for (let i = 0; i + 1 < out.length; i++) {
    const a = [...out[i].fronts[0].endpointsRD[1]], b = [...out[i + 1].fronts[0].endpointsRD[0]], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
    if (d < 0.005 || d > maxM) continue;
    const mid: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    moveCorner(out[i], a, mid); moveCorner(out[i + 1], b, mid);
    closed.push({left: out[i].pandId, right: out[i + 1].pandId, gapM: cm(d)});
  }
  return {facts: out, closed};
}

/** Survey-front noise: two neighbours' facade planes within this much at a party line are one plane (measured: LoD2.2 fronts of a row differ by 2-8 cm; real setbacks start at ~10 cm). */
/** Abutment tolerance per side for the z-fight measure (see zFightArea). */
export const ABUT_M = 0.005;
export const FRONT_SNAP_MAX_M = 0.09, FRONT_SNAP_MIN_M = 0.005;
export interface FrontSnap { left: string; right: string; stepBeforeM: number; pass: number; stepAfterM?: number }

/**
 * Depth (frame z) of the street facade at the ground corner of every party line: right house minus left house, null when
 * either side has no front wall corner there. Measured on the compiled GLB (the fit, jog flattening and outset all
 * included), at the ground vertex so a pilaster strip or cornice proud of the body does not count as a step.
 */
export function groundCornerSteps(tris: Tri[][]): (number | null)[] {
  const front = (t: Tri) => isWall(t.slot) && t.n[2] > 0.9 && Math.max(...t.p.map(v => v[2])) > -1;
  const edge = (a: Tri[], pick: (xs: number[]) => number) => { const xs = a.filter(front).flatMap(t => t.p.map(v => v[0])); return xs.length ? pick(xs) : NaN; };
  const cornerZ = (a: Tri[], x0: number) => { const zs = a.filter(front).flatMap(t => t.p).filter(v => Math.abs(v[0] - x0) < 0.02 && v[1] < 0.05).map(v => v[2]); return zs.length ? Math.max(...zs) : NaN; };
  return tris.slice(1).map((_, i) => { const l = cornerZ(tris[i], edge(tris[i], xs => Math.max(...xs))), r = cornerZ(tris[i + 1], edge(tris[i + 1], xs => Math.min(...xs))); return Number.isFinite(l + r) ? r - l : null; });
}

/** Move the two front corners of each listed party line half the measured step each, along the frontage normal, so they meet. */
export function snapFrontSteps(facts: BuildingFacts[], steps: {i: number; stepM: number}[], nRD: [number, number]): BuildingFacts[] {
  const out = facts.map(f => structuredClone(f));
  for (const {i, stepM} of steps) {
    const a = [...out[i].fronts[0].endpointsRD[1]], b = [...out[i + 1].fronts[0].endpointsRD[0]], d = stepM / 2;
    moveCorner(out[i], a, [a[0] + nRD[0] * d, a[1] + nRD[1] * d]);
    moveCorner(out[i + 1], b, [b[0] - nRD[0] * d, b[1] - nRD[1] * d]);
  }
  return out;
}

/** The face's facts in house order, each on its trusted ground (`trustFactsGround`; unchanged without a terrain field). */
export function faceFactsOnTrustedGround(face: Pick<BlockFaceIntent, 'houses'>, factsByPand: Map<string, BuildingFacts>, terrainAt?: TerrainAt | null): BuildingFacts[] {
  return face.houses.map(h => { const f = factsByPand.get(h.pandId); if (!f) throw Error(`no facts for ${h.pandId}`); return trustFactsGround(f, terrainAt); });
}

/** Triangles of a compiled group (what the chunk's per-pand triangle-budget gate counts, before party-wall trimming). */
function groupTriangles(group: T.Object3D): number {
  let n = 0;
  group.traverse(o => { if (o instanceof T.Mesh) { const g = o.geometry as T.BufferGeometry; n += (g.index ? g.index.count : g.getAttribute('position').count) / 3; } });
  return n;
}

export interface FacePlanOptions {
  strip?: StripScale;
  /** Photo gable readings keyed `<pandId>/<frontId>` (scripts/block-face/gable-from-photo.ts), used for `continuity.crownFromPhoto`. */
  photoGables?: Map<string, PhotoGable>;
  /** Override the intent's `continuity.roof.source` (before/after comparisons). */
  roofSource?: 'recipe' | 'survey';
  /** AHN terrain (scripts/lib/terrainField.ts): every pand's heights stand on its trusted ground (`trustFactsGround`). */
  terrainAt?: TerrainAt | null;
}

/** What the face compile decides before any GLB exists: the facts every pand is compiled from, and how its roof was chosen. */
export interface PreparedFace {
  /** Resolved house intents (photo crowns applied), street order. */
  intents: CanalHouseIntent[];
  /** The ground plan the chunk compiles from (shared street level, cornice lines, measured eaves, roofs, canopies). */
  ground: FaceGroundPlan;
  /** Per pand (street order): where its roof came from. `survey` = 3DBAG LoD2.2 as fitted; `recipe` = blockFace/recipeRoof.ts. */
  roofClasses: string[];
  photoCrowns?: BlockFaceResult['photoCrowns'];
  recipeRoofs?: RecipeRoofReport[];
}

/**
 * The planning half of `compileBlockFace`, shared with it: facts on trusted ground, front slits closed, the ground plan
 * with roofs and canopies, the resolved intents. `plan(current)` re-plans from other facts (the compile snaps front
 * corners and re-plans). Pure and GLB-free, so identity tests can hash what every pand is compiled from.
 */
function facePlanner(face: BlockFaceIntent, factsByPand: Map<string, BuildingFacts>, options: FacePlanOptions) {
  let intents = houseIntents(face);
  const facts = faceFactsOnTrustedGround(face, factsByPand, options.terrainAt);
  const slits = closeFrontSlits(facts);
  const roofSource = options.roofSource ?? face.continuity.roof?.source ?? 'survey', keepSurvey = new Set(face.continuity.roof?.keepSurvey ?? []);
  let recipeRoofs: RecipeRoofReport[] | undefined;
  /** `frontRoof` hints per pand and front (strip rows -> m above the pand's ground): a photo roof top and pitch for an attic band. */
  const hintsFor = (i: number, f: BuildingFacts): Record<string, FrontRoofHint> => {
    const out: Record<string, FrontRoofHint> = {};
    for (const m of (face.continuity.measuredEaves ?? []).filter(x => x.pand === f.pandId && x.frontRoof)) {
      const id = m.front ?? intents[i].fronts[0].id, fr = m.frontRoof!;
      out[id] = {...(fr.topRow !== undefined && options.strip ? {topM: cm(options.strip.groundNAP + (options.strip.heightPx - fr.topRow) / options.strip.pixelsPerMetre - f.heights.groundNAP)} : {}), ...(fr.pitchDeg !== undefined ? {pitchDeg: fr.pitchDeg} : {})};
    }
    return out;
  };
  /**
   * Roofs per pand: `survey` keeps 3DBAG; `recipe` and `front` fit once on the 3DBAG facts for the front eaves and
   * storeys, then replace the roof (blockFace/recipeRoof.ts); `front` bands take the form the street front implies.
   */
  const withRoofs = (plan: FaceGroundPlan): FaceGroundPlan => {
    const sources = plan.facts.map((f, i) => roofSourceFor(intents[i], f, roofSource, keepSurvey));
    if (sources.every(s => s === 'survey')) return plan;
    const make = (i: number, ridgeCapM?: number) => {
      const f = plan.facts[i], fit = fitIntent(intents[i], f), f0 = fit.report.fronts[0];
      const pitch = face.continuity.roof?.pitchDeg, street = intents[i].fronts[0].street;
      const forms = sources[i] === 'front' ? frontRoofSpecs(intents[i], fit, f, {hints: hintsFor(i, f), rowRidgeM: f.rowClamp?.ridgeM?.to}) : undefined;
      // Several fronts on the street (two houses in one pand, tower bays): each keeps its eaves (fit's own split).
      const same = intents[i].fronts.filter(fr => fr.street === street), ff = fit.facts.fronts.find(x => x.street === street);
      const ends = same.length > 1 && ff ? splitChain(ff, (() => { const sh = same.map(fr => fr.share ?? 1 / same.length), t = sh.reduce((a, b) => a + b, 0); return sh.map(x => x / t); })()).pairs : null;
      const fronts = ends ? same.map((fr, k) => ({id: fr.id, eavesM: fit.report.fronts.find(r => r.id === fr.id)!.eavesM, endpointsRD: ends[k], ...(fr.stepBody ? {body: true} : {})})) : undefined;
      return recipeRoofFacts(fit.facts, {eavesM: f0.eavesM, storeyHeightsM: f0.storeyHeightsM, street, ridgeCapM, fronts, ...(forms ? {forms, frontId: intents[i].fronts[0].id} : {}),
        // Dormers stand 0.35 m behind the frontage (fit.ts): the attic face starts behind them, not through them.
        faceSetbackM: intents[i].fronts.some(fr => fr.street === intents[i].fronts[0].street && fr.dormers && fr.roofFront !== 'mansard') ? 0.4 : 0}, pitch ? {frontPitchDeg: pitch} : {});
    };
    let made = plan.facts.map((f, i) => sources[i] === 'survey' ? null : make(i));
    // One attic line per cornice group (the photo reads them as one roof): the lowest member's top, in NAP.
    for (const g of face.continuity.corniceGroups) {
      const ids = g.pands.map(p => face.houses.findIndex(h => h.pandId === p)).filter(i => made[i]?.report.form === 'attic');
      if (ids.length < 2) continue;
      const nap = Math.min(...ids.map(i => made[i]!.report.ridgeM + plan.facts[i].heights.groundNAP));
      // Every other member sits 2 cm lower: neighbouring footprints overlap by 1-6 cm along the party line, and two
      // identical flat tops there z-fight (bilder-081118 156286|155418: 0.05 m2). 2 cm clears the 1 cm coplanarity test.
      ids.sort((a, b) => a - b).forEach((i, k) => {
        const cap = nap - (k % 2 ? 0.02 : 0);
        if (made[i]!.report.ridgeM + plan.facts[i].heights.groundNAP > cap + 0.005) made[i] = make(i, cap - plan.facts[i].heights.groundNAP);
      });
    }
    recipeRoofs = made.filter((m): m is NonNullable<typeof m> => !!m).map(m => m.report);
    return {...plan, facts: plan.facts.map((f, i) => made[i]?.facts ?? f)};
  };
  /** Continuous rigid canopies (`continuity.canopy`): one slab height per group, joined ends on the party planes. */
  const withCanopies = (plan: FaceGroundPlan): FaceGroundPlan => {
    if (!face.continuity.canopy?.length) return plan;
    const out = [...plan.facts];
    for (const g of face.continuity.canopy) {
      const idx = g.pands.map(p => face.houses.findIndex(h => h.pandId === p));
      // Every canopy front of a member on the face street (house modules of one pand, left to right), at its own height.
      const members = idx.flatMap(i => {
        const street = intents[i].fronts.filter(f => f.street === face.street), rigid = (k: number) => street[k]?.shopfront?.awning?.style === 'rigid';
        const fit = fitIntent(intents[i], plan.facts[i]).report;
        return street.flatMap((front, k) => {
          if (!rigid(k)) return [];
          const natural = fit.fronts.find(r => r.id === front.id)?.canopy;
          if (!natural) throw Error(`${m6(face.houses[i].pandId)}/${front.id}: continuity.canopy member has no rigid canopy in its fit (no shop glass?)`);
          // Joined: to the neighbouring canopy module of this pand, or (at the pand's ends) across the party wall to a group neighbour.
          return [{i, front: front.id, bottomM: natural.bottomM, joinLeft: k > 0 ? rigid(k - 1) : idx.includes(i - 1), joinRight: k < street.length - 1 ? rigid(k + 1) : idx.includes(i + 1)}];
        });
      });
      const bottomM = cm(median(members.map(m => m.bottomM)));
      for (const m of members) out[m.i] = {...out[m.i], canopyM: {...(out[m.i].canopyM ?? {}), [m.front]: {bottomM, joinLeft: m.joinLeft, joinRight: m.joinRight}}};
    }
    return {...plan, facts: out};
  };
  // A photo skyline (gables.json readings) confirms a row member that really stands off its row line.
  const skylineEavesM = options.photoGables && options.strip ? new Map(face.houses.map((h, i) => {
    const r = options.photoGables!.get(`${h.pandId}/${houseIntents(face)[i].fronts[0].id}`);
    return [h.pandId, r && Number.isFinite(r.shape.eavesUp) && !r.abstain.length ? r.shape.eavesUp + options.strip!.groundNAP - facts[i].heights.groundNAP : NaN] as [string, number];
  }).filter(([, v]) => Number.isFinite(v))) : undefined;
  const extras = skylineEavesM ? {skylineEavesM} : {};
  let ground = planFaceGround(face, slits.facts, undefined, options.strip, extras);
  let photoCrowns: BlockFaceResult['photoCrowns'];
  if (face.continuity.crownFromPhoto?.length) {
    if (!options.photoGables || !options.strip) throw Error('continuity.crownFromPhoto needs photo gable readings and the strip scale');
    const {patches, kept} = facePhotoPatches(face.continuity.crownFromPhoto, intents, ground.facts, options.photoGables, options.strip.groundNAP);
    intents = applyPhotoCrowns(intents, patches);
    photoCrowns = {patches, kept};
  }
  ground = withCanopies(withRoofs(ground));
  // `+mate`: a survey/recipe pand whose cornice group gained a front member (the group's shared attic line changed with it).
  const classOf = (f: BuildingFacts, i: number) => {
    const kind = f.roofSource?.kind ?? 'survey', mate = kind !== 'front' && face.continuity.corniceGroups.some(g => g.pands.includes(f.pandId) && g.pands.some(p => ground.facts.find(x => x.pandId === p)?.roofSource?.kind === 'front'));
    return `${kind}${f.rowClamp ? '+row' : ''}${mate ? '+mate' : ''}`;
  };
  return {intents, facts, slits, ground, photoCrowns, recipeRoofs: () => recipeRoofs, classes: () => ground.facts.map(classOf),
    plan: (current: BuildingFacts[]) => withCanopies(withRoofs(planFaceGround(face, current, undefined, options.strip, extras)))};
}

/** The facts and roof classes every pand of a face is compiled from, before the chunk compile (no GLB; see `facePlanner`). */
export function prepareFaceFacts(face: BlockFaceIntent, factsByPand: Map<string, BuildingFacts>, options: FacePlanOptions = {}): PreparedFace {
  const p = facePlanner(face, factsByPand, options);
  return {intents: p.intents, ground: p.ground, roofClasses: p.classes(), ...(p.photoCrowns ? {photoCrowns: p.photoCrowns} : {}), ...(p.recipeRoofs() ? {recipeRoofs: p.recipeRoofs()} : {})};
}

export async function compileBlockFace(face: BlockFaceIntent, factsByPand: Map<string, BuildingFacts>, name = `face-${face.id}`, options: FacePlanOptions & {inferRears?: boolean} = {}): Promise<BlockFaceResult> {
  const planner = facePlanner(face, factsByPand, options), {intents, facts, slits, photoCrowns} = planner;
  let ground = planner.ground, current = slits.facts;
  // Compile, measure the facade-plane steps at the party lines, snap the small ones (survey noise), recompile.
  const rears = new Map<string, RearReport>();
  // Faces model the street side only; without this the backs of a straight row are one blank plane (GLB audit blank-wall).
  const decorate = options.inferRears === false ? undefined : (built: CompiledBuilding, input: {id: string}) => {
    const f = built.facts, i = intents.findIndex(x => x.id === input.id), report = built.fit.fronts[0];
    // The rear grid spends what is left of the pand's triangle budget (the gate below counts rears too).
    const maxTriangles = BUDGET_TRIANGLES * intents[i].fronts.length - groupTriangles(built.group);
    rears.set(input.id, addInferredRear(built.group, f, built.anchorRD, report.storeyHeightsM, report.eavesM, built.recipe.palette.value.glass, built.recipe.palette.value.trim, ground.facts.filter((_, j) => j !== i), {maxTriangles}));
  };
  const compile = () => compileChunk(intents.map((intent, i) => ({id: intent.id, intent, facts: ground.facts[i]})), {name, maxRegroundM: 0, eavesSnapStepM: 0, decorate});
  let chunk = await compile();
  const frontSnaps: FrontSnap[] = [];
  for (let pass = 0; pass < 2; pass++) {
    const steps = groundCornerSteps(await decodePands(chunk.glb, intents.length));
    const todo = steps.map((stepM, i) => ({stepM, i})).filter(x => x.stepM !== null && Math.abs(x.stepM) >= FRONT_SNAP_MIN_M && Math.abs(x.stepM) <= FRONT_SNAP_MAX_M);
    if (!todo.length) break;
    current = snapFrontSteps(current, todo.map(x => ({i: x.i, stepM: x.stepM!})), chunk.frame.nRD);
    for (const x of todo) frontSnaps.push({left: face.houses[x.i].pandId, right: face.houses[x.i + 1].pandId, stepBeforeM: cm(x.stepM!), pass: pass + 1});
    ground = planner.plan(current);
    chunk = await compile();
  }
  const recipeRoofs = planner.recipeRoofs();
  const stepsAfter = groundCornerSteps(await decodePands(chunk.glb, intents.length));
  for (const sn of frontSnaps) sn.stepAfterM = cm(stepsAfter[face.houses.findIndex(h => h.pandId === sn.left)] ?? NaN);
  if (chunk.order.join() !== intents.map(i => i.id).join()) throw Error(`chunk order ${chunk.order.join()} differs from the intent's street order`);
  const tris = await decodePands(chunk.glb, intents.length);
  const frame: FrontFrame = {midRD: chunk.frame.midRD, uRD: chunk.frame.uRD, nRD: chunk.frame.nRD};
  const rings = facts.map(f => f.bagFootprintRD.map(r => ringToFrame(r, frame)));
  const gates: FaceGate[] = [], g = (pand: string, id: string, pass: boolean, value: unknown, limit: string) => gates.push({pand, id, pass, value, limit});
  const perPand: BlockFaceResult['perPand'] = [], sizes: FitSize[][] = [];
  for (const [i, intent] of intents.entries()) {
    const pand = intent.pandId.slice(-6), fit = fitIntent(intent, ground.facts[i]), t = tris[i];
    const roof = t.filter(x => ['roofTile', 'slate', 'bitumen'].includes(x.slot)).flatMap(x => x.p.map(v => v[1]));
    const roofMax = roof.length ? Math.max(...roof) : NaN, factsMax = fit.facts.heights.roofMaxM, allowance = fit.report.roofAllowanceM ?? 0;
    // A pand with several historic fronts (one owner behind four facades) gets the house budget per front.
    const budget = BUDGET_TRIANGLES * intent.fronts.length;
    g(pand, 'triangle-budget', t.length <= budget, t.length, `<= ${BUDGET_TRIANGLES} per front (${intent.fronts.length})`);
    const recipe = ground.facts[i].roofSource;
    if (recipe?.kind === 'front') {
      // A front roof is bounded by its crown line (the gable top, the attic cap, a tower on the cornice), not by LoD2.2;
      // 0.3 m for what stands on the outline (a cap, a finial, the roof cladding over a crown plate).
      const streetId = new Set(intent.fronts.filter(fr => fr.street === intent.fronts[0].street).map(fr => fr.id));
      const crownTops = fit.recipe.elevations.filter(el => streetId.has(el.id) && el.crown).map(el => Math.max(...el.crown!.value.profile.map(p => p[1])));
      const line = Math.max(recipe.crownTopM ?? -Infinity, ...crownTops, ...fit.report.fronts.filter(fr => streetId.has(fr.id)).map(fr => fr.crownTopM));
      g(pand, 'height-vs-3dbag', roofMax <= line + 0.3 + allowance && roofMax >= fit.report.fronts[0].eavesM - 0.05, {modelM: cm(roofMax), crownTopM: cm(line), threeDBagM: cm(recipe.surveyRoofMaxM), roof: 'front', forms: recipe.forms}, 'front roof: max <= the crown line + 0.3 m (dormers +1.9 m) and >= the front eaves; 3DBAG is an upper bound only');
      const above = roofAboveCrown(intent, fit, ground.facts[i]);
      g(pand, 'roof-under-crown', above <= 0.03, {maxAboveCrownM: cm(above)}, 'front roof: along the facade line (every 0.1 m, 5 cm inside) the roof stays under the crown outline (<= 3 cm above)');
    }
    else if (recipe) g(pand, 'height-vs-3dbag', roofMax - recipe.surveyRoofMaxM <= 0.5 + allowance && roofMax >= fit.report.fronts[0].eavesM - 0.05, {modelM: cm(roofMax), threeDBagM: cm(recipe.surveyRoofMaxM), capM: recipe.capM, roof: 'recipe'}, 'recipe roof: max <= LoD2.2 roof max + 0.5 m (dormers +1.9 m) and >= the front eaves; 3DBAG is an upper bound only');
    else g(pand, 'height-vs-3dbag', roofMax - factsMax <= 0.5 + allowance && factsMax - roofMax <= 0.5, {modelM: cm(roofMax), threeDBagM: cm(factsMax), surveyM: cm(ground.facts[i].heights.roofMaxM)}, '|Δ| <= 0.5 m (roof max vs LoD2.2 after roofCleanup; dormers +1.9 m)');
    const f0 = fit.report.fronts[0];
    const trusted = ground.groups.find(gr => gr.trust === 'photo' && gr.snapped && gr.pands.includes(intent.pandId));
    const measured = ground.measured?.[intent.pandId], measuredOk = !!measured && fit.report.fronts.every(f => measured[f.id] === undefined || Math.abs(f.eavesM - measured[f.id]) <= 0.05);
    g(pand, 'eaves-vs-3dbag', measured ? measuredOk : intent.fronts.length > 1 || Math.abs(f0.eavesM - ground.eavesBefore[i]) <= 0.5 || (!!trusted && Math.abs(f0.eavesM - ground.eavesAfter[i]) <= 0.3), {modelM: f0.eavesM, threeDBagM: ground.eavesBefore[i], groupLineM: ground.eavesAfter[i], ...(trusted ? {photoOverride: `line of ${trusted.reference!.slice(-6)}`} : {}), ...(measured ? {photoMeasured: Object.fromEntries(fit.report.fronts.map(f => [f.id, {modelM: f.eavesM, stripM: measured[f.id] ?? null}]))} : {})}, '|Δ| <= 0.5 m (cornice-group snapping included); a photo-trusted group is checked against its line; a strip-measured front against its measurement (<= 5 cm); multi-front pands report only (each front fits its own share of the profile, as in gates.ts)');
    const uppers = f0.storeyHeightsM.slice(f0.storeyHeightsM[0] < 1.5 ? 2 : 1);
    g(pand, 'storey-height', uppers.every(h => h >= 2.3 && h <= 4.6), f0.storeyHeightsM, 'upper storeys 2.3–4.6 m');
    const massTris = t.filter(x => isWall(x.slot) || ['roofTile', 'slate', 'bitumen'].includes(x.slot)), iou = rasterIoU(massTris, rings[i]);
    // 3DBAG sometimes reconstructs a smaller ground than the BAG polygon (177915: a 12.5 m2 rear wedge missing from
    // LoD2.2, b3_opp_grond 40.28 vs BAG 52.77). The model then cannot match BAG; it must still match the survey it was
    // built from, and the shortfall is reported as a source limit instead of a model error.
    const sourceShortfall = iou < 0.9 ? surveyShortfall(facts[i]) : null;
    const surveyIoU = sourceShortfall ? rasterIoU(massTris, facts[i].surveyFootprintPolygonsRD.map(p => ringToFrame(p[0], frame))) : null;
    const sourceLimited = !!sourceShortfall && sourceShortfall.fraction >= 0.1 && (surveyIoU ?? 0) >= 0.9;
    g(pand, 'footprint-vs-bag', iou >= 0.9 || sourceLimited, sourceLimited ? {bagIoU: cm(iou), surveyIoU: cm(surveyIoU!), sourceLimit: `3DBAG LoD2.2 ground ${sourceShortfall!.surveyM2} m2 vs BAG ${sourceShortfall!.bagM2} m2 (${Math.round(sourceShortfall!.fraction * 100)} % missing in the source)`} : cm(iou), 'plan IoU of shell+roof >= 0.90 against BAG LoD0 (or >= 0.90 against the 3DBAG LoD2.2 ground when 3DBAG itself is >= 10 % short of BAG)');
    const minY = Math.min(...t.flatMap(x => x.p.map(v => v[1])));
    g(pand, 'grounded', Math.abs(minY) <= 0.05, cm(minY), 'lowest vertex within 5 cm of the shared street level');
    sizes.push(fit.report.fronts.map(f => ({widthM: f.widthM, eavesM: f.eavesM, crownTopM: f.crownTopM})));
    perPand.push({pand: intent.pandId, slug: intent.id, triangles: t.length, eavesM: f0.eavesM, roofMaxM: cm(roofMax), roofMaxFactsM: cm(factsMax), storeyHeightsM: f0.storeyHeightsM, fronts: fit.report.fronts.map(f => ({id: f.id, widthM: f.widthM, eavesM: f.eavesM, storeyHeightsM: f.storeyHeightsM}))});
  }
  // Interference along each party line.
  const groupOf = (p: string) => face.continuity.corniceGroups.findIndex(gr => gr.pands.includes(p));
  const interference: Interference[] = [];
  const contacts = findContacts(rings.map(r => r as [number, number][][]), 0.1);
  // Each house's front plane: the most street-ward street-facing wall (frame z), clamped to the frame line, so a straight
  // face measures exactly as before (fronts at z ~ 0) and a bent face measures every house against its own front.
  const frontZ = tris.map(ts => Math.min(0, Math.max(-Infinity, ...ts.filter(t => isWall(t.slot) && t.n[2] > 0.9).map(t => Math.max(...t.p.map(v => v[2]))))));
  for (let i = 0; i + 1 < intents.length; i++) {
    const L = tris[i], R = tris[i + 1], joint = chunk.report.joints[i];
    const xLine = (chunk.pands[i].frontage.x1 + chunk.pands[i + 1].frontage.x0) / 2;
    const inside = (v: number[], rr: number[][][]) => rr.some(r => pointInRing([v[0], v[2]], r));
    // Surface of one house lying inside the neighbour's footprint even after a 5 cm step back towards its own side
    // (faces ON the shared party line do not count; they are trimmed or exposed walls).
    // A wall lying ON the neighbour's footprint boundary (a corner pand wrapping behind its neighbour shares that rear edge)
    // is a party wall too: its centroid must be > 3 cm inside, not just a millimetre past the edge.
    const boundaryDist = (x: number, z: number, rr: number[][][]) => Math.min(...rr.flatMap(r => r.map((p, k) => { const q = r[(k + 1) % r.length], dx = q[0] - p[0], dz = q[1] - p[1], l2 = dx * dx + dz * dz || 1, u = Math.max(0, Math.min(1, ((x - p[0]) * dx + (z - p[1]) * dz) / l2)); return Math.hypot(x - p[0] - u * dx, z - p[1] - u * dz); })));
    const deepInside = (t: Tri, rr: number[][][]) => boundaryDist((t.p[0][0] + t.p[1][0] + t.p[2][0]) / 3, (t.p[0][2] + t.p[1][2] + t.p[2][2]) / 3, rr) > 0.03;
    const penetration = (a: Tri[], rr: number[][][], toward: number) => a.filter(t => t.p.every(v => inside([v[0] - toward * 0.05, v[1], v[2]], rr)) && deepInside(t, rr)).reduce((s, t) => s + area3(t), 0);
    const leftIntoRight = penetration(L, rings[i + 1], 1), rightIntoLeft = penetration(R, rings[i], -1);
    // Street-side details: in front of the frontage plane (z > 0.02), reaching past the party line.
    // Street-side details (not the shell or roof, which end on the party wall by construction) that reach past the
    // party line. The line is the front-most shared footprint edge of the pair (frame plan), not the frame x: fronts
    // are rarely square to the averaged face axis.
    // Only edges that run back from the street are party lines across the frontage: a pand that wraps behind its
    // neighbour (Kinkerstraat 64-66 behind 68-70) also shares a rear edge parallel to the street, which must not win
    // the front-most pick (its far end can lie a few cm further out than the party line's street end).
    const allPair = contacts.filter(c => (c.a === i && c.b === i + 1)), across0 = allPair.filter(c => Math.abs(c.dz) >= 0.5);
    const pairContacts = across0.length ? across0 : allPair;
    const front = pairContacts.sort((p, q) => Math.max(q.oz, q.oz + q.dz * q.s1) - Math.max(p.oz, p.oz + p.dz * p.s1))[0];
    // "Street side" is relative to each house's own front plane (street-facing wall), not the chunk frame's z = 0: on a
    // face that bends a few degrees the middle houses stand more than 1 m behind the frame line (Nassaukade 312-307).
    const detail = (a: Tri[], k: number) => a.filter(t => !(isWall(t.slot) || ['roofTile', 'slate', 'bitumen'].includes(t.slot)) && t.p.some(v => v[2] > frontZ[k] - 1));
    // Signed distance across the contact line, positive towards the right-hand house.
    const across = (v: number[]) => front ? ((v[0] - front.ox) * -front.dz + (v[2] - front.oz) * front.dx) * sideSign : v[0] - xLine;
    // Which side of the line is the right-hand house: its street frontage midpoint (z = 0), not its footprint centroid,
    // which lies on the LEFT of the line when the right pand wraps behind its neighbour (Kinkerstraat 64-66 behind 68-70).
    const rMid = (chunk.pands[i + 1].frontage.x0 + chunk.pands[i + 1].frontage.x1) / 2;
    const sideSign = front ? Math.sign((rMid - front.ox) * -front.dz + (0 - front.oz) * front.dx) || 1 : 1;
    const overL = Math.max(0, ...detail(L, i).flatMap(t => t.p.map(v => across(v)))), overR = Math.max(0, ...detail(R, i + 1).flatMap(t => t.p.map(v => -across(v))));
    const near = (a: Tri[]) => a.filter(t => t.p.some(v => Math.abs(v[0] - xLine) < 1.5));
    // Facade z-fighting fails at 1 dm2; roof planes (3DBAG partitions that overlap by centimetres at the party line) at 5 dm2.
    const roofSlot = (t: Tri) => ['roofTile', 'slate', 'bitumen'].includes(t.slot);
    const zf = zFightArea(near(L).filter(t => !roofSlot(t)), near(R).filter(t => !roofSlot(t)), 0.01, undefined, ABUT_M), zfRoof = zFightArea(near(L).filter(roofSlot), near(R).filter(roofSlot));
    const step = cm(ground.eavesAfter[i + 1] - ground.eavesAfter[i]), same = groupOf(face.houses[i].pandId) >= 0 && groupOf(face.houses[i].pandId) === groupOf(face.houses[i + 1].pandId);
    const verdict = same ? (Math.abs(step) <= 0.15 ? 'aligned' : 'step-not-supported') : (Math.abs(step) >= 0.1 ? 'step-supported' : 'missing-step');
    // Facade ends measured on the street front only (street-facing brick within 1 m of the frontage plane; rear wings can be wider).
    const frontBrick = (a: Tri[], k: number) => a.filter(t => isWall(t.slot) && t.n[2] > 0.9 && Math.max(...t.p.map(v => v[2])) > frontZ[k] - 1).flatMap(t => t.p.map(v => v[0]));
    const gap = cm(Math.min(...frontBrick(R, i + 1)) - Math.max(...frontBrick(L, i)));
    const item: Interference = {left: face.houses[i].pandId, right: face.houses[i + 1].pandId, frontGapM: gap, frontDepthStepM: joint.depthStepM,
      penetrationM2: {leftIntoRight: cm(leftIntoRight), rightIntoLeft: cm(rightIntoLeft)}, detailOverhangM: {left: cm(overL), right: cm(overR)}, zFightM2: cm(zf), roofZFightM2: cm(zfRoof), eavesStepM: step, sameCorniceGroup: same, corniceVerdict: verdict,
      pass: Math.abs(gap) <= 0.05 && leftIntoRight + rightIntoLeft <= 0.05 && overL <= 0.03 && overR <= 0.03 && zf <= 0.01 && zfRoof <= 0.05 && verdict !== 'step-not-supported'};
    interference.push(item);
  }
  const instancing = planInstancing(intents, sizes, perPand.map(p => p.triangles));
  return {...(photoCrowns ? {photoCrowns} : {}), ...(recipeRoofs ? {recipeRoofs} : {}), ...(ground.rowClamps ? {rowClamps: ground.rowClamps} : {}), instancing, slitsClosed: slits.closed, frontSnaps, rears: intents.map(x => rears.get(x.id)).filter((r): r is RearReport => !!r), chunk, ground, gates, interference, perPand, passed: gates.every(x => x.pass) && interference.every(x => x.pass)};
}
export {chunkFrame};
