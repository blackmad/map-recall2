export type LonLat = readonly [number, number];

export interface FacadePanoramaCandidate {
  panoId: string;
  observedAt: string;
  camera: LonLat;
  surfaceType: string;
}

export interface RankedFacadeView extends FacadePanoramaCandidate {
  distanceMetres: number;
  targetHeading: number;
  fieldOfView: number;
}

export interface FacadeViewPolicy {
  minDistanceMetres: number;
  maxDistanceMetres: number;
  idealDistanceMetres: number;
}

export const DEFAULT_FACADE_VIEW_POLICY: FacadeViewPolicy = {
  minDistanceMetres: 8,
  maxDistanceMetres: 45,
  idealDistanceMetres: 22,
};

export function distanceMetres(a: LonLat, b: LonLat): number {
  const latitude = (a[1] + b[1]) * Math.PI / 360;
  return Math.hypot((b[0] - a[0]) * Math.cos(latitude), b[1] - a[1]) * 111_320;
}

export function bearingDegrees(from: LonLat, to: LonLat): number {
  const fromLat = from[1] * Math.PI / 180;
  const toLat = to[1] * Math.PI / 180;
  const deltaLon = (to[0] - from[0]) * Math.PI / 180;
  return (Math.atan2(
    Math.sin(deltaLon) * Math.cos(toLat),
    Math.cos(fromLat) * Math.sin(toLat)
      - Math.sin(fromLat) * Math.cos(toLat) * Math.cos(deltaLon),
  ) * 180 / Math.PI + 360) % 360;
}

/** Wider nearby views keep a normal Amsterdam frontage inside the crop. */
export function facadeFieldOfView(distance: number): number {
  if (distance < 14) return 110;
  if (distance < 20) return 95;
  return 82;
}

/**
 * Rank current land panoramas by useful viewing distance, then recency.
 * Selection is deliberately independent of API order.
 */
export function rankFacadeViews(
  candidates: readonly FacadePanoramaCandidate[],
  target: LonLat,
  policy: FacadeViewPolicy = DEFAULT_FACADE_VIEW_POLICY,
): RankedFacadeView[] {
  if (!(policy.minDistanceMetres >= 0)
    || !(policy.maxDistanceMetres >= policy.minDistanceMetres)
    || !(policy.idealDistanceMetres >= policy.minDistanceMetres
      && policy.idealDistanceMetres <= policy.maxDistanceMetres)) {
    throw new RangeError('Invalid façade view distance policy');
  }
  return candidates
    .filter((candidate) => candidate.surfaceType === 'L')
    .map((candidate) => {
      const distance = distanceMetres(candidate.camera, target);
      return {
        ...candidate,
        distanceMetres: distance,
        targetHeading: bearingDegrees(candidate.camera, target),
        fieldOfView: facadeFieldOfView(distance),
      };
    })
    .filter((candidate) => candidate.distanceMetres >= policy.minDistanceMetres
      && candidate.distanceMetres <= policy.maxDistanceMetres)
    .sort((a, b) => Math.abs(a.distanceMetres - policy.idealDistanceMetres)
      - Math.abs(b.distanceMetres - policy.idealDistanceMetres)
      || Date.parse(b.observedAt) - Date.parse(a.observedAt)
      || a.panoId.localeCompare(b.panoId));
}

/** Keep useful alternatives without returning several frames from one camera position. */
export function selectDistinctFacadeViews(
  ranked: readonly RankedFacadeView[],
  count: number,
  minimumCameraSeparationMetres = 5,
): RankedFacadeView[] {
  if (!(count >= 1) || !(minimumCameraSeparationMetres >= 0)) {
    throw new RangeError('Invalid façade alternative-view policy');
  }
  const selected: RankedFacadeView[] = [];
  for (const candidate of ranked) {
    if (selected.every((view) => distanceMetres(view.camera, candidate.camera) >= minimumCameraSeparationMetres)) {
      selected.push(candidate);
      if (selected.length >= count) break;
    }
  }
  return selected;
}
