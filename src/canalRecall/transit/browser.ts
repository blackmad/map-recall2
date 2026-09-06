/**
 * Browser adapter for transit corridor load + quiz helpers.
 * Bundled as `CanalRecallTransit`.
 */
export {
  TRANSIT_THIN_SLICE_REFS,
  TRANSIT_DRIVEABLE_MODES,
  adaptTransitNetwork,
  displayStopName,
  lineDisplayName,
  transitRouteAnchors,
  type TransitPlayLoad,
  type TransitStopFeature,
  type TransitLineFeature,
  type TransitWay,
  type TransitRouteAnchor,
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

export {
  intermediateStopIds,
  isStopAheadTowardFinish,
  resolveRouteStopId,
  stopIdsInTravelOrder,
} from './routeStops.ts';

export {
  transitPlaqueRouteName,
  type TransitPlaqueInput,
  type TransitPlaqueResult,
} from './plaque.ts';

export {
  buildCorridorStreetIndex,
  distanceToPath,
  nearestCorridorStreet,
  type CorridorStreetFeature,
  type CorridorStreetIndex,
  type NearestCorridorStreet,
} from './corridorStreets.ts';

export {
  deriveTransfersFromNetwork,
  otherLinesAtStop,
  planTransitConnection,
  preferSiblingDistractors,
  resolveActiveLine,
  siblingLineNames,
  transferTargetLines,
  currentTransitLeg,
  canAdvanceTransitLeg,
  advanceTransitLeg,
  pickTeachableTransitPair,
  lineQuizDistractorsAtHub,
  type TransitConnectionPlan,
  type TransitTransferEdge,
  type TransitTransfers,
} from './transfers.ts';

/** Metres — stop dwell / approach radius for the thin-slice stop quiz. */
export const TRANSIT_STOP_QUIZ_RADIUS_M = 45;

/** Minimum seconds between stop quizzes on the same route. */
export const TRANSIT_STOP_QUIZ_COOLDOWN_S = 18;

/** After answering a line question, wait this long before asking again. */
export const TRANSIT_LINE_QUIZ_COOLDOWN_S = 45;

/** Metres — how close the tram must be to a curated street centreline to ask. */
export const TRANSIT_STREET_QUIZ_RADIUS_M = 35;

/** Minimum seconds between corridor street quizzes. */
export const TRANSIT_STREET_QUIZ_COOLDOWN_S = 22;

/** Metres — landmarks farther than this from the planned route stay quiet. */
export const TRANSIT_LANDMARK_ROUTE_RADIUS_M = 120;

/** Minimum seconds between transfer-hub line quizzes. */
export const TRANSIT_TRANSFER_QUIZ_COOLDOWN_S = 40;
