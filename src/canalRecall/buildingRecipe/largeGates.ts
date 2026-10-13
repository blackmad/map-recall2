/**
 * Gates for `kind: large` buildings, on the decoded GLB triangles plus the fit:
 * budget 12k triangles, finite/non-metallic, footprint IoU >= 0.90 against BAG LoD0, roof max within 0.30 m of the
 * LoD2.2 roof max, per wall group eaves within 0.30 m of the 3DBAG roof just inside the wall and upper storeys
 * 2.3-6.2 m, no floating components, <= 2 m genuine open edge, and the block-kit attachment gate (every part within
 * 5 cm of the host or a part that is).
 */
import {footprintIoU, topology, type Gate, type Tri} from './gates.ts';
import {roofHeightAt} from './facts.ts';
import type {CompiledLargeBuilding} from './largeCompile.ts';

export const LARGE_BUDGET_TRIANGLES = 12000;
/** Civic and monumental storeys run taller than houses (De Balie, 1880s: ~5.9 m); the canal-house gate stops at 4.6 m. */
export const LARGE_MAX_STOREY_M = 6.2;

export function evaluateLargeGates(tris: Tri[], built: CompiledLargeBuilding): {gates: Gate[]; topology: ReturnType<typeof topology>} {
  const gates: Gate[] = [], facts = built.facts, recipe = built.recipe, [ax, ay] = recipe.anchorRD;
  const g = (id: string, pass: boolean, value: unknown, limit: string) => gates.push({id, pass, value, limit});
  g('triangle-budget', tris.length <= LARGE_BUDGET_TRIANGLES, tris.length, `<= ${LARGE_BUDGET_TRIANGLES}`);
  g('finite', tris.every(t => [...t.a, ...t.b, ...t.c].every(Number.isFinite)), true, 'all positions finite');
  g('non-metallic', tris.every(t => t.metallic === 0), true, 'metallicFactor 0');
  const rings = recipe.set.ground.flatMap(s => s.rings.map(r => r.map(p => [p[0], p[2]])));
  const iou = footprintIoU(facts, rings, recipe.anchorRD);
  g('footprint-vs-bag', iou >= 0.9, +iou.toFixed(3), 'IoU >= 0.90 against BAG LoD0');
  const roofMax = Math.max(...tris.filter(t => t.surface === 'roof').flatMap(t => [t.a[1], t.b[1], t.c[1]]));
  g('ridge-vs-3dbag', Math.abs(roofMax - facts.heights.roofMaxM) <= 0.3, {modelM: +roofMax.toFixed(2), threeDBagM: +facts.heights.roofMaxM.toFixed(2)}, '|Δ| <= 0.30 m (roof max vs LoD2.2 roof max)');
  const panels = new Map<number, {o: number[]; r: number[]; n: number[]; uMin: number; uMax: number}>();
  // Panel frames are rebuilt from the recipe (same buildHost as compose).
  for (const p of built.panels) panels.set(p.index, p);
  for (const grp of recipe.groups) {
    const p = grp.mainPanel === null ? undefined : panels.get(grp.mainPanel);
    if (!p) { g(`eaves-vs-3dbag/walls[${grp.index}]`, false, 'no panel', 'the group owns at least one panel'); continue; }
    const hs: number[] = [];
    for (let k = 0; k < 24; k++) {
      const u = p.uMin + (p.uMax - p.uMin) * (k + 0.5) / 24, x = p.o[0] + p.r[0] * u - p.n[0] * 0.08, z = p.o[2] + p.r[2] * u - p.n[2] * 0.08;
      const h = roofHeightAt(facts.roofsRD, [ax + x, ay - z], facts.heights.groundNAP);
      if (h !== null) hs.push(h);
    }
    hs.sort((a, b) => a - b);
    const roofEaves = hs[Math.floor(hs.length * 0.1)];
    g(`eaves-vs-3dbag/walls[${grp.index}]`, roofEaves !== undefined && Math.abs(grp.eavesM - roofEaves) <= 0.3, {modelM: grp.eavesM, threeDBagM: roofEaves === undefined ? null : +roofEaves.toFixed(2), samples: hs.length}, '|Δ| <= 0.30 m (wall eaves vs LoD2.2 roof 8 cm inside the wall, p10, as the canal-house facts)');
    if (grp.system !== 'blank') {
      const uppers = grp.storeyHeightsM.slice(1);
      g(`storey-height/walls[${grp.index}]`, uppers.every(h => h >= 2.3 && h <= LARGE_MAX_STOREY_M) && grp.storeyHeightsM[0] >= 2.3, grp.storeyHeightsM, `ground >= 2.3 m, upper storeys 2.3-${LARGE_MAX_STOREY_M} m`);
    }
  }
  const topo = topology(tris);
  g('no-floating-parts', topo.floating.length === 0, topo.floating.length, '0 components detached from ground/shell');
  g('open-edges', topo.openEdgeLengthM <= 2, {edges: topo.openEdges, lengthM: +topo.openEdgeLengthM.toFixed(1)}, '<= 2 m of genuine open edge above ground (T-junction seams excluded)');
  const b = built.blockGates;
  g('parts-attached', b.floatingOk && b.gapOk, {parts: b.parts, maxGapCm: b.maxGapCm, floating: b.floatingDetail}, 'every block-kit part within 5 cm of the 3DBAG shell or an attached part');
  return {gates, topology: topo};
}
