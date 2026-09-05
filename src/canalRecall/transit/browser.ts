/**
 * Browser adapter for transit corridor load + quiz helpers.
 * Bundled as `CanalRecallTransit`.
 */
export {
  TRANSIT_THIN_SLICE_REFS,
  adaptTransitNetwork,
  displayStopName,
  lineDisplayName,
  transitRouteAnchors,
  type TransitPlayLoad,
  type TransitStopFeature,
  type TransitLineFeature,
  type TransitWay,
} from './segments.ts';

export {
  getTransitLineKey,
  getTransitStopKey,
  asLineRecallFeature,
  asStopRecallFeature,
} from './identity.ts';

export {
  TRANSIT_MODES,
  type TransitMode,
  type TransitNetwork,
} from './network.ts';

/** Metres — stop dwell / approach radius for the thin-slice stop quiz. */
export const TRANSIT_STOP_QUIZ_RADIUS_M = 45;

/** Minimum seconds between stop quizzes on the same route. */
export const TRANSIT_STOP_QUIZ_COOLDOWN_S = 18;

/** After answering a line question, wait this long before asking again. */
export const TRANSIT_LINE_QUIZ_COOLDOWN_S = 45;
