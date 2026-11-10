/**
 * The user's U1 pose (engine round 5, 2026-11-08: "roofs look too bright/flat/unfinished", Sint Antoniesluis /
 * Nieuwmarkt, map-recall2-screenshots engine/2026-11-08-user-shots/aerial-nieuwmarkt-flat-roofs-bright.png), fitted
 * to four POI dots in the shot (Huis De Pinto, Zuiderkerk, Walloon Church, Levensboom; 15 CSS px rms) as a pinhole
 * eye with MapLibre's 36.87° vertical field of view in the shot's 1232 × 706 CSS px viewport (DPR 2).
 */
import { rdToLngLat } from '../../src/canalRecall/rdCoordinates.ts';

export const U1_POSE = { name: 'aerial-nieuwmarkt-user', eye: [4.901902, 52.372138, 167] as [number, number, number], bearing: 221.0, pitch: 47.7, viewport: [1232, 706] as [number, number] };

/** RD point at height z (m) → CSS px in the U1 viewport, null behind the eye. */
export function projectU1(x: number, y: number, z: number): [number, number] | null {
  const [lng, lat] = rdToLngLat(x, y), [W, H] = U1_POSE.viewport, f = (H / 2) / Math.tan(36.87 * Math.PI / 360);
  const kx = 111320 * Math.cos(U1_POSE.eye[1] * Math.PI / 180), ky = 111132;
  const B = U1_POSE.bearing * Math.PI / 180, P = U1_POSE.pitch * Math.PI / 180;
  const fwd = [Math.sin(B) * Math.sin(P), Math.cos(B) * Math.sin(P), -Math.cos(P)], right = [Math.cos(B), -Math.sin(B), 0];
  const up = [right[1] * fwd[2] - right[2] * fwd[1], right[2] * fwd[0] - right[0] * fwd[2], right[0] * fwd[1] - right[1] * fwd[0]];
  const d = [(lng - U1_POSE.eye[0]) * kx, (lat - U1_POSE.eye[1]) * ky, z - U1_POSE.eye[2]];
  const depth = d[0] * fwd[0] + d[1] * fwd[1] + d[2] * fwd[2];
  if (depth <= 1) return null;
  return [W / 2 + f * (d[0] * right[0] + d[1] * right[1]) / depth, H / 2 - f * (d[0] * up[0] + d[1] * up[1] + d[2] * up[2]) / depth];
}
