/**
 * Procedural roofs OSM Buildings draws and fill-extrusions cannot.
 *
 * A MapLibre `fill-extrusion` is a prism with a flat top. The Waag's identity
 * is seven `roof:shape=pyramidal` turrets with `roof:height` — cones, not lids.
 * This module turns a footprint ring into the triangle fan OSM Buildings uses:
 * base at the eaves, apex above the centroid at the tagged height.
 */

import type { Ring } from './buildingGeometry.js';
import { ringCentroid } from './buildingGeometry.js';

export type PyramidalRoofInput = {
  /** Outer ring, `[lng, lat]`, preferably closed. */
  ring: Ring;
  /** Absolute height of the apex above local ground, metres. */
  apexHeightM: number;
  /** Height of the eaves / wall top above local ground, metres. */
  eavesHeightM: number;
  /** Roof colour as CSS hex, optional. */
  colour?: string;
};

export type PyramidalRoofMesh = {
  /**
   * Interleaved positions in local metres for MapLibre+Three: [e, u, n, ...].
   * Same as GLTF Y-up — the custom layer's `rotateX(π/2)` + `(s,-s,s)` scale
   * then maps that into mercator (x, y, z=altitude).
   */
  positions: Float32Array;
  /** Triangle indices into `positions` (3 per face). */
  indices: Uint32Array;
  colour: string;
  /** Footprint centroid — MapLibre places the mesh here. */
  originLng: number;
  originLat: number;
};

/**
 * Eaves height for a part that carries an OSM roof.
 *
 * `height` is the apex (or ridge). `roof:height` is the roof's own thickness.
 * Walls stop at height − roof:height; without a roof height the whole prism
 * stays a wall and this module has nothing to draw.
 */
export function eavesHeightM(heightM: number, roofHeightM: number | null | undefined): number {
  if (!(heightM > 0)) return 0;
  if (roofHeightM == null || !(roofHeightM > 0)) return heightM;
  return Math.max(0, heightM - roofHeightM);
}

/** True when this feature should get a procedural pyramidal roof, not a flat cap. */
export function wantsPyramidalRoof(props: {
  roofShape?: string | null;
  roofHeight?: number | null;
  height?: number | null;
}): boolean {
  if ((props.roofShape || '') !== 'pyramidal') return false;
  const height = Number(props.height ?? 0);
  const roofHeight = Number(props.roofHeight ?? 0);
  return height > 0 && roofHeight > 0 && roofHeight < height;
}

/**
 * Build a pyramid: one triangle per ring edge, from edge → apex.
 *
 * Footprint lng/lat become local east/north metres about the centroid. Height
 * is stored on Three's Y so the shared MapLibre custom-layer transform (same
 * as bikes, boats, signature GLBs) lifts the apex into mercator altitude —
 * not sideways along the map, which is what the earlier ENU packing did.
 */
export function pyramidalRoofMesh(input: PyramidalRoofInput): PyramidalRoofMesh | null {
  const { ring, apexHeightM, eavesHeightM: eaves, colour } = input;
  if (ring.length < 3) return null;
  if (!(apexHeightM > eaves) || !(eaves >= 0)) return null;

  const open = ring.length > 1
    && ring[0][0] === ring[ring.length - 1][0]
    && ring[0][1] === ring[ring.length - 1][1]
    ? ring.slice(0, -1)
    : ring.slice();
  if (open.length < 3) return null;

  const [originLng, originLat] = ringCentroid(open);
  const metresPerDegLat = 111320;
  const metresPerDegLng = 111320 * Math.cos(originLat * Math.PI / 180);

  const toEastNorth = (lng: number, lat: number): [number, number] => [
    (lng - originLng) * metresPerDegLng,
    (lat - originLat) * metresPerDegLat,
  ];

  // Vertex 0 = apex; 1..n = eaves ring. Layout: [east, up, north].
  const positions = new Float32Array((open.length + 1) * 3);
  positions[0] = 0;
  positions[1] = apexHeightM;
  positions[2] = 0;
  for (let i = 0; i < open.length; i++) {
    const [e, n] = toEastNorth(open[i][0], open[i][1]);
    const o = (i + 1) * 3;
    positions[o] = e;
    positions[o + 1] = eaves;
    positions[o + 2] = n;
  }

  // GeoJSON exterior rings are CCW from above; (apex, a, b) then faces outward.
  const indices = new Uint32Array(open.length * 3);
  for (let i = 0; i < open.length; i++) {
    const a = i + 1;
    const b = i + 1 < open.length ? i + 2 : 1;
    const o = i * 3;
    indices[o] = 0;
    indices[o + 1] = a;
    indices[o + 2] = b;
  }

  return {
    positions,
    indices,
    colour: colour || '#708090',
    originLng,
    originLat,
  };
}
