/**
 * Turn the reconnaissance sources into {@link CanalHouse} records.
 *
 * This is the schema's constructor path: a building registry's footprints and a
 * massing model's heights in, per-building parameter records out, each field
 * carrying the observation it came from. It is deliberately the *only* place
 * those sources become `Measured` values, so there is one audited boundary
 * between "a number in a government extract" and "a number this project
 * renders".
 *
 * What it does not do matters as much. It populates footprint and massing and
 * stops. No gable, no bays, no openings, no materials — none of that is in a
 * building registry or a roof reconstruction, and the record says so by
 * leaving those fields {@link defaulted}. A house built by this module retains
 * supported massing dimensions and leaves unobserved façade fields unknown.
 * Registry and roof metadata alone do not certify its silhouette.
 *
 * Inputs are the adapter interfaces in `sources.ts`, not any one country's
 * endpoints, so this path does not have to be rewritten for the second city.
 */

import { measured, type Measured, type Observation } from './evidence.ts';
import { unobservedHouse, type CanalHouse } from './houseRecord.ts';
import { readGable, readHoistBeam } from './heritageText.ts';
import { buildElevations } from './elevations.ts';
import type { ProjectedCrs, HeritageRecord, MassingRecord, RegistryBuilding } from './sources.ts';

/** Provenance of one source, as the recon metadata publishes it. */
export interface SourceDescriptor {
  id: string;
  license: string | null;
  /** Collection or vintage string, so two vintages of one dataset never merge silently. */
  vintage: string | null;
  /** A URL template for one record, with `{id}` substituted. */
  recordUrlTemplate: string | null;
}

/**
 * Heights are measured against a vertical datum; the record holds them above
 * this building's own ground level.
 *
 * Amsterdam is flat but not level — quay heights vary along a canal — so the
 * ground level is per-building from the survey rather than one constant for
 * the boundary.
 */
const aboveGround = (value: number | null, groundLevel: number | null): number | null =>
  value == null || groundLevel == null ? null : value - groundLevel;

/** Heights retain their semantics; consistency alone cannot identify an eaves line. */
export type HeightReason = 'ok' | 'missing' | 'inverted' | 'impossible' | 'stale';
export interface ResolvedHeights {
  eavesM: number | null;
  ridgeM: number | null;
  confidenceFactor: number;
  reason: HeightReason;
  note: string | null;
}

export function resolveHeights(massing: MassingRecord): ResolvedHeights {
  const absent = (reason: HeightReason, note: string): ResolvedHeights => ({
    eavesM: null, ridgeM: null, confidenceFactor: 1, reason, note,
  });
  if (massing.heightSemantics !== 'surface-heights-v2') return absent('stale',
    'legacy massing height semantics are unversioned; re-adapt raw source attributes before using heights');
  const eaves = aboveGround(massing.eavesHeight, massing.groundLevel);
  const ridge = aboveGround(massing.ridgeHeight, massing.groundLevel);
  if ([eaves, ridge].some(value => value !== null && (!Number.isFinite(value) || value <= 0))) {
    return absent('impossible', 'non-positive or non-finite height above local ground; heights left unobserved');
  }
  if (eaves !== null && ridge !== null && eaves > ridge) return absent('inverted',
    'eaves exceed ridge; conflicting heights left unobserved rather than relabelled');
  return { eavesM: eaves, ridgeM: ridge, confidenceFactor: 1,
    reason: eaves === null || ridge === null ? 'missing' : 'ok',
    note: eaves === null || ridge === null ? 'local eaves or modelled ridge missing; roof percentiles remain surface statistics' : null };
}

/**
 * Confidence in a massing-derived height, from that building's own metadata.
 *
 * A calibrated *shape*, not a calibrated number: this is a prior that the
 * held-out review corpus will correct, and `fieldVerdict` will refuse to
 * auto-accept the field until it has. Each input degrades the reading for a
 * documented reason:
 *
 * - `reconstructionError` is roof-plane fit error, and it tracks roof
 *   complexity rather than reconstruction failure — flat across plot width and
 *   across century. So it lowers confidence gently instead of rejecting the
 *   interesting buildings, which a hard 0.5 m gate would do to 61% of the pilot.
 * - `insufficientInput` is genuine absence of survey return, which is a
 *   different and worse problem than a complex roof.
 * - `geometryValid` and `sourceQualityFlag` are the source's own verdicts and
 *   are respected.
 */
export function massingConfidence(massing: MassingRecord): number {
  if (massing.geometryValid === false || massing.insufficientInput === true) return 0.2;
  let confidence = massing.sourceQualityFlag === true ? 0.9 : 0.7;
  const error = massing.reconstructionError;
  // Halves at about 1.2 m of fit error; never falls to nothing, because a
  // complex roof is still a measured roof.
  if (error != null && error > 0) confidence *= 1 / (1 + error / 1.2);
  return clampConfidence(confidence);
}

const clampConfidence = (value: number): number =>
  Math.min(1, Math.max(0.05, Number(value.toFixed(3))));

/**
 * The observations a reconnaissance row constitutes.
 *
 * Both are `registry-record`: authoritative about footprint, height and roof
 * form, and — per `FIELD_SOURCES` — incapable of saying anything about a
 * façade.
 *
 * The massing observation is dated by its **survey campaign year**, not by the
 * pipeline run. A ridge height derived from a 2014 survey is a 2014
 * measurement however often the extract is rebuilt, and a building altered
 * since then should read as stale rather than current.
 */
export function reconObservations(
  building: RegistryBuilding,
  massing: MassingRecord | undefined,
  registryReadAt: string,
  registry: SourceDescriptor,
  massingSource?: SourceDescriptor,
): Observation[] {
  const url = (descriptor: SourceDescriptor | undefined, id: string) =>
    descriptor?.recordUrlTemplate ? descriptor.recordUrlTemplate.replace('{id}', id) : null;

  const observations: Observation[] = [{
    id: `${registry.id}:${building.buildingId}`,
    pandId: building.buildingId,
    kind: 'registry-record',
    elevation: 'roof',
    capturedAt: registryReadAt,
    sourceUrl: url(registry, building.buildingId),
    license: registry.license,
  }];

  if (massing) {
    observations.push({
      id: `${massingSource?.id ?? 'massing'}:${building.buildingId}`,
      pandId: building.buildingId,
      kind: 'registry-record',
      elevation: 'roof',
      capturedAt: massing.surveyYear ? `${massing.surveyYear}-01-01` : registryReadAt,
      sourceUrl: url(massingSource, building.buildingId),
      license: massingSource?.license ?? null,
    });
  }
  return observations;
}

export interface BuildRecordInput {
  building: RegistryBuilding;
  massing?: MassingRecord;
  /** ISO date the building registry was read. */
  registryReadAt: string;
  registry: SourceDescriptor;
  massingSource?: SourceDescriptor;
  /** Explicit selected wall in the registry's metric footprint; never a rectangle side. */
  frontage?: { crs: ProjectedCrs; elevationId: string };
}

export interface BuiltRecord {
  house: CanalHouse;
  footprintExtent: { widthM: number; depthM: number } | null;
  observations: Observation[];
  /** Why a field that could have been populated was not. Reported, never silent. */
  notes: string[];
  /** How the massing model's two height measures related, for the report. */
  heightReason: HeightReason | null;
}

/** Registry extents supply fallback massing; an explicit wall supplies façade dimensions. */
export function buildRecordFromRecon(input: BuildRecordInput): BuiltRecord {
  const { building, massing, registryReadAt, registry, massingSource } = input;
  const house = unobservedHouse(building.buildingId);
  const observations = reconObservations(building, massing, registryReadAt, registry, massingSource);
  const registryObservation = observations[0];
  const massingObservation = observations[1];
  const notes: string[] = [];

  const extent = declaredExtent(building) ?? footprintExtent(building);
  if (input.frontage) {
    const { crs, elevationId } = input.frontage;
    const footprintRd = building.footprintLngLat.map(point => crs.fromLngLat(point));
    const wall = buildElevations(footprintRd, { pandId: building.buildingId }).find(item => item.elevationId === elevationId);
    if (!wall) throw new Error(`Selected frontage ${elevationId} does not exist on ${building.buildingId}`);
    house.plotWidthM = measured(round2(wall.lengthM), 'bag', 0.99, registryObservation);
    const distances = footprintRd.map(point => (point.x - wall.start.x) * wall.normal.x + (point.y - wall.start.y) * wall.normal.y);
    house.depthM = measured(round2(Math.max(...distances) - Math.min(...distances)), 'bag', 0.99, registryObservation);
  } else {
    notes.push('no selected elevation: façade width and depth unobserved; rectangle extent retained for fallback massing');
  }

  if (!massing || !massingObservation) {
    notes.push('no massing match: heights, storeys and roof form all unobserved');
    return { house, footprintExtent: extent, observations, notes, heightReason: null };
  }

  const baseConfidence = massingConfidence(massing);
  const heights = resolveHeights(massing);
  if (heights.note) notes.push(heights.note);
  const heightConfidence = clampConfidence(baseConfidence * heights.confidenceFactor);

  // These are reconstructed geometry heights, with the upstream survey vintage retained.
  if (heights.eavesM != null) {
    house.eavesHeightM = measured(round2(heights.eavesM), '3dbag', heightConfidence, massingObservation);
  }
  if (heights.ridgeM != null) {
    house.ridgeHeightM = measured(round2(heights.ridgeM), '3dbag', heightConfidence, massingObservation);
  }

  if (massing.storeys != null && massing.storeys > 0) {
    // A storey count is derived rather than surveyed, so it is recorded below
    // the height confidence even when the reconstruction is clean.
    house.storeys = measured(massing.storeys, '3dbag', Math.min(heightConfidence, 0.75), massingObservation);
  } else {
    notes.push('massing model carries no storey count');
  }

  if (massing.insufficientInput === true) notes.push('massing model flags insufficient survey input; heights are low-confidence');
  if (massing.geometryValid === false) notes.push('massing model marks this reconstruction invalid');

  return { house, footprintExtent: extent, observations, notes, heightReason: heights.reason };
}

const round2 = (value: number) => Number(value.toFixed(2));

/** Legacy rectangle sides, retained only as fallback footprint extents. */
export function declaredExtent(building: RegistryBuilding): { widthM: number; depthM: number } | null {
  const width = (building as { plotWidthM?: number | null }).plotWidthM;
  const depth = (building as { plotDepthM?: number | null }).plotDepthM;
  if (width == null || depth == null || !(width > 0) || !(depth > 0)) return null;
  return { widthM: Math.min(width, depth), depthM: Math.max(width, depth) };
}

/**
 * Width and depth of a footprint, as the short and long sides of its
 * minimum-area bounding rectangle.
 *
 * The minimum-area rectangle rather than an axis-aligned one because the canal
 * ring runs at every bearing: an axis-aligned box around a house on a canal
 * bend reports neither its façade width nor its depth. The short side is the
 * façade width for a terraced plot, which is what the whole grammar scales from.
 */
export function footprintExtent(building: RegistryBuilding): { widthM: number; depthM: number } | null {
  const ring = building.footprintLngLat;
  if (!ring || ring.length < 4) return null;

  // Local equirectangular metres about the footprint's own latitude. Over a
  // single building the distortion is far below the measurement precision.
  const latitudes = ring.map(point => point[1]);
  const midLatitude = (Math.min(...latitudes) + Math.max(...latitudes)) / 2;
  const metresPerDegreeLat = 111_132;
  const metresPerDegreeLng = metresPerDegreeLat * Math.cos((midLatitude * Math.PI) / 180);
  const points = ring.map(([longitude, latitude]) => ({
    x: longitude * metresPerDegreeLng,
    y: latitude * metresPerDegreeLat,
  }));

  let best: { widthM: number; depthM: number } | null = null;
  // Rotating calipers over the edges: the minimum-area rectangle of a convex
  // hull is always flush with one of its edges, and testing every edge of the
  // ring is close enough at this size and far simpler than hulling first.
  for (let index = 0; index < points.length - 1; index++) {
    const dx = points[index + 1].x - points[index].x;
    const dy = points[index + 1].y - points[index].y;
    const length = Math.hypot(dx, dy);
    if (length < 1e-6) continue;
    const ux = dx / length;
    const uy = dy / length;

    let minAlong = Infinity, maxAlong = -Infinity, minAcross = Infinity, maxAcross = -Infinity;
    for (const point of points) {
      const along = point.x * ux + point.y * uy;
      const across = -point.x * uy + point.y * ux;
      minAlong = Math.min(minAlong, along);
      maxAlong = Math.max(maxAlong, along);
      minAcross = Math.min(minAcross, across);
      maxAcross = Math.max(maxAcross, across);
    }
    const spanAlong = maxAlong - minAlong;
    const spanAcross = maxAcross - minAcross;
    const area = spanAlong * spanAcross;
    if (!best || area < best.widthM * best.depthM) {
      best = { widthM: round2(Math.min(spanAlong, spanAcross)), depthM: round2(Math.max(spanAlong, spanAcross)) };
    }
  }
  return best;
}

/** What a whole reconnaissance pass produced, for the coverage report. */
export interface ReconBuildSummary {
  buildings: number;
  withMassing: number;
  withoutMassing: number;
  withEaves: number;
  withRidge: number;
  withStoreys: number;
  /** Buildings whose modelled ridge fell below their measured roof height. */
  invertedHeights: number;
  /** Buildings whose modelled ridge sat at or below their own ground level. */
  impossibleHeights: number;
  staleHeightSemantics: number;
  unknownConstructionYear: number;
  meanHeightConfidence: number;
}

export function summariseReconBuild(
  rows: readonly BuildRecordInput[],
  built: readonly BuiltRecord[],
): ReconBuildSummary {
  const observedIn = (field: keyof CanalHouse) =>
    built.filter(entry => (entry.house[field] as Measured<unknown>).source !== 'default').length;

  const confidences = built
    .map(entry => entry.house.ridgeHeightM)
    .filter(field => field.source !== 'default')
    .map(field => field.confidence);

  return {
    buildings: rows.length,
    withMassing: rows.filter(row => row.massing).length,
    withoutMassing: rows.filter(row => !row.massing).length,
    withEaves: observedIn('eavesHeightM'),
    withRidge: observedIn('ridgeHeightM'),
    withStoreys: observedIn('storeys'),
    invertedHeights: built.filter(entry => entry.heightReason === 'inverted').length,
    impossibleHeights: built.filter(entry => entry.heightReason === 'impossible').length,
    staleHeightSemantics: built.filter(entry => entry.heightReason === 'stale').length,
    // The adapter normalises a registry's "year unknown" sentinel to null, so
    // this counts genuinely unknown dates rather than a magic number.
    unknownConstructionYear: rows.filter(row => row.building.constructionYear == null).length,
    meanHeightConfidence: confidences.length === 0 ? 0
      : Number((confidences.reduce((sum, value) => sum + value, 0) / confidences.length).toFixed(3)),
  };
}

/**
 * Apply a heritage register's descriptions to a record.
 *
 * Kept separate from {@link buildRecordFromRecon} because it is a different
 * *kind* of evidence: a conservator's sentence about a façade, which sees
 * things no roof reconstruction can and states almost nothing in metres. Per
 * `FIELD_SOURCES`, `monument-text` may supply a gable, a cornice, dressings and
 * a hoist beam, and may never supply a bay offset or a lean.
 *
 * A building can carry several heritage records — 1,493 records over 989
 * buildings inside the pilot — so this reads all of them and refuses when they
 * disagree about the front gable rather than picking the most confident.
 * Two records contradicting each other is exactly the case a human should see.
 */
export interface HeritageEvidence {
  observations: Observation[];
  applied: string[];
  notes: string[];
}

export function applyHeritageEvidence(
  house: CanalHouse,
  records: readonly HeritageRecord[],
  readAt: string,
  source: SourceDescriptor,
): HeritageEvidence {
  const observations: Observation[] = [];
  const applied: string[] = [];
  const notes: string[] = [];

  const described = records.filter(record => record.description && record.description.trim());
  if (described.length === 0) return { observations, applied, notes };

  const observationFor = (record: HeritageRecord): Observation => {
    const observation: Observation = {
      id: `${source.id}:${record.heritageId}`,
      pandId: house.pandId,
      kind: 'monument-record',
      elevation: 'front',
      // The register publishes no per-record date in this feed, so the
      // observation is dated by the day it was read. Recorded as such rather
      // than left blank: a description read today may describe a 1970s survey,
      // and that uncertainty belongs in review, not in a fabricated date.
      capturedAt: readAt,
      sourceUrl: record.recordUrl,
      license: source.license,
    };
    observations.push(observation);
    return observation;
  };

  const readings = described
    .map(record => ({ record, reading: readGable(record.description) }))
    .filter(entry => entry.reading.gable !== null);

  const distinct = new Set(readings.map(entry => entry.reading.gable));
  if (distinct.size > 1) {
    notes.push(`heritage records disagree about the front gable (${[...distinct].join(', ')}); left unobserved for review`);
  } else if (readings.length > 0) {
    const best = readings.reduce((a, b) => (b.reading.confidence > a.reading.confidence ? b : a));
    house.gable = measured(best.reading.gable!, 'monument-text', best.reading.confidence, observationFor(best.record));
    applied.push('gable');
  }

  // Presence only. The register records what is notable, not what is ordinary,
  // so silence about a hoisting beam is not evidence that there is none.
  const withHoist = described.find(record => readHoistBeam(record.description));
  if (withHoist) {
    house.hoistBeam = measured(true, 'monument-text', 0.8, observationFor(withHoist));
    applied.push('hoistBeam');
  }

  return { observations, applied, notes };
}
