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
import {KHRMeshQuantization} from '@gltf-transform/extensions';
import type {BuildingFacts} from '../buildingRecipe/facts.ts';
import {pointInRing} from '../buildingRecipe/facts.ts';
import {fitIntent} from '../buildingRecipe/fit.ts';
import {BUDGET_TRIANGLES} from '../buildingRecipe/gates.ts';
import {ringToFrame, type FrontFrame} from '../buildingRecipe/instances.ts';
import {compileChunk, chunkFrame} from '../streetChunks/compileChunk.ts';
import {fitEaves, shiftFactsHeights} from '../streetChunks/ground.ts';
import type {ChunkResult} from '../streetChunks/types.ts';
import {houseIntents, type BlockFaceIntent} from './intent.ts';

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
export interface FaceGroundPlan { sharedNapM: number; shiftsM: number[]; eavesBefore: number[]; eavesAfter: number[]; groups: {pands: string[]; spreadM: number; snapped: boolean}[]; facts: BuildingFacts[] }
export interface BlockFaceResult { chunk: ChunkResult; ground: FaceGroundPlan; gates: FaceGate[]; interference: Interference[]; perPand: {pand: string; slug: string; triangles: number; eavesM: number; roofMaxM: number; roofMaxFactsM: number; storeyHeightsM: number[]}[]; passed: boolean }

const median = (v: number[]) => { const s = [...v].sort((a, b) => a - b); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };
const cm = (v: number) => Math.round(v * 100) / 100;

/** One street level (median ground, shifts <= 1 m) and the intent's cornice groups. */
export function planFaceGround(face: BlockFaceIntent, facts: BuildingFacts[], maxGroupSpreadM = 0.8): FaceGroundPlan {
  const sharedNapM = cm(median(facts.map(f => f.heights.groundNAP)));
  const shiftsM = facts.map(f => { const d = f.heights.groundNAP - sharedNapM; return face.continuity.streetLevel === 'shared' && Math.abs(d) <= 1 ? cm(d) : 0; });
  const grounded = facts.map((f, i) => shiftsM[i] ? shiftFactsHeights(f, shiftsM[i], sharedNapM) : f);
  const eavesBefore = grounded.map(fitEaves), eavesAfter = [...eavesBefore];
  const index = new Map(face.houses.map((h, i) => [h.pandId, i]));
  const groups = face.continuity.corniceGroups.map(g => {
    const ids = g.pands.map(p => index.get(p)!), vals = ids.map(i => eavesBefore[i]), spreadM = cm(Math.max(...vals) - Math.min(...vals));
    const snapped = ids.length > 1 && spreadM <= maxGroupSpreadM;
    if (snapped) { const t = cm(median(vals)); for (const i of ids) eavesAfter[i] = t; }
    return {pands: g.pands, spreadM, snapped};
  });
  const out = grounded.map((f, i) => {
    const d = eavesAfter[i] - eavesBefore[i];
    return d ? {...f, fronts: f.fronts.map(fr => ({...fr, eavesM: fr.eavesM + d, topProfile: fr.topProfile.map(p => ({...p, heightM: p.heightM + d}))}))} : f;
  });
  return {sharedNapM, shiftsM, eavesBefore, eavesAfter, groups, facts: out};
}

interface Tri { p: number[][]; n: number[]; slot: string; surface: string }

async function decodePands(glb: Uint8Array, pandCount: number): Promise<Tri[][]> {
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
export function zFightArea(a: Tri[], b: Tri[], planeTolM = 0.01, log?: (s: Tri, t: Tri, area: number) => void): number {
  let total = 0;
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

export async function compileBlockFace(face: BlockFaceIntent, factsByPand: Map<string, BuildingFacts>, name = `face-${face.id}`): Promise<BlockFaceResult> {
  const intents = houseIntents(face), facts = face.houses.map(h => { const f = factsByPand.get(h.pandId); if (!f) throw Error(`no facts for ${h.pandId}`); return f; });
  const ground = planFaceGround(face, facts);
  const chunk = await compileChunk(intents.map((intent, i) => ({id: intent.id, intent, facts: ground.facts[i]})), {name, maxRegroundM: 0, eavesSnapStepM: 0});
  if (chunk.order.join() !== intents.map(i => i.id).join()) throw Error(`chunk order ${chunk.order.join()} differs from the intent's street order`);
  const tris = await decodePands(chunk.glb, intents.length);
  const frame: FrontFrame = {midRD: chunk.frame.midRD, uRD: chunk.frame.uRD, nRD: chunk.frame.nRD};
  const rings = facts.map(f => f.bagFootprintRD.map(r => ringToFrame(r, frame)));
  const gates: FaceGate[] = [], g = (pand: string, id: string, pass: boolean, value: unknown, limit: string) => gates.push({pand, id, pass, value, limit});
  const perPand: BlockFaceResult['perPand'] = [];
  for (const [i, intent] of intents.entries()) {
    const pand = intent.pandId.slice(-6), fit = fitIntent(intent, ground.facts[i]), t = tris[i];
    const roof = t.filter(x => ['roofTile', 'slate', 'bitumen'].includes(x.slot)).flatMap(x => x.p.map(v => v[1]));
    const roofMax = roof.length ? Math.max(...roof) : NaN, factsMax = fit.facts.heights.roofMaxM, allowance = fit.report.roofAllowanceM ?? 0;
    g(pand, 'triangle-budget', t.length <= BUDGET_TRIANGLES, t.length, `<= ${BUDGET_TRIANGLES} per pand`);
    g(pand, 'height-vs-3dbag', roofMax - factsMax <= 0.5 + allowance && factsMax - roofMax <= 0.5, {modelM: cm(roofMax), threeDBagM: cm(factsMax), surveyM: cm(ground.facts[i].heights.roofMaxM)}, '|Δ| <= 0.5 m (roof max vs LoD2.2 after roofCleanup; dormers +1.9 m)');
    const f0 = fit.report.fronts[0];
    g(pand, 'eaves-vs-3dbag', Math.abs(f0.eavesM - ground.eavesBefore[i]) <= 0.5, {modelM: f0.eavesM, threeDBagM: ground.eavesBefore[i], groupLineM: ground.eavesAfter[i]}, '|Δ| <= 0.5 m (cornice-group snapping included)');
    const uppers = f0.storeyHeightsM.slice(f0.storeyHeightsM[0] < 1.5 ? 2 : 1);
    g(pand, 'storey-height', uppers.every(h => h >= 2.3 && h <= 4.6), f0.storeyHeightsM, 'upper storeys 2.3–4.6 m');
    const iou = rasterIoU(t.filter(x => x.slot === 'brick' || ['roofTile', 'slate', 'bitumen'].includes(x.slot)), rings[i]);
    g(pand, 'footprint-vs-bag', iou >= 0.9, cm(iou), 'plan IoU of shell+roof >= 0.90 against BAG LoD0');
    const minY = Math.min(...t.flatMap(x => x.p.map(v => v[1])));
    g(pand, 'grounded', Math.abs(minY) <= 0.05, cm(minY), 'lowest vertex within 5 cm of the shared street level');
    perPand.push({pand: intent.pandId, slug: intent.id, triangles: t.length, eavesM: f0.eavesM, roofMaxM: cm(roofMax), roofMaxFactsM: cm(factsMax), storeyHeightsM: f0.storeyHeightsM});
  }
  // Interference along each party line.
  const groupOf = (p: string) => face.continuity.corniceGroups.findIndex(gr => gr.pands.includes(p));
  const interference: Interference[] = [];
  for (let i = 0; i + 1 < intents.length; i++) {
    const L = tris[i], R = tris[i + 1], joint = chunk.report.joints[i];
    const xLine = (chunk.pands[i].frontage.x1 + chunk.pands[i + 1].frontage.x0) / 2;
    const inside = (v: number[], rr: number[][][]) => rr.some(r => pointInRing([v[0], v[2]], r));
    // Surface of one house lying inside the neighbour's footprint even after a 5 cm step back towards its own side
    // (faces ON the shared party line do not count; they are trimmed or exposed walls).
    const penetration = (a: Tri[], rr: number[][][], toward: number) => a.filter(t => t.p.every(v => inside([v[0] - toward * 0.05, v[1], v[2]], rr))).reduce((s, t) => s + area3(t), 0);
    const leftIntoRight = penetration(L, rings[i + 1], 1), rightIntoLeft = penetration(R, rings[i], -1);
    // Street-side details: in front of the frontage plane (z > 0.02), reaching past the party line.
    const frontOf = (a: Tri[]) => a.filter(t => t.p.some(v => v[2] > 0.02));
    const overL = Math.max(0, ...frontOf(L).flatMap(t => t.p.map(v => v[0] - xLine))), overR = Math.max(0, ...frontOf(R).flatMap(t => t.p.map(v => xLine - v[0])));
    const near = (a: Tri[]) => a.filter(t => t.p.some(v => Math.abs(v[0] - xLine) < 1.5));
    // Facade z-fighting fails at 1 dm2; roof planes (3DBAG partitions that overlap by centimetres at the party line) at 5 dm2.
    const roofSlot = (t: Tri) => ['roofTile', 'slate', 'bitumen'].includes(t.slot);
    const zf = zFightArea(near(L).filter(t => !roofSlot(t)), near(R).filter(t => !roofSlot(t))), zfRoof = zFightArea(near(L).filter(roofSlot), near(R).filter(roofSlot));
    const step = cm(ground.eavesAfter[i + 1] - ground.eavesAfter[i]), same = groupOf(face.houses[i].pandId) >= 0 && groupOf(face.houses[i].pandId) === groupOf(face.houses[i + 1].pandId);
    const verdict = same ? (Math.abs(step) <= 0.15 ? 'aligned' : 'step-not-supported') : (Math.abs(step) >= 0.1 ? 'step-supported' : 'missing-step');
    // Facade ends measured on the street front only (street-facing brick within 1 m of the frontage plane; rear wings can be wider).
    const frontBrick = (a: Tri[]) => a.filter(t => t.slot === 'brick' && t.n[2] > 0.9 && Math.max(...t.p.map(v => v[2])) > -1).flatMap(t => t.p.map(v => v[0]));
    const gap = cm(Math.min(...frontBrick(R)) - Math.max(...frontBrick(L)));
    const item: Interference = {left: face.houses[i].pandId, right: face.houses[i + 1].pandId, frontGapM: gap, frontDepthStepM: joint.depthStepM,
      penetrationM2: {leftIntoRight: cm(leftIntoRight), rightIntoLeft: cm(rightIntoLeft)}, detailOverhangM: {left: cm(overL), right: cm(overR)}, zFightM2: cm(zf), roofZFightM2: cm(zfRoof), eavesStepM: step, sameCorniceGroup: same, corniceVerdict: verdict,
      pass: Math.abs(gap) <= 0.05 && leftIntoRight + rightIntoLeft <= 0.05 && overL <= 0.03 && overR <= 0.03 && zf <= 0.01 && zfRoof <= 0.05 && verdict !== 'step-not-supported'};
    interference.push(item);
  }
  return {chunk, ground, gates, interference, perPand, passed: gates.every(x => x.pass) && interference.every(x => x.pass)};
}
export {chunkFrame};
