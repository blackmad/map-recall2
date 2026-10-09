/**
 * Block-face compiler: houses' intent recipes + 3DBAG facts → one chunk GLB.
 *
 *   1. order the houses along the street, build one frontage frame for the face;
 *   2. re-ground on one street level and snap neighbouring eaves (ground.ts);
 *   3. compile each house with the recipe pipeline and bake it into the frame;
 *   4. drop party walls where a neighbour covers them (party.ts);
 *   5. write one mesh, one primitive per material, per-pand ranges in extras.
 */
import {gzipSync} from 'node:zlib';
import * as T from 'three';
import {canalhouseGroupToGlb} from '../../../scripts/canalhouse-recipes/export-glb.ts';
import {compileBuilding} from '../buildingRecipe/compile.ts';
import {frontFrame, localToFrameMatrix, placementFor, ringToFrame, type FrontFrame} from '../buildingRecipe/instances.ts';
import {rdToLngLat} from '../facade/rdNew.ts';
import {planGround} from './ground.ts';
import {writeChunkGlb} from './gltf.ts';
import {findContacts, trimPartyWalls} from './party.ts';
import {boundsOf, groupToBuckets, recipeSlotFor, triangleCount} from './soup.ts';
import type {BucketMap, ChunkHouseInput, ChunkOptions, ChunkReport, ChunkResult, JointReport, P2, PandMeta} from './types.ts';

const round = (v: number, d = 3) => +v.toFixed(d);

/** One frontage frame for a block face: mean of the houses' frontage frames, orthonormalised. */
export function chunkFrame(houses: ChunkHouseInput[]): FrontFrame {
  const frames = houses.map(h => frontFrame(h.facts.fronts[0] as any));
  const sum = frames.reduce((s, f) => [s[0] + f.uRD[0], s[1] + f.uRD[1]], [0, 0]), len = Math.hypot(sum[0], sum[1]);
  const u: P2 = [sum[0] / len, sum[1] / len], n: P2 = [u[1], -u[0]];
  for (const f of frames) {
    if (f.uRD[0] * u[0] + f.uRD[1] * u[1] < 0.98) throw Error('Houses of one chunk must front the same direction (frontages differ by more than ~11 degrees)');
    if (f.nRD[0] * n[0] + f.nRD[1] * n[1] < 0.9) throw Error('Houses of one chunk must face the same side of the street');
  }
  const mid: P2 = [frames.reduce((s, f) => s + f.midRD[0], 0) / frames.length, frames.reduce((s, f) => s + f.midRD[1], 0) / frames.length];
  return {midRD: mid, uRD: u, nRD: n};
}

const matrixFor = (frame: FrontFrame, anchorRD: P2) => { const m = localToFrameMatrix(frame, anchorRD); return new T.Matrix4().set(m[0], m[1], m[2], m[3], m[4], m[5], m[6], m[7], m[8], m[9], m[10], m[11], 0, 0, 0, 1); };

/** Extent along X of a house's street-facing brick faces, and the depth (Z) of that facade plane near x. */
function facadeProbe(buckets: BucketMap) {
  const brick = [...buckets.values()].filter(b => b.slot === 'brick');
  let minX = Infinity, maxX = -Infinity;
  const faces: {x: number; z: number}[] = [];
  for (const b of brick) for (let t = 0; t < b.positions.length / 9; t++) {
    const n = b.normals.slice(t * 9, t * 9 + 3);
    if (n[2] < 0.9) continue;
    for (let k = 0; k < 3; k++) { const x = b.positions[t * 9 + k * 3], z = b.positions[t * 9 + k * 3 + 2]; minX = Math.min(minX, x); maxX = Math.max(maxX, x); faces.push({x, z}); }
  }
  return {minX, maxX, depthNear: (x: number) => { const near = faces.filter(f => Math.abs(f.x - x) < 0.6); return near.length ? Math.max(...near.map(f => f.z)) : NaN; }};
}

export async function compileChunk(inputs: ChunkHouseInput[], options: ChunkOptions): Promise<ChunkResult> {
  if (!inputs.length) throw Error('A chunk needs at least one house');
  const t0 = performance.now();
  const frame = chunkFrame(inputs);
  const alongOf = (h: ChunkHouseInput) => { const f = frontFrame(h.facts.fronts[0] as any); return (f.midRD[0] - frame.midRD[0]) * frame.uRD[0] + (f.midRD[1] - frame.midRD[1]) * frame.uRD[1]; };
  const houses = [...inputs].sort((a, b) => alongOf(a) - alongOf(b));
  const warnings: string[] = [];
  const rings = houses.map(h => h.facts.surveyFootprintPolygonsRD.map(poly => ringToFrame(poly[0], frame) as P2[]));
  const partyTol = options.partyToleranceM ?? 0.05;
  const contacts = findContacts(rings, partyTol);
  const adjacent = houses.slice(1).map((_, i) => contacts.some(c => (c.a === i && c.b === i + 1) || (c.a === i + 1 && c.b === i)));
  adjacent.forEach((ok, i) => { if (!ok) warnings.push(`${houses[i].id} and ${houses[i + 1].id} share no party wall (a gap or a cross street between them)`); });

  // Ground + eaves.
  const plan = planGround(houses.map(h => h.facts), adjacent, options.maxRegroundM ?? 1, options.eavesSnapStepM ?? 0.25, options.eavesSnapSpanM ?? 0.45);

  // Compile, bake into the frame.
  const compiled = houses.map((h, i) => compileBuilding(h.intent, plan.facts[i]));
  const buckets: BucketMap[] = compiled.map((built, i) => groupToBuckets(built.group, matrixFor(frame, built.anchorRD), recipeSlotFor(houses[i].intent)));
  const merged = buckets.reduce((s, b) => s + triangleCount(b), 0);
  const tCompile = performance.now();

  // Joints: how the facades meet, measured on the baked geometry.
  const probes = buckets.map(facadeProbe);
  const joints: JointReport[] = houses.slice(1).map((h, i) => {
    const left = houses[i], l = probes[i], r = probes[i + 1];
    const xJoint = (l.maxX + r.minX) / 2, zl = l.depthNear(xJoint), zr = r.depthNear(xJoint);
    const endL = left.facts.fronts[0].endpointsRD[1], endR = h.facts.fronts[0].endpointsRD[0];
    return {left: left.id, right: h.id, lateralGapM: round(r.minX - l.maxX), depthStepM: Number.isFinite(zl + zr) ? round(zr - zl) : 0,
      eavesStepBeforeM: round(plan.eavesBefore[i + 1] - plan.eavesBefore[i], 2), eavesStepAfterM: round(plan.eavesAfter[i + 1] - plan.eavesAfter[i], 2),
      sharedFrontVertex: Math.hypot(endL[0] - endR[0], endL[1] - endR[1]) < 0.02};
  });

  // Party walls.
  const partyWalls = options.trimPartyWalls === false ? [] : trimPartyWalls(houses.map((h, i) => ({id: h.id, buckets: buckets[i]})), contacts, partyTol);
  const tTrim = performance.now();
  const chunkTriangles = buckets.reduce((s, b) => s + triangleCount(b), 0);

  // Metadata + GLB.
  const anchor = rdToLngLat({x: frame.midRD[0], y: frame.midRD[1]});
  const placement = placementFor(frame, false, p => { const ll = rdToLngLat({x: p[0], y: p[1]}); return [ll[0], ll[1]]; });
  const frameMeta = {midRD: frame.midRD, uRD: frame.uRD, nRD: frame.nRD, anchor: [anchor[0], anchor[1]] as [number, number], northOffsetDegrees: placement.northOffsetDegrees};
  const pands: PandMeta[] = houses.map((h, i) => {
    const x = h.facts.fronts[0].endpointsRD.map(p => (p[0] - frame.midRD[0]) * frame.uRD[0] + (p[1] - frame.midRD[1]) * frame.uRD[1]);
    return {recipeId: h.id, pandId: h.intent.pandId, buildingId: `NL.IMBAG.Pand.${h.intent.pandId}`, address: h.intent.address, sources: h.intent.sources.map(s => (s as any).image ?? s.id),
      frontage: {x0: round(Math.min(...x)), x1: round(Math.max(...x)), widthM: round(Math.abs(x[1] - x[0]))}, bounds: boundsOf(buckets[i]), triangles: 0, ranges: [],
      footprint: h.facts.bagFootprintRD.map(ring => ring.map(p => { const ll = rdToLngLat({x: p[0], y: p[1]}); return [+ll[0].toFixed(7), +ll[1].toFixed(7)]; })),
      eavesM: plan.eavesAfter[i], groundShiftM: plan.shiftsM[i]};
  });
  const glb = await writeChunkGlb({name: options.name, houses: buckets.map(b => ({buckets: b})), pands, frame: frameMeta});
  const tWrite = performance.now();

  // Baseline: the same houses, compiled and exported one by one, nothing shared, nothing aligned.
  let individual = {triangles: 0, primitives: 0, bytes: 0, gzip: 0};
  for (const h of houses) {
    const built = compileBuilding(h.intent, h.facts);
    const g = await canalhouseGroupToGlb(h.id, built.group, {metreUvs: true, slotFor: recipeSlotFor(h.intent)});
    individual = {triangles: individual.triangles + g.triangles, primitives: individual.primitives + g.materials, bytes: individual.bytes + g.bytes.length, gzip: individual.gzip + gzipSync(g.bytes).length};
  }

  const report: ChunkReport = {
    name: options.name, houses: houses.length,
    triangles: {individual: individual.triangles, merged, chunk: glb.triangles, partyWallDropped: merged - chunkTriangles},
    primitives: {individual: individual.primitives, chunk: glb.primitives},
    bytes: {individual: individual.bytes, chunk: glb.bytes.length},
    gzipBytes: {individual: individual.gzip, chunk: gzipSync(glb.bytes).length},
    partyWalls, joints,
    ground: {sharedNapM: plan.sharedNapM, shiftsM: Object.fromEntries(houses.map((h, i) => [h.id, plan.shiftsM[i]]))},
    eaves: {before: Object.fromEntries(houses.map((h, i) => [h.id, plan.eavesBefore[i]])), after: Object.fromEntries(houses.map((h, i) => [h.id, plan.eavesAfter[i]])), clusters: plan.clusters.map(c => c.map(i => houses[i].id))},
    warnings, timingsMs: {compile: round(tCompile - t0, 1), trim: round(tTrim - tCompile, 1), write: round(tWrite - tTrim, 1)},
  };
  return {name: options.name, order: houses.map(h => h.id), glb: glb.bytes, pands, frame: frameMeta, report};
}
