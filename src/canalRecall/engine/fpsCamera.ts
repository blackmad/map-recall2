// First-person riding camera (issue #171, lane fps-camera-20261109). Pure maths: no three.js, no DOM.
//
// The engine's camera is MapLibre's model (centre, zoom, bearing, pitch, fov; ownMap/mapCamera.ts cameraFrame): the
// eye sits `distance` metres from the centre along the view, `distance = focal * metresPerPixel`. A first-person eye
// is that same model with a long, almost level view: at pitch P (degrees from straight down) the eye is
// `distance * cos(P)` above the centre's ground and `distance * sin(P)` behind it. Choosing the distance so the height
// is EYE_HEIGHT_M and the horizontal offset puts the eye on the rider gives the whole pose in the existing fields, so
// every consumer that reads the camera (labels, ground residency, ring planning, the host's projection matrix) keeps
// working unchanged. Only the pose maths lives here; ownWorldView.ts applies it and engine/cameraMap.ts takes the
// near-plane and far-plane options it needs.

import { DEFAULT_FOV_DEG, EARTH_RADIUS, MAX_PITCH_DEG } from '../ownMap/mapCamera';

/** Eye height over the road, metres (the issue's 1.6 m). */
export const FPS_EYE_HEIGHT_M = 1.6;
/** Vertical field of view, degrees (brief: 70-75). */
export const FPS_FOV_DEG = 72;
/** The view looks this far below the horizon, degrees ("slight forward pitch"); pitch = 90 - this, capped by the map's ceiling. */
export const FPS_LOOK_DOWN_DEG = 5;
/** Near plane = eye-to-centre distance / this (the chase view's is 50: 0.37 m here, which clips a wall at arm's length). */
export const FPS_NEAR_DIVISOR = 120;
/** The far plane never passes this many metres: a level view's horizon would otherwise ask for kilometres of depth range. */
export const FPS_FAR_CAP_M = 2500;
/** Yaw smoothing time constant, seconds (a light low-pass on the heading; the chase view's dead band would lag a steer). */
export const FPS_YAW_TAU_S = 0.12;
/** Head bob: vertical amplitude, metres, and its stride length per cycle (off unless asked for). */
export const FPS_BOB_AMPLITUDE_M = 0.025;
export const FPS_BOB_STRIDE_M = 2.4;

export interface FpsPoseInput {
  /** The rider, [lng, lat]. */
  rider: readonly [number, number];
  /** Heading, degrees clockwise from north. */
  bearingDeg: number;
  /** Viewport height in CSS px (the focal length is `0.5 * height / tan(fov / 2)`). */
  viewportHeightPx: number;
  eyeHeightM?: number;
  fovDeg?: number;
  lookDownDeg?: number;
  /** Move the eye back along the heading (eye clearance, metres; the eye still looks along the heading). */
  backM?: number;
  /** Extra eye height, metres (head bob). */
  bobM?: number;
  maxPitchDeg?: number;
}

export interface FpsPose {
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
  fovDeg: number;
  /** The pose's eye-to-centre distance, metres (near plane = distance / FPS_NEAR_DIVISOR). */
  distanceM: number;
  /** The eye's position and height over the rider's ground, for the clearance probe. */
  eye: { lngLat: [number, number]; heightM: number };
}

const M_LAT = 111_320;
const mLng = (lat: number) => 111_320 * Math.cos(lat * Math.PI / 180);

/** MapLibre zoom whose metres-per-pixel at `lat` is `mpp` (inverse of ownMap/mapCamera.ts metresPerPixel). */
export function zoomForMetresPerPixel(mpp: number, lat: number): number {
  return Math.log2((2 * Math.PI * EARTH_RADIUS * Math.cos(lat * Math.PI / 180)) / (512 * mpp));
}

/** The camera fields that put the eye `eyeHeightM` over `rider` (shifted back by `backM`) looking along `bearingDeg`. */
export function fpsPose(input: FpsPoseInput): FpsPose {
  const fovDeg = input.fovDeg ?? FPS_FOV_DEG;
  const eyeH = (input.eyeHeightM ?? FPS_EYE_HEIGHT_M) + (input.bobM ?? 0);
  const maxPitch = input.maxPitchDeg ?? MAX_PITCH_DEG;
  const pitch = Math.min(maxPitch, 90 - (input.lookDownDeg ?? FPS_LOOK_DOWN_DEG));
  const p = pitch * Math.PI / 180;
  const b = input.bearingDeg * Math.PI / 180;
  const distance = eyeH / Math.cos(p);
  const [lng, lat] = input.rider;
  const eyeLngLat: [number, number] = [lng - Math.sin(b) * (input.backM ?? 0) / mLng(lat), lat - Math.cos(b) * (input.backM ?? 0) / M_LAT];
  // The centre is where the camera model's view axis meets the centre's ground: `distance * sin(P)` ahead of the eye.
  const ahead = distance * Math.sin(p);
  const center: [number, number] = [eyeLngLat[0] + Math.sin(b) * ahead / mLng(lat), eyeLngLat[1] + Math.cos(b) * ahead / M_LAT];
  const focal = 0.5 * Math.max(1, input.viewportHeightPx) / Math.tan(fovDeg * Math.PI / 360);
  return {
    center, zoom: zoomForMetresPerPixel(distance / focal, lat), bearing: input.bearingDeg, pitch, fovDeg, distanceM: distance,
    eye: { lngLat: eyeLngLat, heightM: eyeH },
  };
}

/** Wrap an angle in degrees to (-180, 180]. */
export function wrapDeg(a: number): number { return ((((a + 180) % 360) + 360) % 360) - 180; }

/** One low-pass step of the heading (degrees) toward `target`, frame-rate independent, along the short way round. */
export function stepFpsYaw(current: number | null, target: number, dtS: number, tau = FPS_YAW_TAU_S): number {
  if (current == null || !Number.isFinite(current) || !(dtS > 0)) return target;
  const k = 1 - Math.exp(-Math.min(dtS, 0.25) / tau);
  const d = wrapDeg(target - current);
  return Math.abs(d) < 0.01 ? target : wrapDeg(current + d * k);
}

/** Vertical head-bob offset, metres, for `distanceM` ridden (two steps per stride), fading out at rest. */
export function headBobM(distanceM: number, speedMs: number, amplitudeM = FPS_BOB_AMPLITUDE_M, strideM = FPS_BOB_STRIDE_M): number {
  if (!(amplitudeM > 0) || !(speedMs > 0.2)) return 0;
  const fade = Math.min(1, speedMs / 3);
  return Math.sin((2 * Math.PI * distanceM) / strideM) * amplitudeM * fade;
}

/** Metres to move the eye back, trying 0, 0.25 ... maxBackM, until `inside(back)` is false; null when it never clears. */
export function clearBackM(inside: (backM: number) => boolean, maxBackM = 3, stepM = 0.25): number | null {
  for (let back = 0; back <= maxBackM + 1e-9; back += stepM) if (!inside(back)) return back;
  return null;
}

/** Whether the first-person view is requested: `?cam=fps` (else the stored/keyed choice, `stored`). */
export function fpsRequested(search: string, stored: string | null): boolean {
  const q = new URLSearchParams(search).get('cam');
  if (q === 'fps') return true;
  if (q === 'chase') return false;
  return stored === 'fps';
}

export { DEFAULT_FOV_DEG };
