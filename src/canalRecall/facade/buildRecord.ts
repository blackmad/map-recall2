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
 * leaving those fields {@link defaulted}. A house built by this module renders
 * with a correct silhouette and no windows, which is the correct resting state
 * for a building nobody has yet looked at from the street.
 *
 * Inputs are the adapter interfaces in `sources.ts`, not any one country's
 * endpoints, so this path does not have to be rewritten for the second city.
 */

import { measured, type Measured, type Observation } from './evidence.ts';
import { unobservedHouse, type CanalHouse } from './houseRecord.ts';
import { readGable, readHoistBeam } from './heritageText.ts';
import type { HeritageRecord, MassingRecord, RegistryBuilding } from './sources.ts';

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

/**
 * What the massing model can honestly say about this building's eaves and ridge.
 *
 * Measured across the pilot boundary before this was written: 198 of 2,892
 * buildings with both heights (6.8%) report an eaves height *above* their ridge
 * — and every single one is a pitched roof, none of the flat or mixed ones. The
 * inversion runs to 15.8 m at worst, 1.9 m median.
 *
 * That pattern says which of the two numbers is failing. The eaves figure is an
 * order statistic of the measured roof surface, so it cannot exceed the real
 * ridge; the ridge figure is a *modelled* ridge line, and modelling a ridge is
 * exactly what fails on the dormers, stepped gables and rear annexes that make
 * a canal roof complex. So on an inverted pair the eaves value is the reliable
 * one and the ridge is wrong.
 *
 * The record therefore keeps the higher of the two as a lower bound on the
 * ridge — the true ridge is at least the median roof height — and leaves the
 * eaves unobserved rather than shipping a number known to be inconsistent.
 * A silhouette that is slightly too low is a measurement; an eaves line above
 * its own ridge is a lie about the shape of the building.
 */
export type HeightReason =
  /** Both heights present and consistent. */
  | 'ok'
  /** The source carries one or both heights not at all. */
  | 'missing'
  /** Modelled ridge below the measured roof height: ridge kept as a lower bound. */
  | 'inverted'
  /** Modelled ridge at or below the building's own ground level. */
  | 'impossible';

export interface ResolvedHeights {
  eavesM: number | null;
  ridgeM: number | null;
  /** Multiplies the source confidence when the two measures disagree. */
  confidenceFactor: number;
  reason: HeightReason;
  note: string | null;
}

export function resolveHeights(massing: MassingRecord): ResolvedHeights {
  const eaves = aboveGround(massing.eavesHeight, massing.groundLevel);
  const ridge = aboveGround(massing.ridgeHeight, massing.groundLevel);

  if (eaves == null || ridge == null) {
    return {
      eavesM: eaves, ridgeM: ridge, confidenceFactor: 1, reason: 'missing',
      note: eaves == null && ridge == null ? 'massing model carries neither eaves nor ridge height' : null,
    };
  }

  // A ridge at or below the building's own ground level is not a low
  // measurement, it is an impossible one. Prefer the gap: leave both
  // unobserved and queue it.
  if (ridge <= 0) {
    return {
      eavesM: null, ridgeM: null, confidenceFactor: 1, reason: 'impossible',
      note: `modelled ridge is ${ridge.toFixed(2)} m relative to its own ground level, which is impossible; heights left unobserved`,
    };
  }

  if (ridge >= eaves) return { eavesM: eaves, ridgeM: ridge, confidenceFactor: 1, reason: 'ok', note: null };

  return {
    eavesM: null,
    ridgeM: eaves,
    // Halved: the ridge is a lower bound rather than a measurement, and the
    // building belongs in the review queue.
    confidenceFactor: 0.5,
    reason: 'inverted',
    note: `modelled ridge ${ridge.toFixed(2)} m is below the measured roof height ${eaves.toFixed(2)} m; keeping the roof height as a ridge lower bound and leaving eaves unobserved`,
  };
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
}

export interface BuiltRecord {
  house: CanalHouse;
  observations: Observation[];
  /** Why a field that could have been populated was not. Reported, never silent. */
  notes: string[];
  /** How the massing model's two height measures related, for the report. */
  heightReason: HeightReason | null;
}

/**
 * Measured footprint width and depth from the registry footprint.
 *
 * `plotWidthM` is the *short* side of the minimum-area rectangle, which is the
 * façade width and the one dimension every later façade measurement scales
 * from. It is recorded at the registry's own authority rather than hedged.
 */
export function buildRecordFromRecon(input: BuildRecordInput): BuiltRecord {
  const { building, massing, registryReadAt, registry, massingSource } = input;
  const house = unobservedHouse(building.buildingId);
  const observations = reconObservations(building, massing, registryReadAt, registry, massingSource);
  const registryObservation = observations[0];
  const massingObservation = observations[1];
  const notes: string[] = [];

  // Prefer the extent the adapter already measured off the footprint, and fall
  // back to deriving it here only when a source hands over the ring instead.
  // Both routes are the short and long sides of the minimum-area rectangle, so
  // they mean the same thing; recomputing when the answer is already published
  // would just be a second chance to disagree with it.
  const extent = declaredExtent(building) ?? footprintExtent(building);
  if (extent) {
    house.plotWidthM = measured(extent.widthM, 'bag', 0.99, registryObservation);
    house.depthM = measured(extent.depthM, 'bag', 0.99, registryObservation);
  } else {
    notes.push('registry carries neither a footprint extent nor a footprint ring');
  }

  if (!massing || !massingObservation) {
    notes.push('no massing match: heights, storeys and roof form all unobserved');
    return { house, observations, notes, heightReason: null };
  }

  const baseConfidence = massingConfidence(massing);
  const heights = resolveHeights(massing);
  if (heights.note) notes.push(heights.note);
  const heightConfidence = clampConfidence(baseConfidence * heights.confidenceFactor);

  // The survey measures the surface; the massing model fits planes to it.
  // Attributing the heights to `ahn` rather than `3dbag` keeps the instrument
  // visible, and the survey vintage is what dates the observation.
  if (heights.eavesM != null) {
    house.eavesHeightM = measured(round2(heights.eavesM), 'ahn', heightConfidence, massingObservation);
  }
  if (heights.ridgeM != null) {
    house.ridgeHeightM = measured(round2(heights.ridgeM), 'ahn', heightConfidence, massingObservation);
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

  return { house, observations, notes, heightReason: heights.reason };
}

const round2 = (value: number) => Number(value.toFixed(2));

/**
 * The extent the registry adapter already published, if it did.
 *
 * `plotWidthM` is the short side of the footprint's minimum-area rectangle —
 * the façade width, and the one dimension every later façade measurement
 * scales from. Guarded rather than trusted: the sides are only meaningful the
 * right way round, and a swapped pair would silently rescale the grammar.
 */
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
