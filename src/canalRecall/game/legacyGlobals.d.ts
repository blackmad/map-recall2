// Globals the legacy Canal Recall page defines before the typed subsystem
// bundles load. Declaring them keeps the bundles free of imports for values
// that are already on the page — `constants.js` is one shared script, and
// re-bundling its numbers per subsystem would let two copies drift apart.
//
// This file is types only. If a constant belongs to one subsystem's logic
// rather than to the page, move it into that subsystem's module and test it
// there instead of adding it here.

declare const CANVAS_W: number;
declare const CANVAS_H: number;
declare const PIXELS_PER_METER: number;

/** Seconds a neighborhood postcard stays up, and how long after the start of a
 *  route the first one may fire. */
declare const NEIGHBORHOOD_NOTICE_SECONDS: number;
declare const NEIGHBORHOOD_NOTICE_GRACE: number;
/** px — start fetching a landmark photo while it is still ahead. */
declare const LANDMARK_IMAGE_PREFETCH_RADIUS: number;
/** Seconds the keyboard hint stays on screen; defined in `game.js`. */
declare const CONTROLS_HINT_DURATION: number;

// ---- Recall timings and thresholds ----

/** px — a bridge gate reaches this far either side of a span's midpoint. */
declare const BRIDGE_GATE_HALF_WIDTH: number;
/** px — keep named bridges labelled while nearby, and hide a label closer than
 *  the clearance to the vehicle so it never covers what is being steered. */
declare const BRIDGE_LABEL_RANGE: number;
declare const BRIDGE_LABEL_CLEARANCE: number;
/** Seconds between bridge questions, and px within which a traversal still
 *  counts as a given crossing. */
declare const BRIDGE_QUIZ_COOLDOWN: number;
declare const CROSSING_MATCH_RANGE: number;
/** Seconds on a new name before its question opens; shorter for a re-test. */
declare const QUIZ_CANDIDATE_DELAY: number;
declare const QUIZ_RETEST_DELAY: number;
/** ms the answer card stays up. A correction lingers because it carries a name
 *  the player has just proved they do not know. */
declare const ANSWER_HOLD_CORRECT: number;
declare const ANSWER_HOLD_WRONG: number;

/** The chip at the top of a recall prompt: what kind of thing the answer is. */
declare const QUIZ_SUBJECTS: Record<import('./modes').QuizSubject, {
  kind: string;
  icon: string;
  label: string;
  placeholder: string;
}>;

declare const DIFFICULTY_SCORE_MULTIPLIERS:
  Record<import('./modes').RouteDifficulty, number>;

declare const GAME_VERSION: string;
/** Frozen enum from `game.js`. */
declare const GameState: {
  MENU: number; MAP_SELECT: number; LOADING: number;
  RACING: number; FINISHED: number; PAUSED: number;
};
/** Seconds the zoom percentage lingers after a change. */
declare const ZOOM_BADGE_DURATION: number;
declare const BANDIT_QUOTES: Array<{ text: string; character: string }>;

/** Wraps `text` to `maxWidth` using the context's current font, at most
 *  `maxLines` lines. From `utils.js`. */
declare function wrapText(
  ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number,
): string[];

/** Canvas helper from `utils.js`; traces the path without filling it. */
declare function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
): void;

/** The typed bundles already shipped as IIFE globals. */
declare const CanalRecallNeighborhood: typeof import('../neighborhoodState');
declare const CanalRecallAnswerPath: typeof import('../answerPath');
declare const CanalRecallBridges: typeof import('../bridgeCrossings');

interface Window {
  CanalRecallCards: typeof import('../noticeCards');
  CanalRecallUi: typeof import('../gameUi');
  CanalRecallOverlay?: typeof import('../overlay/mount');
  CanalRecallTransit?: typeof import('../transit/browser');
  CanalRecallPreferences?: typeof import('./preferences');
  /** Subsystem classes queued for installation onto `Game.prototype`. */
  CanalRecallGameModules?: Array<new () => unknown>;
}
