// Where every HUD card goes, for both the desktop 16:9 space and a phone.
//
// This used to be two things: hand-placed constants inside `hud.js` for the top
// band (`roundRect(ctx, 15, 15, 310, ...)`) and `bottomHudLayout` for the
// bottom band. The top band's constants assumed a 1280 px-wide screen, so on a
// 390 px phone the destination card started at x = -70 and the minimap hung
// 200 px below the bottom edge.
//
// Making the whole HUD one function of the viewport is what lets the portrait
// layout be a *different arrangement* rather than the same arrangement scaled
// down: two 310 px cards stacked in the corner become three full-width rows,
// the trip readout merges into the score row, and the bottom of the screen is
// reserved for the d-pad instead of being fought over.
//
// `bottomHudLayout` still exists, delegating here, so the regression suite that
// pins the desktop bottom band keeps proving the desktop layout has not moved.

import type { Viewport } from './viewport.ts';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from './viewport.ts';
import { dpadLayout, type DpadLayout } from './touchControls.ts';

export type Rect = { x: number; y: number; width: number; height: number };

export type HudLayout = {
  /** Score / streak, and on a phone the speed and odometer too. */
  recall: Rect;
  /** The street or waterway you are on, plus the neighbourhood. */
  location: Rect;
  destination: Rect;
  /** Speed + odometer. Folded into `recall` on a phone; see `tripInRecall`. */
  trip: Rect;
  postcard: Rect;
  landmark: Rect;
  minimap: Rect;
  zoomBadge: Rect;
  controlsHint: Rect;
  dpad: DpadLayout | null;
  /** True when the trip readout is drawn inside the recall row, not separately. */
  tripInRecall: boolean;
  mode: Viewport['mode'];
};

export type HudLayoutInput = {
  viewport: Viewport;
  tripWidth: number;
  postcardVisible?: boolean;
  landmarkWidth?: number;
  landmarkHeight?: number;
  zoomVisible?: boolean;
  controlsVisible?: boolean;
  /** The recall card grows to fit a feedback line. */
  feedbackVisible?: boolean;
  neighborhoodVisible?: boolean;
  minimapVisible?: boolean;
};

const MARGIN = 12;
const GAP = 8;

// Compact row heights, measured against the type sizes hud.js draws.
const COMPACT_RECALL_H = 40;
const COMPACT_RECALL_FEEDBACK_H = 58;
const COMPACT_LOCATION_H = 46;
const COMPACT_LOCATION_PLAIN_H = 34;
const COMPACT_DESTINATION_H = 36;
const COMPACT_MINIMAP_W = 124;
const COMPACT_MINIMAP_H = 96;
const COMPACT_ZOOM_H = 22;

/** The room a landscape phone leaves the trivia card, right of the d-pad. */
function compactLandscapeCardWidth(
  viewport: Viewport,
  dpad: DpadLayout | null,
): number {
  const padRight = dpad ? dpad.bounds.x + dpad.bounds.width + GAP : 0;
  return Math.max(160, viewport.width - MARGIN * 2 - padRight);
}

/** The width the trivia card must be measured at. Callers measure with this,
 *  then pass the resulting height back in: measuring at 480 and shrinking the
 *  rectangle afterwards clipped the text instead of rewrapping it. */
export function landmarkCardWidth(viewport: Viewport, desired = 480): number {
  if (viewport.mode !== 'compact') return desired;
  if (viewport.orientation === 'portrait') {
    return Math.min(desired, viewport.width - MARGIN * 2);
  }
  return Math.min(desired, compactLandscapeCardWidth(viewport, dpadLayout(viewport)));
}

/** Cards shrink to the room they have rather than overlapping the controls. */
function clampHeight(wanted: number, available: number): number {
  return Math.max(0, Math.min(wanted, Math.floor(available)));
}

export function hudLayout({
  viewport,
  tripWidth,
  postcardVisible = false,
  landmarkWidth = 480,
  landmarkHeight = 130,
  zoomVisible = false,
  controlsVisible = false,
  feedbackVisible = false,
  neighborhoodVisible = false,
  minimapVisible = true,
}: HudLayoutInput): HudLayout {
  const width = viewport.width;
  const height = viewport.height;

  if (viewport.mode === 'compact') {
    const dpad = dpadLayout(viewport);
    const controlsTop = dpad ? dpad.bounds.y : height - viewport.safeBottom;

    if (viewport.orientation === 'portrait') {
      const rowWidth = width - MARGIN * 2;
      // Three full-width rows beat two corner cards: on a narrow screen a
      // 310 px card is most of the width anyway, so the corner buys nothing and
      // costs a column of unusable space beside it.
      let cursor = viewport.safeTop + MARGIN;
      const recall = {
        x: MARGIN, y: cursor, width: rowWidth,
        height: feedbackVisible ? COMPACT_RECALL_FEEDBACK_H : COMPACT_RECALL_H,
      };
      cursor += recall.height + GAP;
      const location = {
        x: MARGIN, y: cursor, width: rowWidth,
        height: neighborhoodVisible ? COMPACT_LOCATION_H : COMPACT_LOCATION_PLAIN_H,
      };
      cursor += location.height + GAP;
      const destination = { x: MARGIN, y: cursor, width: rowWidth, height: COMPACT_DESTINATION_H };
      const topBottom = destination.y + destination.height;

      // The bottom stack is built upwards from the d-pad, so the controls are
      // always reachable and everything else yields to them.
      const minimapBudget = minimapVisible ? COMPACT_MINIMAP_H + GAP : 0;
      const cardHeight = clampHeight(landmarkHeight, controlsTop - GAP - (topBottom + GAP) - minimapBudget);
      const cardWidth = Math.min(landmarkWidth, rowWidth);
      const landmark = { x: MARGIN, y: controlsTop - GAP - cardHeight, width: cardWidth, height: cardHeight };
      const minimap = {
        x: MARGIN, y: landmark.y - GAP - COMPACT_MINIMAP_H,
        width: COMPACT_MINIMAP_W, height: COMPACT_MINIMAP_H,
      };
      const postcard = { x: MARGIN, y: landmark.y, width: cardWidth, height: cardHeight };
      const zoomBadge = {
        x: Math.round(width / 2 - 35),
        y: (minimapVisible ? minimap.y : landmark.y) - GAP - COMPACT_ZOOM_H,
        width: 70, height: COMPACT_ZOOM_H,
      };
      return {
        recall, location, destination, trip: recall, postcard, landmark, minimap, zoomBadge,
        controlsHint: { x: Math.round(width / 2 - 177), y: zoomBadge.y, width: 354, height: 12 },
        dpad, tripInRecall: true, mode: viewport.mode,
      };
    }

    // Compact landscape: 844×390 has width to spare and almost no height, so
    // the rows go back into the corners and the d-pad takes the bottom-left,
    // where a hand holding the phone already is.
    const columnWidth = Math.min(300, Math.round((width - MARGIN * 3) / 2));
    const recall = {
      x: MARGIN, y: viewport.safeTop + MARGIN, width: columnWidth,
      height: feedbackVisible ? COMPACT_RECALL_FEEDBACK_H : COMPACT_RECALL_H,
    };
    const location = {
      x: MARGIN, y: recall.y + recall.height + GAP, width: columnWidth,
      height: neighborhoodVisible ? COMPACT_LOCATION_H : COMPACT_LOCATION_PLAIN_H,
    };
    const destination = {
      x: width - MARGIN - columnWidth, y: viewport.safeTop + MARGIN,
      width: columnWidth, height: COMPACT_DESTINATION_H,
    };
    const cardWidth = Math.min(landmarkWidth, compactLandscapeCardWidth(viewport, dpad));
    const cardTop = destination.y + destination.height + GAP + (minimapVisible ? COMPACT_MINIMAP_H + GAP : 0);
    const cardHeight = clampHeight(landmarkHeight, height - viewport.safeBottom - MARGIN - cardTop);
    const landmark = {
      x: width - MARGIN - cardWidth,
      y: height - viewport.safeBottom - MARGIN - cardHeight,
      width: cardWidth, height: cardHeight,
    };
    const minimap = {
      x: width - MARGIN - COMPACT_MINIMAP_W, y: landmark.y - GAP - COMPACT_MINIMAP_H,
      width: COMPACT_MINIMAP_W, height: COMPACT_MINIMAP_H,
    };
    const postcard = { x: landmark.x, y: landmark.y, width: cardWidth, height: cardHeight };
    const zoomBadge = {
      x: Math.round(width / 2 - 35), y: landmark.y - GAP - COMPACT_ZOOM_H,
      width: 70, height: COMPACT_ZOOM_H,
    };
    return {
      recall, location, destination, trip: recall, postcard, landmark, minimap, zoomBadge,
      controlsHint: { x: Math.round(width / 2 - 177), y: zoomBadge.y, width: 354, height: 12 },
      dpad, tripInRecall: true, mode: viewport.mode,
    };
  }

  // ---- Desktop: the proven 16:9 arrangement, unchanged. --------------------
  const recall = { x: 15, y: 15, width: 310, height: feedbackVisible ? 62 : 43 };
  const location = { x: 15, y: 84, width: 310, height: neighborhoodVisible ? 55 : 38 };
  const destination = { x: width - 350, y: 15, width: 335, height: 48 };
  const trip = { x: width - tripWidth - 16, y: height - 98, width: tripWidth, height: 26 };
  const postcard = { x: width - 410, y: trip.y - 118, width: 390, height: 104 };
  const minimap = { x: 15, y: height - 215, width: 260, height: 200 };
  const zoomBadge = { x: width / 2 - 35, y: height - 35, width: 70, height: 22 };
  const controlsHint = {
    x: width / 2 - 177,
    y: zoomVisible ? zoomBadge.y - 26 : height - 32,
    width: 354,
    height: 12,
  };
  const centeredLandmarkX = width / 2 - landmarkWidth / 2;
  const footerTop = controlsVisible ? controlsHint.y : zoomVisible ? zoomBadge.y : height;
  const landmark = {
    x: postcardVisible ? Math.min(centeredLandmarkX, postcard.x - 14 - landmarkWidth) : centeredLandmarkX,
    y: Math.min(height - landmarkHeight - 30, footerTop - 14 - landmarkHeight),
    width: landmarkWidth,
    height: landmarkHeight,
  };
  return {
    recall, location, destination, trip, postcard, landmark, minimap,
    zoomBadge, controlsHint, dpad: null, tripInRecall: false, mode: viewport.mode,
  };
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x
    && a.y < b.y + b.height && a.y + a.height > b.y;
}

/** A desktop viewport, for callers that only care about the 16:9 space. */
export function designViewport(): Viewport {
  return {
    width: DESIGN_WIDTH, height: DESIGN_HEIGHT,
    cssWidth: DESIGN_WIDTH, cssHeight: DESIGN_HEIGHT,
    scale: 1, backingScale: 1,
    mode: 'desktop', orientation: 'landscape', touch: false,
    safeTop: 0, safeBottom: 0,
  };
}

export type BottomHudLayout = {
  trip: Rect; postcard: Rect; landmark: Rect;
  minimap: Rect; zoomBadge: Rect; controlsHint: Rect;
};

/** Backwards-compatible desktop bottom band. Kept so the regression suite that
 *  pins these rectangles keeps proving the desktop layout has not moved. */
export function bottomHudLayout({
  canvasWidth = DESIGN_WIDTH, canvasHeight = DESIGN_HEIGHT, tripWidth,
  postcardVisible = false, landmarkWidth = 480, landmarkHeight = 130,
  zoomVisible = false, controlsVisible = false,
}: {
  canvasWidth?: number; canvasHeight?: number; tripWidth: number;
  postcardVisible?: boolean; landmarkWidth?: number; landmarkHeight?: number;
  zoomVisible?: boolean; controlsVisible?: boolean;
}): BottomHudLayout {
  const viewport = { ...designViewport(), width: canvasWidth, height: canvasHeight, cssWidth: canvasWidth, cssHeight: canvasHeight };
  const layout = hudLayout({
    viewport, tripWidth, postcardVisible, landmarkWidth, landmarkHeight, zoomVisible, controlsVisible,
  });
  const { trip, postcard, landmark, minimap, zoomBadge, controlsHint } = layout;
  return { trip, postcard, landmark, minimap, zoomBadge, controlsHint };
}
