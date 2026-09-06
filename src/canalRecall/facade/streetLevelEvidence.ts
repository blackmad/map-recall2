/**
 * Applying street-level measurements to a record — at the confidence they have
 * actually earned.
 *
 * This is where the detector's output meets the ledger, and the important thing
 * it does is *withhold*. Until `fieldVerdict` says otherwise these measurements
 * are hypotheses with a provenance, not measurements at auto-accept confidence.
 *
 * The reasons have been rewritten, because the two originally given here were
 * both wrong and a cap resting on wrong reasons is not a cap anyone can lift.
 *
 * Gone: "`check-facade-registration.ts` is red at the bar it sets." It is red,
 * and its red is largely its own — widening its ±3 m search window to ±6 m sends
 * offsets straight to the new edge, because a canal terrace and its plot
 * boundaries both repeat at about 5.7 m and the window, not the photograph,
 * picks which peak wins. It is a diagnostic of local precision, not a gate on
 * identity, and it is no longer cited as one.
 *
 * Gone: "the storey ladder over-counts, 6 storeys for 32 of 56 Keizersgracht
 * buildings." That was true of a scoring function that rewarded rung count and
 * has since been replaced by mean fit. Measured over 342 façades the ladder now
 * runs +0.30 storeys against 3DBAG at MAE 0.76, 88% within one storey.
 *
 * The live reasons, both measured:
 *
 *   - identity is 85%, not 95%. Of the panden a house-number reading can decide,
 *     41 confirm the wall we projected and 7 contradict it. A field measured off
 *     a wall that is the wrong house one time in seven cannot be auto-accepted,
 *     whatever the detector's own precision. It was 76% before the band ranking
 *     started preferring a square-on view over a merely closer one.
 *   - opening detection does not hold still. A 10 cm change in assumed lens
 *     height changes the opening count on 28% of façades, and every storey-count
 *     flip observed followed an opening change. Storeys, bays and openings all
 *     inherit that.
 *
 * The wall-colour sampler's percentile was also tuned by moving it until fewer
 * buildings came out black, which is fitting to an expectation rather than
 * validating against one. That has not been revisited.
 *
 * So everything here caps at {@link UNVALIDATED_CONFIDENCE}. The fields are
 * recorded, carry their observation, and are visible to review — which is what
 * gets them validated — but nothing downstream may treat them as settled.
 */
import { measured, type FacadeSource, type Measured, type Observation } from './evidence.ts';
import type { BrickSpec, CanalHouse } from './houseRecord.ts';
import type { FacadeMeasurement } from './measure.ts';
import { nearestMaterial, wallFamily, type MaterialId } from './materials.ts';
import type { PanoramaView } from './sources.ts';

/**
 * The ceiling for anything the opening detector produced.
 *
 * Chosen to sit below any plausible auto-accept threshold rather than to
 * express a belief: the honest statement is "unvalidated", and a number that
 * cannot be mistaken for a validated one is how that gets said in a schema
 * whose confidences are otherwise calibrated.
 */
export const UNVALIDATED_CONFIDENCE = 0.4;

export interface StreetLevelInput {
  view: PanoramaView;
  /** Perpendicular distance from camera to façade, metres. */
  standoffM: number;
  obliquityDeg: number;
  measurement: FacadeMeasurement;
  /** Median-ish wall colour sampled away from the openings, or null. */
  wallRgb: [number, number, number] | null;
  /** Measured width of the wall the strip covered. */
  wallWidthM: number;
}

export interface StreetLevelEvidence {
  observations: Observation[];
  applied: string[];
  notes: string[];
}

const SOURCE: Exclude<FacadeSource, 'default'> = 'streetlevel-measured';

/**
 * Confidence for one field, before the cap.
 *
 * Obliquity and standoff are the two things that demonstrably degrade a
 * rectified measurement — foreshortening and resolution — so they scale it.
 * Both are properties of this observation, not guesses about the building.
 */
function viewQuality(standoffM: number, obliquityDeg: number): number {
  const squareness = Math.max(0, 1 - obliquityDeg / 25);
  // ~1250 px per radian on an 8000 px equirectangular; 60 px/m is comfortable
  // for a window jamb, 25 px/m is not.
  const resolution = Math.max(0, Math.min(1, (1250 / standoffM - 22) / 60));
  return Math.max(0.15, squareness * 0.6 + resolution * 0.4);
}

export function applyStreetLevelEvidence(
  house: CanalHouse,
  input: StreetLevelInput,
  license: string | null,
): StreetLevelEvidence {
  const { view, standoffM, obliquityDeg, measurement, wallRgb, wallWidthM } = input;
  const applied: string[] = [];
  const notes: string[] = [];

  const observation: Observation = {
    id: `amsterdam-panorama:${view.panoramaId}`,
    pandId: house.pandId,
    kind: 'street-panorama',
    elevation: 'front',
    // The ledger dates observations by day; the panorama API returns a full
    // timestamp, and passing it through fails the audit's date check.
    capturedAt: view.capturedAt.slice(0, 10),
    sourceUrl: view.imageUrl || null,
    license,
  };

  const confidence = Math.min(UNVALIDATED_CONFIDENCE, viewQuality(standoffM, obliquityDeg));
  const set = <T>(field: keyof CanalHouse, value: T, scale = 1) => {
    (house as unknown as Record<string, Measured<T>>)[field as string] =
      measured(value, SOURCE, Math.max(0.05, confidence * scale), observation);
    applied.push(field as string);
  };

  // Storeys and bays: recorded, deliberately not trusted. See the module note.
  if (measurement.storeys.length >= 2) set('storeys', measurement.storeys.length);
  else notes.push('fewer than two storey bands found; storeys left as they were');

  /**
   * Storey heights are withheld, and the reason is a real limitation rather
   * than a threshold.
   *
   * The detector finds *window bands* and measures the spacing between them, so
   * n bands yield n−1 floor-to-floor intervals. The record wants one height per
   * storey. Padding to length would mean inventing the topmost storey's height,
   * which is exactly the fabrication the schema's length check exists to catch —
   * it fired on all 44 measured buildings when this first shipped.
   *
   * The intervals are kept in the block extract for review, where they are
   * useful, and stay out of the record until the detector can bound the top
   * storey against the eaves line.
   */
  if (measurement.storeyHeightsM.length) {
    notes.push(`${measurement.storeyHeightsM.length} floor-to-floor intervals measured (${measurement.storeyHeightsM.map(h => h.toFixed(2)).join(', ')} m); storeyHeights needs one per storey and is withheld`);
  }

  if (measurement.bays >= 1) {
    set('bays', measurement.bays);
    // Offsets are only meaningful if they fall inside the plot they describe.
    const inPlot = measurement.bayOffsetsM.filter(offset => offset >= -0.3 && offset <= wallWidthM + 0.3);
    if (inPlot.length === measurement.bayOffsetsM.length) set('bayOffsetsM', measurement.bayOffsetsM);
    else notes.push(`${measurement.bayOffsetsM.length - inPlot.length} bay offsets fell outside the ${wallWidthM.toFixed(1)} m frontage; offsets withheld`);
  }

  // A door is an opening that reaches the ground. Reported only when exactly
  // one does: two ground openings on a canal house is usually a shopfront plus
  // a door, and choosing between them is not something this detector can do.
  const ground = measurement.groundOpenings;
  if (ground.length === 1) set('doorPositionM', ground[0].xM + ground[0].widthM / 2, 0.8);
  else if (ground.length > 1) notes.push(`${ground.length} openings reach the ground; door position is ambiguous and withheld`);

  if (wallRgb) {
    const family = wallFamily(wallRgb);
    const nearest = nearestMaterial(wallRgb, family);
    const hex = '#' + wallRgb.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
    const spec: BrickSpec = {
      // Bond is not visible at these ranges — a stretcher course is 210 mm and
      // the imagery resolves 20–50 mm per pixel at best. Left unknown rather
      // than assumed from era.
      bond: 'unknown',
      colourHex: hex,
      painted: family === 'paint',
      pointing: 'unknown',
    };
    // A colour that lands far from every named material is a poor fit and says
    // so, rather than being snapped silently to the least-bad neighbour.
    const fitScale = nearest.distance > 45 ? 0.5 : 1;
    if (fitScale < 1) notes.push(`wall colour ${hex} is ${nearest.distance.toFixed(0)} from the nearest ${family} material (${nearest.material.id}); low-confidence fit`);
    set('brick', spec, fitScale);
  }

  return { observations: [observation], applied, notes };
}

/** The named material a record's measured wall colour resolves to, for a renderer. */
export function wallMaterialOf(house: CanalHouse): { id: MaterialId; source: FacadeSource } {
  const brick = house.brick;
  if (brick.source === 'default') return { id: 'brick-red-brown', source: 'default' };
  const rgb = [1, 3, 5].map(i => parseInt(brick.value.colourHex.slice(i, i + 2), 16)) as [number, number, number];
  return { id: nearestMaterial(rgb, wallFamily(rgb)).material.id, source: brick.source };
}
