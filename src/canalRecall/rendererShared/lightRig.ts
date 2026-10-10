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
  sunColour: '#fff1dc',
  sunIntensity: 2.1,
  skyColour: '#dbe8ff',
  groundColour: '#8d8270',
  skyIntensity: 1.75,
  shadows: true,
  shadowMapSize: 2048,
};

/** Unit vector toward the sun in ENU. */
export function sunDirection(azimuthDeg: number, elevationDeg: number): Vec3 {
  const az = (azimuthDeg * Math.PI) / 180, el = (elevationDeg * Math.PI) / 180;
  return [Math.sin(az) * Math.cos(el), Math.cos(az) * Math.cos(el), Math.sin(el)];
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
