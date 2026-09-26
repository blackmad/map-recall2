import { createHash } from 'node:crypto';
import type { AppearanceGrade } from './appearancePublication.js';
import { resolvePublication } from './appearancePublication.js';

export interface WallMeasurement {
  id: string;
  buildingId: string;
  sourceSha256: string;
  status: string;
  dominant?: { hex?: string };
}
export type WallReviewOrigin = 'human-visual-review' | 'model-visual-review';
export interface WallGrade extends AppearanceGrade { buildingId: string; reviewOrigin: WallReviewOrigin }
export interface AcceptedWallColour {
  observationId: string;
  buildingId: string;
  sourceSha256: string;
  hex: string;
  gradedAt: string;
  grader: string;
  reviewOrigin: WallReviewOrigin;
  reviewer: string;
}
export interface AcceptedWallColourSet {
  version: 1;
  measurementsSha256: string;
  accepted: AcceptedWallColour[];
}

/** A game-render correction is a separate, source-bound material choice. It
 * must never replace the accepted colour sampled from the reference photo. */
export interface WallRenderCalibration {
  buildingId: string;
  observationId: string;
  sourceSha256: string;
  referenceSha256: string;
  gameCaptureSha256: string;
  renderSideColour: string;
  reviewer: string;
  reviewOrigin: WallReviewOrigin;
  gradedAt: string;
  reason: string;
}
export interface WallRenderCalibrationSet {
  version: 1;
  baselineReleaseId: string;
  calibrations: WallRenderCalibration[];
}
export type PublishedWallRenderCalibration = Pick<WallRenderCalibration,
  'observationId' | 'referenceSha256' | 'gameCaptureSha256' | 'reviewer' | 'reviewOrigin' | 'gradedAt' | 'reason'> & { baselineReleaseId: string };

export const sha256 = (bytes: string | Buffer): string => createHash('sha256').update(bytes).digest('hex');
const HASH = /^[a-f0-9]{64}$/;
const HEX = /^#[a-f0-9]{6}$/i;

/** Reject stale or unbound corrections before any release artifact is built. */
export function validatedWallRenderCalibrations(set: WallRenderCalibrationSet, accepted: ReadonlyMap<string, AcceptedWallColour>, baselineReleaseId: string): ReadonlyMap<string, WallRenderCalibration & { baselineReleaseId: string }> {
  if (set?.version !== 1 || !HASH.test(baselineReleaseId) || set.baselineReleaseId !== baselineReleaseId || !Array.isArray(set.calibrations))
    throw Error('Wall render calibrations do not match the baseline release');
  const result = new Map<string, WallRenderCalibration & { baselineReleaseId: string }>();
  for (const item of set.calibrations) {
    const source = accepted.get(item?.buildingId);
    if (!source || result.has(item.buildingId) || item.observationId !== source.observationId
      || item.sourceSha256 !== source.sourceSha256 || item.referenceSha256 !== source.sourceSha256
      || !HASH.test(item.gameCaptureSha256) || !HEX.test(item.renderSideColour)
      || !['human-visual-review', 'model-visual-review'].includes(item.reviewOrigin)
      || !item.reviewer?.trim() || !Number.isFinite(Date.parse(item.gradedAt)) || !item.reason?.trim())
      throw Error(`Invalid or stale wall render calibration: ${item?.buildingId}`);
    result.set(item.buildingId, { ...item, baselineReleaseId });
  }
  return result;
}

/** Keep the measured source colour while publishing a separately reviewed
 * colour for MapLibre's lit extrusion material. */
export function wallRenderColourForBuilding(buildingId: string, calibrations: ReadonlyMap<string, WallRenderCalibration & { baselineReleaseId: string }>): { renderSideColour?: string; renderSideColourCalibration?: PublishedWallRenderCalibration } {
  const item = calibrations.get(buildingId);
  if (!item) return {};
  return {
    renderSideColour: item.renderSideColour,
    renderSideColourCalibration: {
      baselineReleaseId: item.baselineReleaseId,
      observationId: item.observationId,
      referenceSha256: item.referenceSha256,
      gameCaptureSha256: item.gameCaptureSha256,
      reviewer: item.reviewer,
      reviewOrigin: item.reviewOrigin,
      gradedAt: item.gradedAt,
      reason: item.reason,
    },
  };
}

/** A grade must identify both the current observation and its BAG owner. */
export function promoteWallColour(measurements: readonly WallMeasurement[], grades: Record<string, WallGrade>, measurementsSha256: string): AcceptedWallColourSet {
  if (!HASH.test(measurementsSha256)) throw Error('Invalid measurement digest');
  const byId = new Map<string, WallMeasurement>();
  for (const measurement of measurements) {
    if (byId.has(measurement.id)) throw Error(`Duplicate wall observation: ${measurement.id}`);
    byId.set(measurement.id, measurement);
  }
  const accepted: AcceptedWallColour[] = [];
  for (const [key, grade] of Object.entries(grades)) {
    const measurement = byId.get(key);
    if (!measurement || grade?.observationId !== key || grade.buildingId !== measurement.buildingId)
      throw Error(`Wall grade identity mismatch: ${key}`);
    if (!HASH.test(grade.sourceSha256) || grade.sourceSha256 !== measurement.sourceSha256)
      throw Error(`Stale wall grade sourceSha256: ${key}`);
    if (!['human-visual-review', 'model-visual-review'].includes(grade.reviewOrigin) || !grade.grader?.trim() || !Number.isFinite(Date.parse(grade.gradedAt)))
      throw Error(`Wall grade lacks review provenance: ${key}`);
    if (grade.verdict !== 'accept' && grade.verdict !== 'adjust') continue;
    if (measurement.status !== 'measured') throw Error(`Unmeasured wall accepted: ${key}`);
    // The desk records a brighter swatch as an accepted correction. Do not
    // silently replace that explicit choice with the raw cluster hex.
    const decision = grade.verdict === 'accept' && grade.correctedHex
      ? resolvePublication({ current: 'quarantined-machine-preview', grade: { ...grade, verdict: 'adjust' }, sourceSha256: measurement.sourceSha256, reviewOrigin: grade.reviewOrigin })
      : resolvePublication({ current: 'quarantined-machine-preview', grade, sourceSha256: measurement.sourceSha256, measuredHex: measurement.dominant?.hex, reviewOrigin: grade.reviewOrigin });
    if (!['accepted-human-reviewed', 'accepted-model-reviewed'].includes(decision.publication) || !decision.hex)
      throw Error(`Wall grade has no publishable colour: ${key}`);
    accepted.push({ observationId: key, buildingId: measurement.buildingId, sourceSha256: measurement.sourceSha256, hex: decision.hex, gradedAt: grade.gradedAt, grader: grade.grader, reviewOrigin: grade.reviewOrigin, reviewer: grade.grader });
  }
  return { version: 1, measurementsSha256, accepted: accepted.sort((a, b) => a.observationId.localeCompare(b.observationId)) };
}

/** Validate the accepted artifact against current measurements at release time. */
export function acceptedWallColours(set: AcceptedWallColourSet, measurements: readonly WallMeasurement[], measurementsSha256: string): Map<string, AcceptedWallColour> {
  if (set.version !== 1 || set.measurementsSha256 !== measurementsSha256 || !Array.isArray(set.accepted))
    throw Error('Accepted wall colours do not match current measurements');
  const byId = new Map(measurements.map(item => [item.id, item]));
  if (byId.size !== measurements.length) throw Error('Duplicate current wall observations');
  const byBuilding = new Map<string, AcceptedWallColour>();
  const observations = new Set<string>();
  for (const entry of set.accepted) {
    const measurement = byId.get(entry.observationId);
    if (!measurement || measurement.status !== 'measured' || measurement.buildingId !== entry.buildingId || measurement.sourceSha256 !== entry.sourceSha256 || !HASH.test(entry.sourceSha256) || !HEX.test(entry.hex) || !['human-visual-review', 'model-visual-review'].includes(entry.reviewOrigin) || !entry.reviewer?.trim() || entry.reviewer !== entry.grader || !Number.isFinite(Date.parse(entry.gradedAt)) || observations.has(entry.observationId))
      throw Error(`Invalid accepted wall colour: ${entry.observationId}`);
    observations.add(entry.observationId);
    // Multiple façades of one BAG building can legitimately be reviewed, but
    // choosing a single side colour would erase which wall was measured.
    if (byBuilding.has(entry.buildingId)) throw Error(`Multiple accepted walls for building: ${entry.buildingId}`);
    byBuilding.set(entry.buildingId, entry);
  }
  return byBuilding;
}

export function wallColourForBuilding(buildingId: string, fallback: string, accepted: ReadonlyMap<string, AcceptedWallColour>): { sideColour: string; sideColourSource: 'measured-accepted' | 'procedural-prior-not-measured'; sideColourObservationId?: string; sideColourSourceSha256?: string; sideColourReviewOrigin?: WallReviewOrigin; sideColourReviewer?: string } {
  const entry = accepted.get(buildingId);
  return entry ? { sideColour: entry.hex, sideColourSource: 'measured-accepted', sideColourObservationId: entry.observationId, sideColourSourceSha256: entry.sourceSha256, sideColourReviewOrigin: entry.reviewOrigin, sideColourReviewer: entry.reviewer } : { sideColour: fallback, sideColourSource: 'procedural-prior-not-measured' };
}
