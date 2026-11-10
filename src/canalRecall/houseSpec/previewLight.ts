/**
 * The lit city look's light for the Node house preview (docs/house-line.md §2): the shared rig of the ride
 * (rendererShared/lightRig.ts, the sunny look by default) and the chunk wall gain (threeBuildingsBrowser.ts:
 * `litFacadeWallGain(LOOK_VARIANTS[look].litWallGain)` x look/cityLook.ts CITY_LIT_LEVELS), in the form
 * softRaster.ts `LitShading` takes. Three.js colour management reads the rig's hex colours as sRGB and lights in
 * linear, so every colour here is linear and multiplied by its intensity.
 */
import { lightRigFor, sunDirection } from '../rendererShared/lightRig.ts';
import { CITY_LIT_LEVELS } from '../look/cityLook.ts';
import { LOOK_VARIANTS } from '../look/palette.ts';
import { litFacadeWallGain, srgbToLinear, type SceneLook } from '../look/sunny.ts';
import type { LitShading, Vec3 } from './softRaster.ts';

/** cityLook.ts SKY_TINT (a GLSL literal there). */
export const PREVIEW_SKY_TINT: Vec3 = [0.035, 0.05, 0.07];

const linear = (hex: string, k: number): Vec3 => {
  const h = hex.replace('#', '');
  return [0, 2, 4].map(i => srgbToLinear(parseInt(h.slice(i, i + 2), 16)) * k) as unknown as Vec3;
};

export function cityLitShading(look: SceneLook = 'sunny', atlasLook: keyof typeof LOOK_VARIANTS = 'photo'): LitShading & { look: SceneLook; sunAzimuthDeg: number; sunElevationDeg: number } {
  const rig = lightRigFor(look);
  return {
    look, sunAzimuthDeg: rig.sunAzimuthDeg, sunElevationDeg: rig.sunElevationDeg,
    sunDir: sunDirection(rig.sunAzimuthDeg, rig.sunElevationDeg),
    sun: linear(rig.sunColour, rig.sunIntensity),
    sky: linear(rig.skyColour, rig.skyIntensity),
    ground: linear(rig.groundColour, rig.skyIntensity),
    wallGain: litFacadeWallGain(LOOK_VARIANTS[atlasLook].litWallGain, look) * CITY_LIT_LEVELS[look],
    skyTint: PREVIEW_SKY_TINT,
  };
}
