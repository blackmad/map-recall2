/** Measured per-panorama boresight corrections.
 *
 * The municipal panorama is world-aligned, but each stitched capture has a
 * small absolute-orientation error. Twelve independent anchor correspondences
 * recorded in the pano anchor tool (2026-09-20) showed a constant horizontal
 * shift per panorama: a yaw boresight of 0.55°–4.6°, with negligible pitch.
 * Applying it drops the anchor residual from ~29 px median to ~8 px
 * (roughly 0.03–0.10 m at these standoffs).
 *
 * These values are measured, not certified. A panorama without anchors keeps
 * the uncorrected model; scaling to the city needs the automatic per-pano
 * estimate (edge alignment) rather than a hand-fit table.
 */
import { AMSTERDAM_WORLD_ALIGNED, type CameraModel } from './rectify.ts';

export interface PanoBoresight { yawDeg: number; pitchDeg: number; source: string }

export const PANO_BORESIGHTS: Record<string, PanoBoresight> = {
  'TMX7316010203-003006_pano_0003_000165': { yawDeg: 1.4, pitchDeg: -0.05, source: 'pano-anchors 2026-09-20, 6 anchors' },
  'b_20241129_0829_Track29_Sphere_00016': { yawDeg: 0.55, pitchDeg: 0, source: 'pano-anchors 2026-09-20, 4 anchors' },
  'TMX7316010203-002928_pano_0012_000070': { yawDeg: 4.6, pitchDeg: 0.4, source: 'pano-anchors 2026-09-20, 2 anchors (holdout)' },
};

export function cameraModelForPano(panoramaId: string): CameraModel {
  const boresight = PANO_BORESIGHTS[panoramaId];
  if (!boresight) return AMSTERDAM_WORLD_ALIGNED;
  return {
    id: `amsterdam-world-aligned+boresight/${panoramaId}`,
    usesOrientation: false,
    yaw: 'centre',
    boresightYawDeg: boresight.yawDeg,
    boresightPitchDeg: boresight.pitchDeg,
  };
}
