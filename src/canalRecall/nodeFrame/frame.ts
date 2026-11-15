/**
 * The node frame's world (lane node-world-frames): metres about the camera's lng/lat on the ground, x east, y north,
 * z up, reached through the game's own Web Mercator, so every layer lands where the browser's shared frame puts it.
 *
 * The game renders in Mercator with each layer's mercator-from-local matrix (buildingProjectionScale.ts for the
 * building chunks and the own ground: local metres about ORIGIN, north in 110,540 m a degree; GLB placements in
 * their own). The camera (mapCamera.ts cameraFrame, the first-person pose) is in east/north metres about its centre.
 * Here a Mercator point becomes camera metres by the equatorial metre at the camera's latitude, as the engine's
 * cameraMap does; heights carry the same scale.
 */
import { buildingMercatorFromLocal } from '../buildingProjectionScale.ts';
import { mercatorOfLngLat, mercatorUnitsPerMetre } from '../rendererShared/frameMath.ts';

export type GeoFrame = {
  lng: number; lat: number;
  /** Mercator of the camera's ground point. */
  mx: number; my: number;
  unitsPerMetre: number;
};

export function geoFrame(lngLat: readonly [number, number] | readonly number[]): GeoFrame {
  const m = mercatorOfLngLat(lngLat[0], lngLat[1]);
  return { lng: lngLat[0], lat: lngLat[1], mx: m[0], my: m[1], unitsPerMetre: mercatorUnitsPerMetre(m[1]) };
}

/** lng/lat (+ metres up) → camera metres. */
export function worldOfLngLat(f: GeoFrame, lng: number, lat: number, z = 0): [number, number, number] {
  const m = mercatorOfLngLat(lng, lat);
  return [(m[0] - f.mx) / f.unitsPerMetre, -(m[1] - f.my) / f.unitsPerMetre, z];
}

/**
 * An affine map (column-major 4x4 like three's Matrix4.elements, local → Mercator) composed with Mercator → camera
 * metres: returns a function writing world positions for local ones.
 */
export function localToWorld(f: GeoFrame, mercatorFromLocal: ArrayLike<number>): (x: number, y: number, z: number, out: Float32Array | Float64Array, o: number) => void {
  const m = mercatorFromLocal, k = 1 / f.unitsPerMetre;
  return (x, y, z, out, o) => {
    const mx = m[0] * x + m[4] * y + m[8] * z + m[12], my = m[1] * x + m[5] * y + m[9] * z + m[13], mz = m[2] * x + m[6] * y + m[10] * z + m[14];
    out[o] = (mx - f.mx) * k; out[o + 1] = -(my - f.my) * k; out[o + 2] = mz * k;
  };
}

/** The building chunks' and own ground's local frame (metres about `origin`, z up) → camera metres. */
export function chunkToWorld(f: GeoFrame, origin: { lng: number; lat: number }) {
  return localToWorld(f, buildingMercatorFromLocal(origin));
}

/** Transform a packed position array (3 per vertex) into a new Float32Array of camera metres, z lifted by `dz`. */
export function transformPositions(positions: ArrayLike<number>, map: ReturnType<typeof localToWorld>, dz = 0, unit = 1): Float32Array {
  const n = Math.floor(positions.length / 3), out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { map(positions[i * 3] * unit, positions[i * 3 + 1] * unit, positions[i * 3 + 2] * unit + dz, out, i * 3); }
  return out;
}
