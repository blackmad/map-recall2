// The one light rig for every three.js layer in the shared frame.
//
// Before the shared frame each layer brought its own lights (landmarks: Y-up
// hemisphere + key + fill per model scene; trees, bike, zoo: their own), so
// the same afternoon looked different on a tree, a landmark and the bike.
// Now there is one sky, one sun and one shadow map in an east/north/up world.

import type { Vec3 } from './frameMath.js';
import { fitShadowCamera, shadowHalfSizeForZoom, type ShadowFit } from './shadowFit.js';

export type LightRigOptions = {
  /** Compass bearing toward the sun, degrees (0 = north, 90 = east). */
  sunAzimuthDeg?: number;
  sunElevationDeg?: number;
  sunColour?: string;
  sunIntensity?: number;
  skyColour?: string;
  groundColour?: string;
  skyIntensity?: number;
  shadows?: boolean;
  shadowMapSize?: number;
};

export const DEFAULT_LIGHT_RIG: Required<LightRigOptions> = {
  // South-south-west afternoon sun: shadows fall north-north-east, so the
  // canal-side facades that face the street on the main belt stay mostly lit.
  sunAzimuthDeg: 215,
  sunElevationDeg: 40,
  // Mood pass (2026-10-13): a warmer afternoon sun (was #fff1dc), a less blue
  // sky and a lighter, warmer street bounce (were #dbe8ff over #8d8270), so
  // shade sides read as daylight rather than dusk. Bands: docs/LOOK.md §Parity.
  sunColour: '#ffe9cc',
  sunIntensity: 2.15,
  skyColour: '#e3ebf6',
  groundColour: '#998a72',
  skyIntensity: 1.75,
  shadows: true,
  shadowMapSize: 2048,
};

/** Unit vector toward the sun in ENU. */
export function sunDirection(azimuthDeg: number, elevationDeg: number): Vec3 {
  const az = (azimuthDeg * Math.PI) / 180, el = (elevationDeg * Math.PI) / 180;
  return [Math.sin(az) * Math.cos(el), Math.cos(az) * Math.cos(el), Math.sin(el)];
}

/**
 * The one sun, for everything that is not lit by the rig itself.
 *
 * The user's "the sun moves with me" (2026-10-13) was three suns: the legacy
 * vehicles lit the model in its own frame (the light turned with the bike),
 * every legacy landmark carried a key light in model space (so its sun turned
 * with the model's placement rotation), and the streamed city baked a light
 * from the north-west while the shared rig and MapLibre's extrusion light came
 * from the south-south-west. Every layer now takes its direction from here.
 */
export const SUN_DIRECTION: Vec3 = sunDirection(DEFAULT_LIGHT_RIG.sunAzimuthDeg, DEFAULT_LIGHT_RIG.sunElevationDeg);

/** Horizontal unit vector toward the sun (east, north). */
export const SUN_HORIZONTAL: [number, number] = (() => {
  const a = (DEFAULT_LIGHT_RIG.sunAzimuthDeg * Math.PI) / 180;
  return [Math.sin(a), Math.cos(a)];
})();

/**
 * The baked (unlit) shade's light for faces that are not walls: the sun's
 * azimuth, at the bake's own steeper 53° (0.6 horizontal, 0.8 up), so a flat
 * roof keeps the level it always had (0.58 + 0.42 × 0.8 = 0.916). Walls use
 * the azimuth alone (`bakedWallShade`).
 */
export const BAKED_FACE_LIGHT: Vec3 = [SUN_HORIZONTAL[0] * 0.6, SUN_HORIZONTAL[1] * 0.6, 0.8];

/**
 * The darkest baked wall (facing straight away from the sun). Was 0.8; 0.84
 * since the mood pass (2026-10-13): shade sides read as daylight, not dusk,
 * and the sun side stays at 1.0.
 */
export const BAKED_WALL_MIN = 0.84;

/** Baked shade of a wall facing (nx, ny) (ENU, horizontal unit): BAKED_WALL_MIN facing away from the sun, 1.0 facing it. */
export function bakedWallShade(nx: number, ny: number): number {
  return BAKED_WALL_MIN + (1 - BAKED_WALL_MIN) * (0.5 + 0.5 * (nx * SUN_HORIZONTAL[0] + ny * SUN_HORIZONTAL[1]));
}

/** Baked shade of any face from its ENU unit normal (roofs, kits): 0.5–1. */
export function bakedFaceShade(n: Vec3 | readonly number[]): number {
  const d = n[0] * BAKED_FACE_LIGHT[0] + n[1] * BAKED_FACE_LIGHT[1] + n[2] * BAKED_FACE_LIGHT[2];
  return Math.max(0.5, Math.min(1, 0.58 + 0.42 * Math.max(0, d)));
}

/** A flat roof's baked shade. */
export const BAKED_LID_SHADE = bakedFaceShade([0, 0, 1]);

const glslFloat = (v: number) => (Number.isInteger(v) ? v.toFixed(1) : String(+v.toFixed(6)));

/**
 * GLSL for the baked shade: reads a unit ENU normal `n`, writes `shade`
 * (walls by `bakedWallShade`, down faces 0.5, the rest by `bakedFaceShade`).
 */
export const BAKED_SHADE_GLSL = `
  float shade;
  if (abs(n.z) < 0.5) { vec2 h = normalize(n.xy + vec2(1e-6, 0.0)); shade = ${glslFloat(BAKED_WALL_MIN)} + ${glslFloat(1 - BAKED_WALL_MIN)} * (0.5 + 0.5 * dot(h, vec2(${glslFloat(SUN_HORIZONTAL[0])}, ${glslFloat(SUN_HORIZONTAL[1])}))); }
  else if (n.z < 0.0) shade = 0.5;
  else shade = clamp(0.58 + 0.42 * max(0.0, dot(n, vec3(${BAKED_FACE_LIGHT.map(glslFloat).join(', ')}))), 0.5, 1.0);`;

/**
 * A world (ENU) direction in a model's own frame, given the model's
 * Mercator-from-local matrix (column-major, as three.js `Matrix4.elements`).
 * Legacy custom layers fold the model's placement into the camera's
 * projection, so their lights live in model space: a light placed with this
 * stays fixed in the world however the model is turned (the bike's heading,
 * a landmark's placement rotation).
 */
export function enuDirectionInLocal(mercatorFromLocal: ArrayLike<number>, enu: Vec3 | readonly number[]): Vec3 {
  const m = mercatorFromLocal;
  // Mercator +y runs south.
  const d = [enu[0], -enu[1], enu[2]];
  const a = m[0], b = m[4], c = m[8], e = m[1], f = m[5], g = m[9], h = m[2], i = m[6], k = m[10];
  const A = f * k - g * i, B = -(e * k - g * h), C = e * i - f * h;
  const det = a * A + b * B + c * C;
  if (!det) return [enu[0], enu[1], enu[2]];
  const inv = [
    A, -(b * k - c * i), b * g - c * f,
    B, a * k - c * h, -(a * g - c * e),
    C, -(a * i - b * h), a * f - b * e,
  ];
  const x = (inv[0] * d[0] + inv[1] * d[1] + inv[2] * d[2]) / det;
  const y = (inv[3] * d[0] + inv[4] * d[1] + inv[5] * d[2]) / det;
  const z = (inv[6] * d[0] + inv[7] * d[1] + inv[8] * d[2]) / det;
  const len = Math.hypot(x, y, z) || 1;
  return [x / len, y / len, z / len];
}

/**
 * MapLibre's extrusion light (`map.setLight`) for the same sun: anchored to
 * the map, azimuthal angle = the sun's azimuth, polar angle from the zenith.
 */
export function mapLibreSunPosition(radial = 1.25): [number, number, number] {
  return [radial, DEFAULT_LIGHT_RIG.sunAzimuthDeg, 90 - DEFAULT_LIGHT_RIG.sunElevationDeg];
}

export type LightRig = {
  readonly sun: any;
  readonly sky: any;
  readonly toSun: Vec3;
  readonly options: Required<LightRigOptions>;
  readonly objects: any[];
  /** Fit the sun's shadow box around a focus. Positions are world (eye-relative) metres; `toWorld` maps absolute → world. */
  follow(focusAbs: Vec3, zoom: number, toWorld: (abs: Vec3) => Vec3, snapStepM?: number): ShadowFit;
  /** Move the sun (time of day, debugging). Takes effect on the next follow(). */
  setSun(azimuthDeg: number, elevationDeg: number): void;
};

export function createLightRig(THREE: any, overrides: LightRigOptions = {}): LightRig {
  const options = { ...DEFAULT_LIGHT_RIG, ...overrides };
  const toSun = sunDirection(options.sunAzimuthDeg, options.sunElevationDeg);
  const sky = new THREE.HemisphereLight(options.skyColour, options.groundColour, options.skyIntensity);
  // HemisphereLight's "up" is its position; the shared world is z-up.
  sky.position.set(0, 0, 1);
  const sun = new THREE.DirectionalLight(options.sunColour, options.sunIntensity);
  sun.castShadow = options.shadows;
  sun.shadow.mapSize.set(options.shadowMapSize, options.shadowMapSize);
  // Light-space basis must match shadowFit.lightBasis (up = +z) for texel snapping.
  sun.shadow.camera.up.set(0, 0, 1);
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.25;
  // Direction is what lights; position only matters to the shadow camera.
  sun.position.set(toSun[0] * 100, toSun[1] * 100, toSun[2] * 100);
  sun.name = 'shared-frame-sun';
  sky.name = 'shared-frame-sky';
  let lastHalf = 0;
  const rig: LightRig = {
    sun, sky, toSun, options,
    objects: [sky, sun, sun.target],
    follow(focusAbs, zoom, toWorld, snapStepM) {
      const halfSizeM = shadowHalfSizeForZoom(zoom);
      const fit = fitShadowCamera({ focusAbs, toSun, halfSizeM, mapSize: options.shadowMapSize, snapStepM });
      const target = toWorld(fit.targetAbs), light = toWorld(fit.lightAbs);
      sun.target.position.set(target[0], target[1], target[2]);
      sun.position.set(light[0], light[1], light[2]);
      sun.target.updateMatrixWorld();
      const cam = sun.shadow.camera;
      if (halfSizeM !== lastHalf || cam.far !== fit.far) {
        lastHalf = halfSizeM;
        Object.assign(cam, { left: fit.left, right: fit.right, top: fit.top, bottom: fit.bottom, near: fit.near, far: fit.far });
        cam.updateProjectionMatrix();
      }
      return fit;
    },
    setSun(azimuthDeg, elevationDeg) {
      const next = sunDirection(azimuthDeg, elevationDeg);
      toSun[0] = next[0]; toSun[1] = next[1]; toSun[2] = next[2];
      options.sunAzimuthDeg = azimuthDeg; options.sunElevationDeg = elevationDeg;
      lastHalf = 0;
    },
  };
  return rig;
}
