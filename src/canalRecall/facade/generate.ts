/**
 * Generating a plausible canal house from the grammar.
 *
 * This is the *rendering vocabulary*, and the distinction the brief draws is
 * the whole reason it can exist: the grammar tells you how to draw a klokgevel
 * once you know this house has one; it must never tell you that this house has
 * one. So everything here is explicitly generated, never measured, and the
 * record it produces says so in every field.
 *
 * What it is for:
 *
 *   - a spike, to see whether the grammar is rich enough to produce something
 *     that reads as Amsterdam rather than as a spreadsheet with windows;
 *   - filling the gaps in a *partially* measured façade — a bay the detector
 *     lost to a tree, on a building whose other bays were measured;
 *   - the parts library the Blender lanes (BUILD-1…4) will need, expressed as
 *     geometry rules before anything is modelled.
 *
 * What it is not for: shipping as the twin. A building nobody has looked at
 * gets no façade, and nothing generated here may be written into a record as
 * anything but `generated`.
 */
import { STOREY_HEIGHT_M, WINDOW_M } from './grammar.ts';
import type { GableType } from './houseRecord.ts';

export interface GenerateInput {
  /** Measured. The one dimension known exactly. */
  plotWidthM: number;
  /** Measured, above this building's own ground. */
  eavesHeightM: number;
  ridgeHeightM: number;
  /** Measured or declared; generated from the eaves height when absent. */
  storeys: number | null;
  /** Stated by the register for about a fifth of the pilot; null otherwise. */
  gable: GableType | null;
  /** Routes attention only — never supplies a value. */
  constructionYear: number | null;
  roofForm: 'pitched' | 'flat' | 'mixed' | 'unknown';
}

export interface GeneratedOpening {
  xM: number; yM: number; widthM: number; heightM: number;
  kind: 'window' | 'door' | 'shopfront' | 'attic';
}

export interface GeneratedFacade {
  /** Always 'generated'. Present so this can never be mistaken for a record. */
  provenance: 'generated';
  storeys: number;
  /** Floor-to-floor heights, ground upward. Diminishing, per the grammar. */
  storeyHeightsM: number[];
  bays: number;
  bayCentresM: number[];
  openings: GeneratedOpening[];
  /** Gable outline as [alongM, heightM] from the left of the plot, at the eaves and above. */
  gableProfile: Array<[number, number]>;
  gable: GableType;
  gableIsAssumed: boolean;
  hoistBeamAtM: number | null;
}

/**
 * Storey heights, diminishing upward.
 *
 * Documented for this fabric and visible in any canal elevation: floor heights
 * fall toward the top, because upper rooms were storage and the daylight was
 * taken high against the ceiling. The ratio is chosen so the sequence sums to
 * the measured eaves height exactly — the total is a measurement and must not
 * drift to satisfy a rule about its parts.
 */
export function storeyHeights(eavesHeightM: number, storeys: number): number[] {
  const RATIO = 0.93;
  let unit = 0;
  for (let i = 0; i < storeys; i++) unit += RATIO ** i;
  const ground = eavesHeightM / unit;
  return Array.from({ length: storeys }, (_, i) => Number((ground * RATIO ** i).toFixed(2)));
}

/**
 * How many window bays fit across a frontage.
 *
 * **The pitch here is disputed and the dispute is deliberately unresolved.**
 *
 * This function assumes about 1.9 m per bay, which is what I reasoned a 5.7 m
 * front with two windows and its party walls ought to produce. The detector,
 * measuring 1,375 real façades, disagrees: it reports a median of 2 bays across
 * the 5.5–6.5 m band, which is a pitch nearer 2.9 m. It is not obviously wrong
 * either — it scales properly with frontage (p50 of 1, 1, 2, 2, 2, 3 as width
 * runs 4 m to 15 m) and the openings it finds are the right size, 0.90 m wide
 * and 2.33 m tall at the median, both inside the range for a *schuifraam*.
 *
 * So one of two things is true: the detector merges adjacent bays, or my 1.9 m
 * is too tight. I am not entitled to decide that by preferring my own number —
 * the last three constants I reasoned my way to were each wrong by about a
 * third — and the detector is not entitled to decide it either, being
 * unvalidated.
 *
 * The review harness asks a person how many bays each façade has. That settles
 * it, and until it does this stays as written with the disagreement recorded.
 * Clamped at five because past that the plot is a warehouse or a merged pair.
 */
export function bayCount(plotWidthM: number): number {
  return Math.max(1, Math.min(5, Math.round(plotWidthM / 1.9)));
}

/** What the detector's own readings imply, for comparison in review. */
export const MEASURED_BAY_PITCH_M = 2.9;
export const ASSUMED_BAY_PITCH_M = 1.9;

/** Bay centres, evenly spaced with a margin to the party walls. */
export function bayCentres(plotWidthM: number, bays: number): number[] {
  const margin = Math.min(0.75, plotWidthM * 0.13);
  const usable = plotWidthM - margin * 2;
  if (bays === 1) return [plotWidthM / 2];
  return Array.from({ length: bays }, (_, i) => Number((margin + (usable * i) / (bays - 1)).toFixed(2)));
}

/**
 * The gable outline, in metres along the plot and metres above the eaves.
 *
 * One function per type, because the types are genuinely different objects and
 * a single parameterised curve would smear them into each other — which is the
 * failure that makes generated cities look generated.
 */
export function gableProfile(kind: GableType, widthM: number, riseM: number): Array<[number, number]> {
  const w = widthM, r = Math.max(0.6, riseM);
  const point = (x: number, y: number): [number, number] => [Number(x.toFixed(2)), Number(y.toFixed(2))];

  switch (kind) {
    case 'trap': {
      // A staircase. Five steps a side is the common Amsterdam count; each tread
      // is as deep as the riser is tall, which is what makes them read as steps.
      const steps = Math.max(3, Math.min(7, Math.round(w / 0.9)));
      const tread = w / (2 * steps + 1), riser = r / steps;
      const points: Array<[number, number]> = [point(0, 0)];
      for (let i = 0; i < steps; i++) {
        points.push(point(i * tread, (i + 1) * riser), point((i + 1) * tread, (i + 1) * riser));
      }
      points.push(point(w - steps * tread, r), point(w - steps * tread, r));
      for (let i = steps - 1; i >= 0; i--) {
        points.push(point(w - (i + 1) * tread, (i + 1) * riser), point(w - i * tread, (i + 1) * riser));
      }
      points.push(point(w, 0));
      return points;
    }
    case 'hals': {
      // A raised rectangular neck with claw-pieces either side. The neck is
      // roughly half the width; the shoulders it stands on are the claws.
      const neck = w * 0.46, side = (w - neck) / 2;
      return [
        point(0, 0), point(side * 0.55, r * 0.28), point(side, r * 0.52), point(side, r),
        point(side + neck, r), point(side + neck, r * 0.52), point(w - side * 0.55, r * 0.28), point(w, 0),
      ];
    }
    case 'klok': {
      // A bell: flanks bow outward, then in, to a flat or pedimented top.
      const top = w * 0.34, side = (w - top) / 2;
      const points: Array<[number, number]> = [point(0, 0)];
      const STEPS = 7;
      for (let i = 1; i <= STEPS; i++) {
        const t = i / STEPS;
        // Convex low, concave high — the profile that gives a bell its waist.
        points.push(point(side * (t ** 0.62), r * (t ** 1.55)));
      }
      points.push(point(side + top, r));
      for (let i = STEPS; i >= 1; i--) {
        const t = i / STEPS;
        points.push(point(w - side * (t ** 0.62), r * (t ** 1.55)));
      }
      points.push(point(w, 0));
      return points;
    }
    case 'tuit': {
      // A pointed gable with a narrow spout at the apex.
      const spout = Math.min(0.9, w * 0.16);
      return [
        point(0, 0), point(w / 2 - spout / 2, r * 0.82), point(w / 2 - spout / 2, r),
        point(w / 2 + spout / 2, r), point(w / 2 + spout / 2, r * 0.82), point(w, 0),
      ];
    }
    case 'punt':
      return [point(0, 0), point(w / 2, r), point(w, 0)];
    case 'verhoogde-hals': {
      const neck = w * 0.4, side = (w - neck) / 2;
      return [
        point(0, 0), point(side * 0.5, r * 0.2), point(side, r * 0.4), point(side, r),
        point(side + neck, r), point(side + neck, r * 0.4), point(w - side * 0.5, r * 0.2), point(w, 0),
      ];
    }
    case 'lijst':
    default:
      // A straight cornice. The roof hides behind it, so the profile is flat.
      return [point(0, 0), point(0, r * 0.5), point(w, r * 0.5), point(w, 0)];
  }
}

/**
 * Which gable an unobserved house would have, if one had to guess.
 *
 * Returned only with `gableIsAssumed: true`, and it exists so a *spike* can
 * draw a street. Note what it is not allowed to become: the register states a
 * gable for 695 buildings, and the correct behaviour for the other 2,330 is to
 * draw no gable at all. This function is for the generator, never the extract.
 *
 * The mapping is the documented chronology — step gables give way to neck and
 * bell gables through the 17th century, and the straight cornice takes over in
 * the 18th — and the measured distribution in the register agrees: of 1,099
 * described monuments naming a type, 42% lijstgevel, 17% hals, 7% klok, 3%
 * punt, 2% trap.
 */
export function assumedGable(constructionYear: number | null): GableType {
  if (constructionYear === null) return 'lijst';
  if (constructionYear < 1660) return 'trap';
  if (constructionYear < 1700) return 'hals';
  if (constructionYear < 1750) return 'klok';
  return 'lijst';
}

export function generateFacade(input: GenerateInput): GeneratedFacade {
  const { plotWidthM: w, eavesHeightM, ridgeHeightM, constructionYear } = input;

  const storeys = input.storeys ?? Math.max(2, Math.round(eavesHeightM / STOREY_HEIGHT_M.median));
  const heights = storeyHeights(eavesHeightM, storeys);
  const bays = bayCount(w);
  const centres = bayCentres(w, bays);

  const openings: GeneratedOpening[] = [];
  let floor = 0;
  for (let storey = 0; storey < storeys; storey++) {
    const height = heights[storey];
    // Windows shrink with their storey, which is what the diminishing rule is
    // visible as: the top floor's openings are noticeably smaller.
    const windowH = Math.min(WINDOW_M.maxHeight, Math.max(WINDOW_M.minHeight, height * 0.62));
    const windowW = Math.min(WINDOW_M.maxWidth, Math.max(WINDOW_M.minWidth, Math.min(1.55, (w / bays) * 0.62)));
    // Sill high enough to clear a floor, and rising a little on upper storeys.
    const sill = floor + Math.min(1.15, height * 0.28);

    for (let bay = 0; bay < bays; bay++) {
      const isGroundDoor = storey === 0 && bays > 1 && bay === (bays > 2 ? 0 : bays - 1);
      if (isGroundDoor) {
        const doorH = Math.min(2.6, height * 0.78);
        openings.push({ xM: Number((centres[bay] - 0.55).toFixed(2)), yM: Number(floor.toFixed(2)), widthM: 1.1, heightM: Number(doorH.toFixed(2)), kind: 'door' });
      } else {
        openings.push({
          xM: Number((centres[bay] - windowW / 2).toFixed(2)), yM: Number(sill.toFixed(2)),
          widthM: Number(windowW.toFixed(2)), heightM: Number(windowH.toFixed(2)), kind: 'window',
        });
      }
    }
    floor += height;
  }

  const gable = input.gable ?? assumedGable(constructionYear);
  const rise = Math.max(0.6, ridgeHeightM - eavesHeightM);
  return {
    provenance: 'generated',
    storeys,
    storeyHeightsM: heights,
    bays,
    bayCentresM: centres,
    openings,
    gable,
    gableIsAssumed: input.gable === null,
    gableProfile: gableProfile(gable, w, rise),
    // A hoisting beam sits at the gable apex on a house with a loft, which is
    // most of them. Centred, because it hangs over the door below.
    hoistBeamAtM: input.roofForm === 'flat' ? null : Number((w / 2).toFixed(2)),
  };
}
