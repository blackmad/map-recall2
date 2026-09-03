/**
 * How much of a building we are allowed to draw, given how much of it we have
 * actually looked at.
 *
 * `LOD.md` owns the fidelity ladder; this module adds the rule that
 * `AMSTERDAM_FACADE_TWIN.md` puts on top of it:
 *
 * > A building is never promoted above what has actually been observed of it.
 *
 * Two independent things decide a tier, and both are ceilings rather than
 * targets. Evidence says what we are *entitled* to draw. Camera distance says
 * what is *worth* drawing. The tier is the lower of the two, always, and the
 * evidence ceiling is the one that cannot be bought with a faster GPU.
 *
 * The failure this prevents is specific and would otherwise be invisible: a
 * terrace where the four observed houses and the two unobserved ones between
 * them all render with windows, because the assembly engine had a parts library
 * and no reason to stop. The unobserved two would be fiction, in a game whose
 * entire purpose is teaching people what is actually on that canal.
 */

import type { Elevation, Observation } from './evidence.ts';

/**
 * What we have of one elevation of one building.
 *
 * Ordered weakest to strongest; {@link OBSERVATION_TIERS} indexes it, so
 * comparisons are ordinal rather than a chain of string equality.
 */
export type ObservationTier =
  /** No usable observation of this elevation. */
  | 'none'
  /** Roof and massing measured from above; this façade never seen. */
  | 'aerial-only'
  /** Angled or partial view, or a monument text naming gable type and bays. */
  | 'oblique'
  /** A rectified street-level view of this façade. */
  | 'frontal';

export const OBSERVATION_TIERS: readonly ObservationTier[] = ['none', 'aerial-only', 'oblique', 'frontal'];

const OBSERVATION_RANK = new Map(OBSERVATION_TIERS.map((tier, index) => [tier, index]));

export const isAtLeast = (tier: ObservationTier, minimum: ObservationTier): boolean =>
  (OBSERVATION_RANK.get(tier) ?? 0) >= (OBSERVATION_RANK.get(minimum) ?? 0);

/**
 * The rendering tiers, weakest first. These extend `LOD.md`'s ladder rather
 * than forking a parallel one.
 */
export type FidelityTier =
  /** Footprint extrusion, measured height, measured roof colour. Complete coverage. */
  | 'lod1'
  /** 3DBAG reconstructed walls and roof planes. Correct silhouette, no openings. */
  | 'lod2.2'
  /** The above plus measured roof and wall colour and material. Still no openings. */
  | 'lod2.2-measured'
  /** This building's own measured openings, gable, cornice, pui, materials and lean. */
  | 'lod3'
  /** An authored model for a hero building, with its own attribution record. */
  | 'signature';

export const FIDELITY_TIERS: readonly FidelityTier[] = ['lod1', 'lod2.2', 'lod2.2-measured', 'lod3', 'signature'];

const FIDELITY_RANK = new Map(FIDELITY_TIERS.map((tier, index) => [tier, index]));

const weakest = (a: FidelityTier, b: FidelityTier): FidelityTier =>
  (FIDELITY_RANK.get(a) ?? 0) <= (FIDELITY_RANK.get(b) ?? 0) ? a : b;

/**
 * Classify what a set of observations amounts to for one elevation.
 *
 * Only observations *of this pand* count. Passing a neighbour's observations in
 * would be the party-wall failure, so callers should filter by `pandId` first;
 * `auditFields` catches it afterwards if they did not.
 *
 * A monument record counts as `oblique` rather than `frontal` even though its
 * text can be very precise, because it is a second independent measurement of
 * *some* fields, not a view of the whole elevation. It can tell you the gable
 * type; it cannot tell you where the door is.
 */
export function classifyObservationTier(
  observations: readonly Observation[],
  elevation: Elevation,
): ObservationTier {
  let best: ObservationTier = 'none';
  for (const observation of observations) {
    const tier = tierOfObservation(observation, elevation);
    if (isAtLeast(tier, best)) best = tier;
  }
  return best;
}

function tierOfObservation(observation: Observation, elevation: Elevation): ObservationTier {
  // A monument record describes the whole building, so it informs any
  // elevation the reviewer reads it against — but never above `oblique`.
  if (observation.kind === 'monument-record') return 'oblique';
  // A human who looked at this building settles it for the elevation reviewed.
  if (observation.kind === 'human-review') return observation.elevation === elevation ? 'frontal' : 'none';
  if (observation.elevation !== elevation) {
    // Nadir imagery and registry records measure the roof and the massing
    // beneath it whatever elevation you ask about, and measure no façade at
    // all. Both are recorded against the `roof` elevation, so without this
    // the whole boundary classifies as NONE and falls to LoD1 — which is how
    // this was caught: a real run over 3,025 buildings reported
    // `none → lod1` for every one of them, including the 2,894 whose massing
    // had just been measured.
    return observation.kind === 'ortho-nadir' || observation.kind === 'registry-record' ? 'aerial-only' : 'none';
  }
  switch (observation.kind) {
    case 'street-panorama':
    case 'archive-photo':
      return 'frontal';
    case 'oblique-aerial':
      return 'oblique';
    case 'ortho-nadir':
      return 'aerial-only';
    case 'registry-record':
      // BAG/3DBAG measure footprint, height and roof form. Never a façade.
      return 'aerial-only';
    default:
      return 'none';
  }
}

/**
 * The highest tier this much evidence entitles a building to.
 *
 * `oblique` reaching LoD3 is deliberate and is qualified elsewhere: the doc
 * allows "LoD3 for what is stated or visible; conservative elsewhere; every
 * unobserved field marked default". The per-field defaults do that
 * qualification, so the tier does not also have to.
 */
export function evidenceCeiling(tier: ObservationTier, hasMeasuredAppearance: boolean): FidelityTier {
  switch (tier) {
    case 'frontal':
    case 'oblique':
      return 'lod3';
    case 'aerial-only':
      return hasMeasuredAppearance ? 'lod2.2-measured' : 'lod2.2';
    case 'none':
      return 'lod1';
  }
}

/**
 * Distance bands, in metres from the camera.
 *
 * Asymmetric on purpose, for the same reason `photorealGate.ts` is: riding a
 * canal holds a building at a near-constant distance, which parks it on a
 * single threshold and flips it every few frames. Releasing further out than
 * it promotes costs one band of extra detail and removes the churn.
 */
export const LOD3_PROMOTE_M = 140;
export const LOD3_RELEASE_M = 190;
export const LOD2_PROMOTE_M = 650;
export const LOD2_RELEASE_M = 800;

export interface TierInput {
  /** What has been observed of the elevation facing the camera. */
  observation: ObservationTier;
  /** Whether measured roof and wall appearance exists for this pand. */
  hasMeasuredAppearance: boolean;
  /** Whether an authored hero model has loaded and is ready to draw. */
  signatureModelReady: boolean;
  /** Distance from the camera to the building, metres. */
  distanceM: number;
  /** The tier this building is drawing right now, which sets which threshold applies. */
  current: FidelityTier | null;
  /** Whether this pand is inside the pilot boundary at all. */
  insideBoundary: boolean;
}

/**
 * Resolve the one tier a building renders at.
 *
 * "One representation per building at a time, resolved per `pand_id`, never
 * three overlapping geometries fighting for the same pixels" —
 * `BUILDING_RENDERER_DESIGN.md`. This returns exactly one tier; the caller
 * draws that and nothing else.
 */
export function resolveFidelityTier(input: TierInput): FidelityTier {
  const { observation, hasMeasuredAppearance, signatureModelReady, insideBoundary } = input;

  // A hero model that has finished loading is what the player should see. It is
  // authored from its own evidence, so it is not subject to the façade ceiling —
  // but it is still subject to distance, below.
  const ceiling = signatureModelReady ? 'signature' : evidenceCeiling(observation, hasMeasuredAppearance);

  // Outside the pilot boundary the 3DBAG baseline keeps serving every building,
  // exactly as it does today. The boundary changes fidelity, never coverage.
  const evidence = insideBoundary ? ceiling : weakest(ceiling, hasMeasuredAppearance ? 'lod2.2-measured' : 'lod2.2');

  return weakest(evidence, distanceCeiling(input));
}

function distanceCeiling({ distanceM, current }: TierInput): FidelityTier {
  const holdingDetail = current === 'lod3' || current === 'signature';
  const holdingMassing = holdingDetail || current === 'lod2.2' || current === 'lod2.2-measured';

  if (distanceM <= (holdingDetail ? LOD3_RELEASE_M : LOD3_PROMOTE_M)) return 'signature';
  if (distanceM <= (holdingMassing ? LOD2_RELEASE_M : LOD2_PROMOTE_M)) return 'lod2.2-measured';
  return 'lod1';
}

/**
 * Whether moving between two tiers changes the building's outline.
 *
 * The walkthrough test requires leaving the pilot boundary "without a visible
 * seam, a popped silhouette or a duplicated building". LoD2.2, LoD2.2-measured
 * and LoD3 share one silhouette — LoD3 adds openings and ornament *within* it —
 * so those transitions are free. Anything crossing LoD1 changes the roof from a
 * flat extrusion to a reconstructed one, and that pops.
 */
export const silhouetteChanges = (from: FidelityTier, to: FidelityTier): boolean =>
  from !== to && (from === 'lod1' || to === 'lod1' || from === 'signature' || to === 'signature');

/** Tiers that may draw window and door openings. The whole point of the ladder. */
export const drawsOpenings = (tier: FidelityTier): boolean => tier === 'lod3' || tier === 'signature';
