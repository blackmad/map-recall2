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

/** The typed bundles already shipped as IIFE globals. */
declare const CanalRecallNeighborhood: typeof import('../neighborhoodState');
declare const CanalRecallAnswerPath: typeof import('../answerPath');

interface Window {
  CanalRecallCards: typeof import('../noticeCards');
  CanalRecallBottomHud: typeof import('../bottomHudLayout');
  /** Subsystem classes queued for installation onto `Game.prototype`. */
  CanalRecallGameModules?: Array<new () => unknown>;
}
