/**
 * Procedural roofs OSM Buildings draws and fill-extrusions cannot.
 *
 * A MapLibre `fill-extrusion` is a prism with a flat top. The Waag's identity
 * is seven `roof:shape=pyramidal` turrets with `roof:height` — cones, not lids.
 * This module turns a footprint ring into the triangle fan OSM Buildings uses:
 * base at the eaves, apex above the centroid at the tagged height.
 *
 * Vertices stay in geographic coordinates. The custom layer converts each one
 * with `MercatorCoordinate.fromLngLat(..., altitude)` so height is MapLibre's
 * altitude, not a Three.js axis that has to be rotated into the map.
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

export type PyramidalRoofVertex = {
  lng: number;
  lat: number;
  /** Metres above ground; passed to MapLibre as altitude. */
  altM: number;
};

export type PyramidalRoofMesh = {
  /** Apex first, then the eaves ring. */
  vertices: PyramidalRoofVertex[];
  /** Triangle indices into `vertices` (3 per face). */
  indices: Uint16Array;
  colour: string;
  originLng: number;
  originLat: number;
};

/**
 * Eaves height for a part that carries an OSM roof.
 *
 * `height` is the apex (or ridge). `roof:height` is the roof's own thickness.
 * Walls stop at height − roof:height; without a roof height the whole prism
 * stays a wall and this module has nothing to draw — unless the shape is
 * pyramidal, in which case OSM Buildings still draws a cone and we invent a
 * tip so the Oude Kerk spire is not a grey cylinder.
 */
export function eavesHeightM(heightM: number, roofHeightM: number | null | undefined): number {
  if (!(heightM > 0)) return 0;
  if (roofHeightM == null || !(roofHeightM > 0)) return heightM;
  return Math.max(0, heightM - roofHeightM);
}

/**
 * Roof thickness used for meshing and for stopping walls at the eaves.
 *
 * Tagged `roof:height` wins. For `roof:shape=pyramidal` without a tag, invent a
 * tip as 35% of the exposed part height, clamped to 3–12 m — enough to read as
 * a spire without inventing a skyscraper hat.
 */
export function effectiveRoofHeightM(props: {
  roofShape?: string | null;
  roofHeight?: number | null;
  height?: number | null;
  minHeight?: number | null;
}): number {
  const tagged = Number(props.roofHeight ?? 0);
  if (tagged > 0) return tagged;
  if ((props.roofShape || '') !== 'pyramidal') return 0;
  const height = Number(props.height ?? 0);
  const minHeight = Math.max(0, Number(props.minHeight ?? 0));
  if (!(height > minHeight)) return 0;
  const exposed = height - minHeight;
  return Math.min(12, Math.max(3, 0.35 * exposed));
}

/** True when this feature should get a procedural pyramidal roof, not a flat cap. */
export function wantsPyramidalRoof(props: {
  roofShape?: string | null;
  roofHeight?: number | null;
  height?: number | null;
  minHeight?: number | null;
}): boolean {
  if ((props.roofShape || '') !== 'pyramidal') return false;
  const height = Number(props.height ?? 0);
  const roofHeight = effectiveRoofHeightM(props);
  return height > 0 && roofHeight > 0 && roofHeight < height;
}

/**
 * Build a pyramid: one triangle per ring edge, from edge → apex.
 *
 * Returns geographic vertices so the renderer never has to guess which Three
 * axis is "up". A fan over a concave outline can look clumsy; it cannot
 * stretch a vertex to mercator (0,0), which is what the earlier local-metre
 * + rotateX packing did on screen.
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
  if (!Number.isFinite(originLng) || !Number.isFinite(originLat)) return null;

  const vertices: PyramidalRoofVertex[] = [
    { lng: originLng, lat: originLat, altM: apexHeightM },
  ];
  for (const [lng, lat] of open) {
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
    vertices.push({ lng, lat, altM: eaves });
  }

  const indices = new Uint16Array(open.length * 3);
  for (let i = 0; i < open.length; i++) {
    const a = i + 1;
    const b = i + 1 < open.length ? i + 2 : 1;
    const o = i * 3;
    indices[o] = 0;
    indices[o + 1] = a;
    indices[o + 2] = b;
  }

  return {
    vertices,
    indices,
    colour: colour || '#708090',
    originLng,
    originLat,
  };
}
