/**
 * Roof-fidelity measurements for the held canalhouse roof problem
 * ("uniform taupe masses and tall rear ridges dominate crowns",
 * Bloemgracht 78–90). Pure functions over a compiled group + facts.
 */
import * as T from 'three';
import type {BuildingFacts} from './facts.ts';
import {fitPlane, pointInRing} from './facts.ts';
import type {Gate} from './gates.ts';
import {openingsWithinWalls, WITHIN_WALLS, type WithinWallsReport} from '../landmarks/geometryAudit.ts';
import type {MaterialSoup} from '../landmarks/facadeCompare.ts';

/**
 * A compiled kit group as a material soup for the landmark geometry audit: one material per slot (`slotFor`, the same
 * mapping the GLB exporter uses), world-space triangles, so the audit sees what ships.
 */
export function groupSoup(group: T.Group, slotFor: (m: T.Mesh) => string): MaterialSoup {
  group.updateMatrixWorld(true);
  const names: string[] = [], positions: number[] = [], triMaterial: number[] = [];
  const v = new T.Vector3();
  group.traverse(o => {
    if (!(o instanceof T.Mesh)) return;
    const slot = slotFor(o) || 'brick';
    let k = names.indexOf(slot);
    if (k < 0) { k = names.length; names.push(slot); }
    const geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry, p = geo.getAttribute('position');
    for (let i = 0; i < p.count; i += 3) {
      for (let j = 0; j < 3; j++) { v.fromBufferAttribute(p, i + j).applyMatrix4(o.matrixWorld); positions.push(v.x, v.y, v.z); }
      triMaterial.push(k);
    }
  });
  return {positions, indices: Array.from({length: positions.length / 3}, (_, i) => i), triMaterial, materials: names.map(name => ({name, rgb: [128, 128, 128] as [number, number, number], slot: name, materialSlot: name}))};
}

/**
 * Gate for block faces and large recipes (2026-10-16, with the landmark pipeline): every opening part (glass, frame, door) lies
 * inside its host wall's silhouette (5 cm) and crosses no roof plane; fails on any part with more than 0.02 m2 outside. Catches a
 * roof plane drawn above a parapet across the top windows (De Baarsjes) as well as a window run past a gable rake.
 * Advisory (reported, not counted) until OPENINGS_WITHIN_WALLS=strict: on 2026-10-16 it failed 19 of 22 installed chunks and the
 * sampled houses (attic windows sunk in the 3DBAG roof mass), which the kit lane triages; the landmark gate is hard from the start.
 */
export function openingsWithinWallsGate(group: T.Group, slotFor: (m: T.Mesh) => string): {gate: Gate; report: WithinWallsReport} {
  const report = openingsWithinWalls(groupSoup(group, slotFor));
  const worst = report.failing[0];
  return {report, gate: {id: 'openings-within-walls', pass: report.failing.length === 0, ...(process.env.OPENINGS_WITHIN_WALLS === 'strict' ? {} : {advisory: true}),
    value: {outsideM2: report.outsideM2, failing: report.failing.length, judged: report.judged, hostless: report.hostless,
      ...(worst ? {worst: {outsideM2: worst.outsideM2, roofM2: worst.roofM2, piercesRoof: worst.piercesRoof, materials: worst.materials, centre: worst.centre.map(x => +x.toFixed(2))}} : {})},
    limit: `no opening part > ${WITHIN_WALLS.failM2} m2 outside its wall (tol ${WITHIN_WALLS.tol} m) or through a roof plane`}};
}

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
  // Survey surface height: the plane fit for planar rings; for rings made non-planar by
  // roofCleanup's front hip, the same ShapeUtils triangulation surveyRecipe compiles.
  const planes = facts.roofsRD.map(r => {
    const flat = r.ringsRD.flat(), plane = fitPlane(r.ringsRD[0]);
    const planar = flat.every(v => Math.abs(plane(v[0], v[1]) - v[2]) < 0.02);
    const tris = planar ? [] : T.ShapeUtils.triangulateShape(r.ringsRD[0].map(v => new T.Vector2(v[0] - anchorRD[0], anchorRD[1] - v[1])), r.ringsRD.slice(1).map(h => h.map(v => new T.Vector2(v[0] - anchorRD[0], anchorRD[1] - v[1])))).map(t => t.map(i => flat[i]));
    const h = planar ? plane : (x: number, y: number) => {
      for (const [A, B, C] of tris) {
        const d = (B[1] - C[1]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[1] - C[1]); if (Math.abs(d) < 1e-12) continue;
        const l1 = ((B[1] - C[1]) * (x - C[0]) + (C[0] - B[0]) * (y - C[1])) / d, l2 = ((C[1] - A[1]) * (x - C[0]) + (A[0] - C[0]) * (y - C[1])) / d, l3 = 1 - l1 - l2;
        if (l1 >= -1e-6 && l2 >= -1e-6 && l3 >= -1e-6) return l1 * A[2] + l2 * B[2] + l3 * C[2];
      }
      return plane(x, y);
    };
    return {rings: r.ringsRD, h};
  });
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
