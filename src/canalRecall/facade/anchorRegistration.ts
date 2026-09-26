/** Turn human anchor correspondences into street-level registration evidence.
 *
 * The anchor tool records independent world<->pixel pairs. A panorama's
 * boresight is one fitted parameter; with at least three anchors the remaining
 * residual is a genuine goodness-of-fit (BAG footprint error plus reviewer click
 * precision), not a trivially exact fit. That residual, converted to metres at
 * each wall's standoff, is what lets a source reach `correspondence-verified`
 * without claiming 0.15 m metric registration.
 *
 * Caveat: the per-pano boresight is currently fitted on the same anchors, so the
 * residual is optimistic. A future calibration/validation split should fit on one
 * set and report on another. This module measures, it does not certify.
 */
import { worldToEquirectangularPixel } from './rectify.ts';
import { cameraModelForPano } from './panoCamera.ts';
import { crossValidateBoresight } from './boresightFit.ts';

export interface AnchorLike {
  panoramaId: string;
  markerId: string;
  world: { x: number; y: number; z: number };
  pixel: [number, number];
  status?: string;
}

export interface TaskMarkerLike { id: string; standoffM: number }
export interface TaskPanoLike {
  panoramaId: string;
  width: number;
  height: number;
  pose: { x: number; y: number; z: number; headingDeg: number; pitchDeg: number; rollDeg: number };
  markers: TaskMarkerLike[];
}
export interface TaskLike { panos: TaskPanoLike[] }

export interface PanoAnchorFit {
  panoramaId: string;
  anchors: number;
  /** In-sample residual after the per-pano boresight (optimistic). */
  medianM: number;
  p95M: number;
  /** Held-out residual: boresight fitted on calibration, measured on validation. */
  validation: { medianPx: number; rmsPx: number; medianM: number; count: number } | null;
  qualifies: boolean;
  cameraModelId: string;
}

export interface CorrespondenceEvidence {
  identityVerified: true;
  wallVerified: true;
  residualM: { median: number; p95: number };
  independentAnchors: number;
}

const MAX_STREET_RESIDUAL_MEDIAN_M = 0.25;
const MAX_STREET_RESIDUAL_P95_M = 0.5;
const MIN_STREET_ANCHORS = 3;

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
const percentile = (values: number[], fraction: number): number => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(fraction * sorted.length) - 1))];
};

/** Corrected anchor residual per panorama, in pixels and metres. */
export function panoAnchorFits(anchors: AnchorLike[], task: TaskLike): PanoAnchorFit[] {
  const byPano = new Map<string, TaskPanoLike>();
  for (const pano of task.panos) byPano.set(pano.panoramaId, pano);

  const groups = new Map<string, AnchorLike[]>();
  for (const anchor of anchors) {
    if (anchor.status === 'skipped') continue;
    const list = groups.get(anchor.panoramaId);
    if (list) list.push(anchor);
    else groups.set(anchor.panoramaId, [anchor]);
  }

  const fits: PanoAnchorFit[] = [];
  for (const [panoramaId, group] of groups) {
    const pano = byPano.get(panoramaId);
    if (!pano) continue;
    const model = cameraModelForPano(panoramaId);
    const standoffById = new Map(pano.markers.map((marker) => [marker.id, marker.standoffM]));
    const pxPerRadian = pano.width / (2 * Math.PI);
    const residualsM: number[] = [];
    for (const anchor of group) {
      const [u, v] = worldToEquirectangularPixel(anchor.world, pano.pose, { width: pano.width, height: pano.height }, model);
      const residualPx = Math.hypot(u - anchor.pixel[0], v - anchor.pixel[1]);
      const standoff = standoffById.get(anchor.markerId) ?? 15;
      residualsM.push(residualPx * standoff / pxPerRadian);
    }
    const medianM = Number(median(residualsM).toFixed(3));
    const p95M = Number(percentile(residualsM, 0.95).toFixed(3));

    // Honest measurement: fit the boresight on a calibration split and report the
    // residual on the held-out split, so the number is not fitted on itself.
    const medianStandoff = median(group.map((anchor) => standoffById.get(anchor.markerId) ?? 15));
    const cv = crossValidateBoresight(
      group.map((anchor) => ({ world: anchor.world, pixel: anchor.pixel })),
      pano.pose,
      { width: pano.width, height: pano.height },
      { validationFraction: 0.34 },
    );
    const validation = cv && cv.validationCount > 0
      ? {
        medianPx: Number(cv.validationMedianPx.toFixed(2)),
        rmsPx: Number(cv.validationRmsPx.toFixed(2)),
        medianM: Number((cv.validationMedianPx * medianStandoff / pxPerRadian).toFixed(3)),
        count: cv.validationCount,
      }
      : null;
    const heldOutOk = validation !== null
      && validation.medianM <= MAX_STREET_RESIDUAL_MEDIAN_M
      && validation.rmsPx * medianStandoff / pxPerRadian <= MAX_STREET_RESIDUAL_P95_M;

    fits.push({
      panoramaId,
      anchors: group.length,
      medianM,
      p95M,
      validation,
      qualifies: group.length >= MIN_STREET_ANCHORS && heldOutOk,
      cameraModelId: model.id,
    });
  }
  return fits.sort((a, b) => a.panoramaId.localeCompare(b.panoramaId));
}

/** Registration evidence for a wall on a panorama whose anchors qualify. */
export function correspondenceEvidence(fit: PanoAnchorFit): CorrespondenceEvidence | null {
  if (!fit.qualifies) return null;
  return {
    identityVerified: true,
    wallVerified: true,
    residualM: { median: fit.medianM, p95: fit.p95M },
    independentAnchors: fit.anchors,
  };
}
