/**
 * Instancing plan for a block face: which houses are the same design at the same fitted size, so one mesh could serve
 * them all (instance = master mesh + a translation along the frontage, per-pand ranges kept for picking).
 *
 * The chunk GLB is one mesh with one primitive per material and a contiguous triangle range per pand
 * (streetChunks/gltf.ts); the game maps a picked face to its pand through those ranges
 * (landmarks/signaturePlacement.pandIndexForFace) and suppresses procedural buildings per pand. Real instancing
 * therefore changes the loader contract (EXT_mesh_gpu_instancing nodes + an instance -> pand table), which is
 * integrator territory (signature-landmarks-source.js). This module measures the win and fixes the grouping rule so
 * that change can be made against numbers: same canonical design (matchDesign 'same') and fitted width, eaves and
 * crown top within SHARE_DIMENSION_TOLERANCE_M per front (the per-house sharing rule of building-recipes/compile.ts).
 */
import {matchDesign, SHARE_DIMENSION_TOLERANCE_M} from '../buildingRecipe/instances.ts';
import type {CanalHouseIntent} from '../buildingRecipe/intent.ts';

export interface FitSize { widthM: number; eavesM: number; crownTopM: number }
export interface InstanceGroup { master: string; members: string[]; trianglesEach: number; savedTriangles: number }
export interface InstancingPlan { groups: InstanceGroup[]; totalTriangles: number; uniqueTriangles: number; savedTriangles: number; savedPercent: number; notShared: {pand: string; why: string}[] }

/** `sizes[i]` = fitted size of every front of house i; `triangles[i]` = the house's triangles in the chunk. */
export function planInstancing(intents: CanalHouseIntent[], sizes: FitSize[][], triangles: number[], toleranceM = SHARE_DIMENSION_TOLERANCE_M): InstancingPlan {
  const groups: InstanceGroup[] = [], notShared: InstancingPlan['notShared'] = [], taken = new Set<number>();
  const close = (a: FitSize[], b: FitSize[]) => a.length === b.length && a.every((s, k) => Math.abs(s.widthM - b[k].widthM) <= toleranceM && Math.abs(s.eavesM - b[k].eavesM) <= toleranceM && Math.abs(s.crownTopM - b[k].crownTopM) <= toleranceM);
  for (let i = 0; i < intents.length; i++) {
    if (taken.has(i)) continue;
    const members = [i];
    for (let j = i + 1; j < intents.length; j++) {
      if (taken.has(j)) continue;
      if (matchDesign(intents[i], intents[j]) !== 'same') continue;
      if (!close(sizes[i], sizes[j])) { notShared.push({pand: intents[j].pandId, why: `same design as ${intents[i].pandId.slice(-6)} but fitted size differs by more than ${toleranceM} m`}); continue; }
      members.push(j); taken.add(j);
    }
    if (members.length > 1) groups.push({master: intents[i].pandId, members: members.map(k => intents[k].pandId), trianglesEach: triangles[i], savedTriangles: members.slice(1).reduce((s, k) => s + triangles[k], 0)});
  }
  const total = triangles.reduce((s, x) => s + x, 0), saved = groups.reduce((s, g) => s + g.savedTriangles, 0);
  return {groups, totalTriangles: total, uniqueTriangles: total - saved, savedTriangles: saved, savedPercent: total ? +(100 * saved / total).toFixed(1) : 0, notShared};
}
