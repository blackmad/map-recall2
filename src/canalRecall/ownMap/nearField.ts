// The near field: the own-ground modules (src/canalRecall/ownGround/, owned by
// the render/own-ground-game lane) drawing street bands by OSM cross-section,
// parks/squares, sunken canal water and quay walls around the rider, in the
// same local frame as the overview. The overview hides itself inside the
// near radius with the shared `handover` uniforms (layers.ts), so the two
// cross-fade instead of overlapping.
//
// Flat here (height ≡ 0, water at the elevation layer's −1.77 m): relief and
// measured decks are the own-ground lane's job; this proves the handover, not
// the ground. Only where an own-ground OSM extract exists (two 1.5 km boxes).

import * as THREE from 'three';
import earcut from 'earcut';
import { toLocal, type Vec2 } from './frame';
import { OWN_GROUND_BOXES, type GroundBox } from '../ownGround/boxes';
import type { OsmGroundExtract } from '../ownGround/osmGround';
import { buildStreets, prepareWays, LIFT } from '../ownGround/streets';
import { drapeTriangles, emptyMesh, merge, triangleCount, type MeshArrays } from '../ownGround/drape';
import { quayWallMesh, waterSurfaceMesh, type WaterGeometry } from '../ownGround/water';
import { localToLngLat, type ElevationIndex, type WaterCell } from '../elevation/elevationData';

export const WATER_Z = -1.77;
const flat = () => 0;

export function boxFor(p: Vec2): GroundBox | null {
  for (const b of OWN_GROUND_BOXES) {
    const [x, y] = toLocal(b.lng, b.lat);
    if (Math.abs(p[0] - x) <= b.halfM && Math.abs(p[1] - y) <= b.halfM) return b;
  }
  return null;
}

const COLOURS: Record<string, string> = {
  asphalt: '#5f6266', klinker: '#8e6b5c', cycle: '#a5544b', paving: '#b9b0a2', gravel: '#ab9f88', paint: '#f1efe6', kerb: '#9c978e',
  park: '#9cbf78', wood: '#7fa262', square: '#c7beb0', parking: '#8f9094', water: '#3f6b78', quay: '#7a5a49',
};

function mesh(data: MeshArrays, colour: string, order: number): THREE.Mesh | null {
  if (!data.indices.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(Float32Array.from(data.positions), 3));
  g.setIndex(new THREE.BufferAttribute(Uint32Array.from(data.indices), 1));
  if (data.colors) g.setAttribute('color', new THREE.BufferAttribute(Float32Array.from(data.colors, c => c ** 2.2), 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: data.colors ? '#ffffff' : colour, vertexColors: !!data.colors }));
  m.renderOrder = order;
  return m;
}

export interface NearFieldStats { box: string; ways: number; triangles: number; buildMs: number }

/**
 * Water near the rider from elevation-v1 cells (the same decode as
 * ownGround/main.ts loadWater): polygons plus the true shorelines, so quay
 * walls stand only on real shores, not on the 1 km cell seams.
 */
export function waterFromCells(index: ElevationIndex, cells: readonly WaterCell[]): WaterGeometry {
  const toScene = (x: number, y: number): Vec2 => { const [lng, lat] = localToLngLat(index, x, y); return toLocal(lng, lat); };
  const quant = index.quantization.xy;
  const geo: WaterGeometry = { polygons: [], shores: [] };
  for (const cell of cells) {
    const ox = cell.cell[0] * index.cellSizeM, oy = cell.cell[1] * index.cellSizeM;
    const ring = (r: number[]) => { const out: Vec2[] = []; for (let i = 0; i < r.length; i += 2) out.push(toScene(ox + r[i] * quant, oy + r[i + 1] * quant)); return out; };
    for (const poly of cell.water) geo.polygons.push(poly.map(ring));
    for (const line of cell.shore) geo.shores.push(ring(line));
  }
  return geo;
}

/** Build the near field from a box's own-ground extract and the water round the rider. */
export function buildNearField(osm: OsmGroundExtract, water: WaterGeometry, centre: Vec2, radius: number): { group: THREE.Group; stats: NearFieldStats } {
  const t0 = performance.now();
  const near = (p: Vec2) => Math.hypot(p[0] - centre[0], p[1] - centre[1]) < radius;
  const project = (p: [number, number]) => toLocal(p[0], p[1]);
  const group = new THREE.Group();
  const add = (m: THREE.Mesh | null) => { if (m) group.add(m); };
  let tris = 0;

  const areas: Record<string, MeshArrays> = { park: emptyMesh(), wood: emptyMesh(), square: emptyMesh(), parking: emptyMesh() };
  for (const a of osm.areas) {
    const target = a.kind === 'grass' ? areas.park : a.kind === 'paved' ? areas.square : areas[a.kind];
    if (!target) continue;
    for (const r of a.rings) {
      const pts = r.slice(0, -1).map(project);
      if (pts.length < 3 || !pts.some(near)) continue;
      const f = pts.flatMap(p => [p[0], p[1]]);
      drapeTriangles(target, f, earcut(f), flat, LIFT.area, 8);
    }
  }
  for (const [k, m] of Object.entries(areas)) { tris += triangleCount(m); add(mesh(m, COLOURS[k], 20)); }

  const ways = prepareWays(osm.ways, project).filter(w => w.points.some(near));
  const streets = buildStreets(ways, flat, { step: 6 });
  for (const s of ['paving', 'klinker', 'asphalt', 'cycle', 'gravel', 'kerb', 'paint'] as const) { tris += triangleCount(streets[s]); add(mesh(streets[s], COLOURS[s], 21)); }

  const geo: WaterGeometry = {
    polygons: water.polygons.filter(p => p[0].some(near)),
    // Consecutive runs inside the radius (filtering points would bridge gaps with long walls).
    shores: water.shores.flatMap(l => {
      const runs: Vec2[][] = [[]];
      for (const p of l) { if (near(p)) runs[runs.length - 1].push(p); else if (runs[runs.length - 1].length) runs.push([]); }
      return runs.filter(r => r.length > 1);
    }),
  };
  const surface = waterSurfaceMesh(geo, WATER_Z);
  const quay = quayWallMesh({ polygons: [], shores: geo.shores }, flat, WATER_Z, 4);
  tris += triangleCount(surface) + triangleCount(quay);
  add(mesh(surface, COLOURS.water, 19));
  add(mesh(merge([quay]), COLOURS.quay, 19));
  return { group, stats: { box: osm.box, ways: ways.length, triangles: tris, buildMs: Math.round(performance.now() - t0) } };
}
