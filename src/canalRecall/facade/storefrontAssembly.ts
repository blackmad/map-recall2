/** Ground-floor retail lane: assemble extracted facade features into a
 * storefront (display window(s) + entrance + fascia/sign + awning) instead of a
 * generic window grid.
 *
 * Pure and deterministic. Bounds are `[left, top, right, bottom]` in image
 * pixels with y increasing downward, matching the post-normalization output of
 * `scripts/city-appearance/fidelity/extraction-contract.mjs` (permille
 * coordinates are scaled to pixels before this runs). Image height is derived
 * from the features themselves, so the caller does not need image dimensions.
 *
 * A storefront is defined by its display glazing: a residential front with a
 * door but no wide shop window is deliberately not a storefront.
 */

export type FacadeFeatureKind = 'door' | 'window' | 'material' | 'awning' | 'fascia';
export type AwningState = 'extended' | 'retracted' | 'absent' | 'unknown';

export interface FacadeFeature {
  id: string;
  kind: FacadeFeatureKind;
  bounds: [number, number, number, number];
  state?: string;
  text?: string;
  physicalSignId?: string;
  paired?: boolean;
  colour?: string;
}

export interface StorefrontAssembly {
  entrance: FacadeFeature | null;
  displayWindows: FacadeFeature[];
  fascia: FacadeFeature | null;
  awnings: FacadeFeature[];
  awningState: AwningState;
  signText: string | null;
  groundBand: [number, number];
  confidence: 'high' | 'low';
}

export interface StorefrontOptions {
  groundBandTopFraction?: number;
}

const AWNING_STATES: readonly AwningState[] = ['extended', 'retracted', 'absent', 'unknown'];
const DEFAULT_GROUND_BAND_TOP_FRACTION = 0.6;

const hasFiniteBounds = (feature: FacadeFeature): boolean =>
  Array.isArray(feature.bounds) &&
  feature.bounds.length === 4 &&
  feature.bounds.every(Number.isFinite);

const widthOf = (feature: FacadeFeature): number => feature.bounds[2] - feature.bounds[0];
const heightOf = (feature: FacadeFeature): number => feature.bounds[3] - feature.bounds[1];
const areaOf = (feature: FacadeFeature): number =>
  Math.max(0, widthOf(feature)) * Math.max(0, heightOf(feature));
const centreY = (feature: FacadeFeature): number => (feature.bounds[1] + feature.bounds[3]) / 2;

/** Largest area first, then leftmost, then id, so ties are stable. */
const byAreaDesc = (a: FacadeFeature, b: FacadeFeature): number =>
  areaOf(b) - areaOf(a) ||
  a.bounds[0] - b.bounds[0] ||
  (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

const horizontallyOverlaps = (a: FacadeFeature, b: FacadeFeature): boolean =>
  a.bounds[0] < b.bounds[2] && b.bounds[0] < a.bounds[2];

/** A transom/fanlight sits directly above the entrance and must not be read as
 * a shop display window. This is the only window relation that uses the door. */
const sitsAboveEntrance = (opening: FacadeFeature, entrance: FacadeFeature | null): boolean =>
  entrance !== null &&
  horizontallyOverlaps(opening, entrance) &&
  centreY(opening) < entrance.bounds[1];

/** Most common observed state, first-seen breaking ties; unknown when absent. */
function mostCommonAwningState(awnings: readonly FacadeFeature[]): AwningState {
  const counts = new Map<AwningState, number>();
  for (const awning of awnings) {
    const state: AwningState =
      typeof awning.state === 'string' && (AWNING_STATES as readonly string[]).includes(awning.state)
        ? (awning.state as AwningState)
        : 'unknown';
    counts.set(state, (counts.get(state) ?? 0) + 1);
  }
  let best: AwningState = 'unknown';
  let bestCount = 0;
  for (const [state, count] of counts) {
    if (count > bestCount) {
      best = state;
      bestCount = count;
    }
  }
  return bestCount === 0 ? 'unknown' : best;
}

/**
 * Group ground-floor features into a storefront assembly, or `null` when the
 * crop is not retail (no display window).
 *
 * `groundBandTopFraction` is the fraction of the derived image height above
 * which features are considered upper-floor (default 0.6, i.e. the bottom 40%).
 * A feature is eligible when its vertical extent reaches the band, not when its
 * centre does: a real ground crop frames a tall door or shop window so that its
 * centre sits well above 60% of the crop, and a centre test silently dropped it
 * (the 21 Sep review's missing-door / missing-storefront group). A fascia or
 * awning is a shopfront component by kind and is never band-filtered. An
 * upper-floor opening that stays wholly above the band is still excluded, so it
 * can never become the ground entrance.
 */
export function assembleStorefront(
  features: readonly FacadeFeature[],
  options: StorefrontOptions = {},
): StorefrontAssembly | null {
  const valid = features.filter(hasFiniteBounds);
  if (valid.length === 0) return null;

  const imageHeight = valid.reduce((max, feature) => Math.max(max, feature.bounds[3]), 0);
  if (!(imageHeight > 0)) return null;

  const requested = options.groundBandTopFraction ?? DEFAULT_GROUND_BAND_TOP_FRACTION;
  const fraction = Number.isFinite(requested)
    ? Math.min(1, Math.max(0, requested))
    : DEFAULT_GROUND_BAND_TOP_FRACTION;
  const bandTop = imageHeight * fraction;
  // Reaching the band is enough: `imageHeight` is the lowest feature bottom, so
  // `bounds[3] >= bandTop` is exactly "some part of the feature is at or below
  // the ground cut". A fascia/awning is a shopfront component regardless of how
  // high the crop frames it.
  const inBand = (feature: FacadeFeature): boolean =>
    feature.kind === 'fascia' || feature.kind === 'awning' || feature.bounds[3] >= bandTop;

  // A paired door still counts as one entrance; the largest member represents
  // the pair, and it is never split into two entrances.
  const entrance = valid
    .filter((feature) => feature.kind === 'door' && inBand(feature))
    .sort(byAreaDesc)[0] ?? null;

  const displayWindows = valid
    .filter(
      (feature) =>
        feature.kind === 'window' &&
        inBand(feature) &&
        widthOf(feature) > heightOf(feature) &&
        !sitsAboveEntrance(feature, entrance),
    )
    .sort((a, b) => a.bounds[0] - b.bounds[0]);

  const fascia = valid
    .filter((feature) => feature.kind === 'fascia' && inBand(feature))
    .sort(byAreaDesc)[0] ?? null;

  const signText =
    fascia !== null && typeof fascia.text === 'string' && fascia.text.trim().length > 0
      ? fascia.text
      : null;

  const awnings = valid.filter((feature) => feature.kind === 'awning');
  const awningState = mostCommonAwningState(awnings);

  // Display glazing is what makes a frontage a storefront.
  if (displayWindows.length === 0) return null;

  const confidence: StorefrontAssembly['confidence'] =
    entrance !== null && fascia !== null ? 'high' : 'low';

  return {
    entrance,
    displayWindows,
    fascia,
    awnings,
    awningState,
    signText,
    groundBand: [bandTop, imageHeight],
    confidence,
  };
}
