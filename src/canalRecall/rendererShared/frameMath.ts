// Frame-space maths for the shared three.js frame inside MapLibre.
//
// "World" in the shared frame is east/north/up metres relative to the camera
// eye. MapLibre hands every custom layer one matrix per frame, `mainMatrix`
// (Web Mercator [0,1]² + altitude → clip). Everything we draw is placed by a
// "local → Mercator" matrix that each legacy layer already computes. Putting
// the world origin at the eye:
//
// - keeps every model-view translation small (no float32 jitter anywhere in
//   the city, unlike one fixed origin per layer);
// - makes three's view space coincide with a translated world, so lighting
//   (and the specular view vector, which three derives from -mvPosition) is
//   computed from where the camera really is;
// - lets one directional light and one shadow camera serve every layer.
//
// Matrices here are plain column-major 16-number arrays (the layout of both
// gl-matrix and three's Matrix4.elements) so this file has no runtime deps.

export type Mat4 = ArrayLike<number>;
export type Vec3 = [number, number, number];

const EARTH_RADIUS_M = 6378137;
const EARTH_CIRCUMFERENCE_M = 2 * Math.PI * EARTH_RADIUS_M;

/** Latitude (degrees) of a Web Mercator y in [0, 1] (0 = north edge). */
export function latitudeOfMercatorY(y: number): number {
  return (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI;
}

/** MapLibre's `MercatorCoordinate.meterInMercatorCoordinateUnits()` at y. */
export function mercatorUnitsPerMetre(y: number): number {
  const lat = (latitudeOfMercatorY(y) * Math.PI) / 180;
  return 1 / (EARTH_CIRCUMFERENCE_M * Math.cos(lat));
}

/** Web Mercator of a lng/lat (altitude in metres), as MapLibre computes it. */
export function mercatorOfLngLat(lng: number, lat: number, altitudeM = 0): Vec3 {
  const x = (180 + lng) / 360;
  const y = (180 - (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))) / 360;
  return [x, y, altitudeM * mercatorUnitsPerMetre(y)];
}

/** 4x4 inverse (column-major). Returns null for a singular matrix. */
export function invert(m: Mat4): number[] | null {
  const [a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33] = Array.from(m);
  const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10;
  const b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30;
  const b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
  const det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (!det || !Number.isFinite(det)) return null;
  const d = 1 / det;
  return [
    (a11 * b11 - a12 * b10 + a13 * b09) * d, (a02 * b10 - a01 * b11 - a03 * b09) * d,
    (a31 * b05 - a32 * b04 + a33 * b03) * d, (a22 * b04 - a21 * b05 - a23 * b03) * d,
    (a12 * b08 - a10 * b11 - a13 * b07) * d, (a00 * b11 - a02 * b08 + a03 * b07) * d,
    (a32 * b02 - a30 * b05 - a33 * b01) * d, (a20 * b05 - a22 * b02 + a23 * b01) * d,
    (a10 * b10 - a11 * b08 + a13 * b06) * d, (a01 * b08 - a00 * b10 - a03 * b06) * d,
    (a30 * b04 - a31 * b02 + a33 * b00) * d, (a21 * b02 - a20 * b04 - a23 * b00) * d,
    (a11 * b07 - a10 * b09 - a12 * b06) * d, (a00 * b09 - a01 * b07 + a02 * b06) * d,
    (a31 * b01 - a30 * b03 - a32 * b00) * d, (a20 * b03 - a21 * b01 + a22 * b00) * d,
  ];
}

export function multiply(a: Mat4, b: Mat4): number[] {
  const out = new Array<number>(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let s = 0;
    for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
    out[c * 4 + r] = s;
  }
  return out;
}

/**
 * The camera centre of a perspective clip matrix: the one point every clip
 * ray passes through, i.e. M⁻¹·(0,0,±1,0) de-homogenised. Recovering the eye
 * from the matrix we are given (instead of a private MapLibre field) keeps the
 * frame exactly consistent with what MapLibre draws.
 */
export function eyeOfClipMatrix(clipFromMercator: Mat4): Vec3 | null {
  const inverse = invert(clipFromMercator);
  if (!inverse) return null;
  // Column 2 of the inverse is M⁻¹·(0,0,1,0).
  const w = inverse[11];
  if (!w || !Number.isFinite(w)) return null;
  return [inverse[8] / w, inverse[9] / w, inverse[10] / w];
}

/** Mercator ← world (east/north/up metres about `origin`). */
export function mercatorFromWorld(origin: Vec3, unitsPerMetre = mercatorUnitsPerMetre(origin[1])): number[] {
  const u = unitsPerMetre;
  return [u, 0, 0, 0, 0, -u, 0, 0, 0, 0, u, 0, origin[0], origin[1], origin[2], 1];
}

/** World ← Mercator, the exact inverse of `mercatorFromWorld`. */
export function worldFromMercator(origin: Vec3, unitsPerMetre = mercatorUnitsPerMetre(origin[1])): number[] {
  const k = 1 / unitsPerMetre;
  return [k, 0, 0, 0, 0, -k, 0, 0, 0, 0, k, 0, -origin[0] * k, origin[1] * k, -origin[2] * k, 1];
}

export type FrameMatrices = {
  /** Eye in Mercator. */
  eye: Vec3;
  unitsPerMetre: number;
  mercatorFromWorld: number[];
  worldFromMercator: number[];
  /** Goes on the shared camera's projectionMatrix (its view matrix stays identity). */
  clipFromWorld: number[];
};

/** Everything the shared frame needs from MapLibre's matrix, once per frame. */
export function frameMatrices(clipFromMercator: Mat4): FrameMatrices | null {
  const eye = eyeOfClipMatrix(clipFromMercator);
  if (!eye || !eye.every(Number.isFinite)) return null;
  const unitsPerMetre = mercatorUnitsPerMetre(eye[1]);
  const mFromW = mercatorFromWorld(eye, unitsPerMetre);
  return {
    eye, unitsPerMetre,
    mercatorFromWorld: mFromW,
    worldFromMercator: worldFromMercator(eye, unitsPerMetre),
    clipFromWorld: multiply(clipFromMercator, mFromW),
  };
}

/** A Mercator point in frame world metres. */
export function worldOfMercator(frame: Pick<FrameMatrices, 'eye' | 'unitsPerMetre'>, p: Vec3): Vec3 {
  const k = 1 / frame.unitsPerMetre;
  return [(p[0] - frame.eye[0]) * k, -(p[1] - frame.eye[1]) * k, (p[2] - frame.eye[2]) * k];
}
