/**
 * Applying street-level measurements to a record — at the confidence they have
 * actually earned.
 *
 * This is where the detector's output meets the ledger, and the important thing
 * it does is *withhold*. `check-facade-registration.ts` is still red at the bar
 * it sets, and no field produced by the opening detector has been checked
 * against a hand-labelled building. Until `fieldVerdict` says otherwise, these
 * measurements are hypotheses with a provenance, not measurements at
 * auto-accept confidence.
 *
 * Two independent reasons to distrust them right now, both measured rather than
 * suspected:
 *
 *   - the storey ladder over-counts. Across Keizersgracht 100–180 it returns 6
 *     storeys for 32 of 56 buildings, where 3DBAG's own median for the pilot is
 *     4–5 and the street is mostly three or four plus an attic. A spurious rung
 *     at a cornice or a basement light well produces exactly that.
 *   - the wall-colour sampler was tuned by moving its percentile until fewer
 *     buildings came out black. That is fitting to an expectation about the
 *     answer, not validating against one.
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
