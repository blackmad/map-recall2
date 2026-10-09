/**
 * Roof-fidelity measurements for the held canalhouse roof problem
 * ("uniform taupe masses and tall rear ridges dominate crowns",
 * Bloemgracht 78–90). Pure functions over a compiled group + facts.
 */
import * as T from 'three';
import type {BuildingFacts} from './facts.ts';
import {fitPlane, pointInRing} from './facts.ts';

export interface RoofFidelity {
  /** Largest |model roof height − 3DBAG plane height| over all roof vertices (m). */
  maxPlaneErrorM: number;
  /** Projected roof area / LoD2.2 ground area. */
  coverage: number;
  /** Distinct roof colours (slope classes + verge). */
  roofColours: number;
  /** Highest roof point within `nearM` behind the front, minus the front's crown/eaves top (m). */
  nearRoofOverCrownM: number;
  /** Fraction of front-plane closure area above the crown drawn in roof colours (1 when none needed). */
  vergeShare: number;
}

export function roofFidelity(group: T.Group, facts: BuildingFacts, anchorRD: [number, number], crownTopM: number, frontIndex = 0, nearM = 2.5): RoofFidelity {
  group.updateMatrixWorld(true);
  const g = facts.heights.groundNAP, toRD = (x: number, z: number) => [x + anchorRD[0], anchorRD[1] - z];
  const planes = facts.roofsRD.map(r => ({rings: r.ringsRD, h: fitPlane(r.ringsRD[0])}));
  const surveyHeight = (p: number[]) => { let best: number | null = null; for (const r of planes) if (pointInRing(p, r.rings[0]) && !r.rings.slice(1).some(h => pointInRing(p, h))) { const z = r.h(p[0], p[1]) - g; if (best === null || Math.abs(z) > -Infinity) best = best === null ? z : Math.max(best, z); } return best; };
  const front = facts.fronts[frontIndex], [a, b] = front.endpointsRD, n = front.outwardNormalRD;
  let maxErr = 0, area = 0, near = -Infinity;
  const colours = new Set<string>();
  let closureAbove = 0, closureAboveRoof = 0;
  group.traverse(o => {
    if (!(o instanceof T.Mesh)) return;
    const geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry, p = geo.getAttribute('position');
    const isRoof = o.name.startsWith('roof/') && !o.name.startsWith('roof/step-wall') && !o.name.startsWith('roof/verge');
    const isVerge = o.name.startsWith('roof/verge'), isClosure = o.name.startsWith('shell/roof-closure');
    if (isRoof || isVerge) colours.add((o.material as T.MeshStandardMaterial).color.getHexString());
    for (let i = 0; i < p.count; i += 3) {
      const v = [0, 1, 2].map(k => new T.Vector3().fromBufferAttribute(p, i + k).applyMatrix4(o.matrixWorld));
      const centroid = v.reduce((s, x) => s.add(x), new T.Vector3()).multiplyScalar(1 / 3);
      const triArea = new T.Vector3().crossVectors(v[1].clone().sub(v[0]), v[2].clone().sub(v[0])).length() / 2;
      if (isRoof) {
        area += Math.abs((v[1].x - v[0].x) * (v[2].z - v[0].z) - (v[2].x - v[0].x) * (v[1].z - v[0].z)) / 2;
        // Compare at the triangle centroid: vertices sit on shared surface boundaries.
        const crd = toRD(centroid.x, centroid.z), s = surveyHeight(crd);
        if (s !== null && triArea > 0.01) maxErr = Math.max(maxErr, Math.abs(s - centroid.y));
        for (const x of v) {
          const rd = toRD(x.x, x.z);
          // Depth behind the front plane (RD), within the front's span.
          const along = ((rd[0] - a[0]) * (b[0] - a[0]) + (rd[1] - a[1]) * (b[1] - a[1])) / front.widthM ** 2, depth = -((rd[0] - a[0]) * n[0] + (rd[1] - a[1]) * n[1]);
          if (along >= 0 && along <= 1 && depth >= 0 && depth <= nearM) near = Math.max(near, x.y);
        }
      }
      if ((isClosure || isVerge) && centroid.y > crownTopM) { closureAbove += triArea; if (isVerge) closureAboveRoof += triArea; }
    }
  });
  const groundArea = facts.surveyFootprintPolygonsRD.reduce((s, poly) => s + poly.reduce((t, ring, k) => { const ar = Math.abs(ring.reduce((u, p, i) => { const q = ring[(i + 1) % ring.length]; return u + p[0] * q[1] - q[0] * p[1]; }, 0) / 2); return t + (k ? -ar : ar); }, 0), 0);
  return {maxPlaneErrorM: maxErr, coverage: area / groundArea, roofColours: colours.size, nearRoofOverCrownM: near - crownTopM, vergeShare: closureAbove > 1e-6 ? closureAboveRoof / closureAbove : 1};
}
