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
// The map fills the window; the chrome does not. On an ultrawide (or a wide
// compact landscape) cards used to pin to the far edges with a dead sea of
// map between them. `hudBand` caps the chrome at the proven design width and
// centres that band, so the layout stays dense while the city stays full-bleed.
//
// `bottomHudLayout` still exists, delegating here, so the regression suite that
// pins the desktop bottom band keeps proving the desktop layout has not moved.

import type { Viewport } from './viewport.ts';
import {
  DESIGN_HEIGHT,
  DESIGN_WIDTH,
  HUD_MAX_WIDTH_COMPACT,
  HUD_MAX_WIDTH_DESKTOP,
} from './viewport.ts';
import { dpadLayout, type DpadLayout } from './touchControls.ts';

export type Rect = { x: number; y: number; width: number; height: number };

export type HudBand = {
  /** Left edge of the chrome band in canvas coordinates. */
  x: number;
  width: number;
  height: number;
};

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
  /** The centred band the chrome was laid into. */
  band: HudBand;
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
  /** The postcard's own height. It shares the trivia card's slot on a phone
   *  but is a different card, and sizing its rectangle from `landmarkHeight`
   *  made the rectangle taller than the card actually drawn in it. */
  postcardHeight?: number;
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

/** The centred strip the chrome occupies. Narrower than the canvas on wide
 *  windows so cards stay next to the driving corridor instead of the bezels. */
export function hudBand(viewport: Viewport): HudBand {
  const maxWidth = viewport.mode === 'compact' ? HUD_MAX_WIDTH_COMPACT : HUD_MAX_WIDTH_DESKTOP;
  const width = Math.min(viewport.width, maxWidth);
  return {
    x: Math.round((viewport.width - width) / 2),
    width,
    height: viewport.height,
  };
}

function offsetRect(rect: Rect, dx: number): Rect {
  return dx === 0 ? rect : { ...rect, x: rect.x + dx };
}

/** The room a landscape phone leaves the trivia card, right of the d-pad. */
function compactLandscapeCardWidth(
  band: HudBand,
  dpad: DpadLayout | null,
): number {
  const padRight = dpad ? (dpad.bounds.x - band.x) + dpad.bounds.width + GAP : 0;
  return Math.max(160, band.width - MARGIN * 2 - padRight);
}

/** The width the trivia card must be measured at. Callers measure with this,
 *  then pass the resulting height back in: measuring at 480 and shrinking the
 *  rectangle afterwards clipped the text instead of rewrapping it. */
export function landmarkCardWidth(viewport: Viewport, desired = 480): number {
  if (viewport.mode !== 'compact') return desired;
  const band = hudBand(viewport);
  if (viewport.orientation === 'portrait') {
    return Math.min(desired, band.width - MARGIN * 2);
  }
  return Math.min(desired, compactLandscapeCardWidth(band, dpadLayout(viewport, band)));
}

/** The width the neighbourhood postcard must be measured at. */
export function postcardWidth(viewport: Viewport, desired = 390): number {
  if (viewport.mode !== 'compact') return desired;
  const band = hudBand(viewport);
  if (viewport.orientation === 'portrait') return Math.min(desired, band.width - MARGIN * 2);
  return Math.min(desired, compactLandscapeCardWidth(band, dpadLayout(viewport, band)));
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
  postcardHeight = 104,
  neighborhoodVisible = false,
  minimapVisible = true,
}: HudLayoutInput): HudLayout {
  const band = hudBand(viewport);
  const width = band.width;
  const height = band.height;
  const left = band.x;

  if (viewport.mode === 'compact') {
    const dpad = dpadLayout(viewport, band);
    const controlsTop = dpad ? dpad.bounds.y : height - viewport.safeBottom;

    if (viewport.orientation === 'portrait') {
      const rowWidth = width - MARGIN * 2;
      // Three full-width rows beat two corner cards: on a narrow screen a
      // 310 px card is most of the width anyway, so the corner buys nothing and
      // costs a column of unusable space beside it.
      let cursor = viewport.safeTop + MARGIN;
      const recall = offsetRect({
        x: MARGIN, y: cursor, width: rowWidth,
        height: feedbackVisible ? COMPACT_RECALL_FEEDBACK_H : COMPACT_RECALL_H,
      }, left);
      cursor += recall.height + GAP;
      const location = offsetRect({
        x: MARGIN, y: cursor, width: rowWidth,
        height: neighborhoodVisible ? COMPACT_LOCATION_H : COMPACT_LOCATION_PLAIN_H,
      }, left);
      cursor += location.height + GAP;
      const destination = offsetRect(
        { x: MARGIN, y: cursor, width: rowWidth, height: COMPACT_DESTINATION_H },
        left,
      );
      const topBottom = destination.y + destination.height;

      // The bottom stack is built upwards from the d-pad, so the controls are
      // always reachable and everything else yields to them.
      const minimapBudget = minimapVisible ? COMPACT_MINIMAP_H + GAP : 0;
      const cardHeight = clampHeight(landmarkHeight, controlsTop - GAP - (topBottom + GAP) - minimapBudget);
      const cardWidth = Math.min(landmarkWidth, rowWidth);
      const landmark = offsetRect(
        { x: MARGIN, y: controlsTop - GAP - cardHeight, width: cardWidth, height: cardHeight },
        left,
      );
      const minimap = offsetRect({
        x: MARGIN, y: landmark.y - GAP - COMPACT_MINIMAP_H,
        width: COMPACT_MINIMAP_W, height: COMPACT_MINIMAP_H,
      }, left);
      const postcardH = clampHeight(postcardHeight, controlsTop - GAP - (topBottom + GAP));
      const postcard = offsetRect({
        x: MARGIN, y: controlsTop - GAP - postcardH,
        width: Math.min(postcardWidth(viewport), rowWidth), height: postcardH,
      }, left);
      const zoomBadge = {
        x: Math.round(left + width / 2 - 35),
        y: (minimapVisible ? minimap.y : landmark.y) - GAP - COMPACT_ZOOM_H,
        width: 70, height: COMPACT_ZOOM_H,
      };
      return {
        recall, location, destination, trip: recall, postcard, landmark, minimap, zoomBadge,
        controlsHint: { x: Math.round(left + width / 2 - 177), y: zoomBadge.y, width: 354, height: 12 },
        dpad, tripInRecall: true, mode: viewport.mode, band,
      };
    }

    // Compact landscape: 844×390 has width to spare and almost no height, so
    // the rows go back into the corners and the d-pad takes the bottom-left,
    // where a hand holding the phone already is. On a wider window the band is
    // capped, so "corners" means the band's corners — not the monitor bezels.
    const columnWidth = Math.min(300, Math.round((width - MARGIN * 3) / 2));
    const recall = offsetRect({
      x: MARGIN, y: viewport.safeTop + MARGIN, width: columnWidth,
      height: feedbackVisible ? COMPACT_RECALL_FEEDBACK_H : COMPACT_RECALL_H,
    }, left);
    const location = offsetRect({
      x: MARGIN, y: recall.y + recall.height + GAP, width: columnWidth,
      height: neighborhoodVisible ? COMPACT_LOCATION_H : COMPACT_LOCATION_PLAIN_H,
    }, left);
    const destination = offsetRect({
      x: width - MARGIN - columnWidth, y: viewport.safeTop + MARGIN,
      width: columnWidth, height: COMPACT_DESTINATION_H,
    }, left);
    const cardWidth = Math.min(landmarkWidth, compactLandscapeCardWidth(band, dpad));
    const cardTop = destination.y + destination.height + GAP + (minimapVisible ? COMPACT_MINIMAP_H + GAP : 0);
    const cardHeight = clampHeight(landmarkHeight, height - viewport.safeBottom - MARGIN - cardTop);
    const landmark = offsetRect({
      x: width - MARGIN - cardWidth,
      y: height - viewport.safeBottom - MARGIN - cardHeight,
      width: cardWidth, height: cardHeight,
    }, left);
    const minimap = offsetRect({
      x: width - MARGIN - COMPACT_MINIMAP_W, y: landmark.y - GAP - COMPACT_MINIMAP_H,
      width: COMPACT_MINIMAP_W, height: COMPACT_MINIMAP_H,
    }, left);
    const postcardH = clampHeight(postcardHeight, height - viewport.safeBottom - MARGIN - cardTop);
    const postcardW = Math.min(postcardWidth(viewport), cardWidth);
    const postcard = offsetRect({
      x: width - MARGIN - postcardW,
      y: height - viewport.safeBottom - MARGIN - postcardH,
      width: postcardW, height: postcardH,
    }, left);
    const zoomBadge = {
      x: Math.round(left + width / 2 - 35), y: landmark.y - GAP - COMPACT_ZOOM_H,
      width: 70, height: COMPACT_ZOOM_H,
    };
    return {
      recall, location, destination, trip: recall, postcard, landmark, minimap, zoomBadge,
      controlsHint: { x: Math.round(left + width / 2 - 177), y: zoomBadge.y, width: 354, height: 12 },
      dpad, tripInRecall: true, mode: viewport.mode, band,
    };
  }

  // ---- Desktop: corner cards inside the centred design-width band. --------
  const recall = offsetRect(
    { x: 15, y: 15, width: 310, height: feedbackVisible ? 62 : 43 },
    left,
  );
  const location = offsetRect(
    { x: 15, y: 84, width: 310, height: neighborhoodVisible ? 55 : 38 },
    left,
  );
  const destination = offsetRect(
    { x: width - 350, y: 15, width: 335, height: 48 },
    left,
  );
  const trip = offsetRect(
    { x: width - tripWidth - 16, y: height - 98, width: tripWidth, height: 26 },
    left,
  );
  const postcard = offsetRect(
    { x: width - 410, y: trip.y - 118, width: 390, height: 104 },
    left,
  );
  const minimap = offsetRect(
    { x: 15, y: height - 215, width: 260, height: 200 },
    left,
  );
  const zoomBadge = {
    x: left + width / 2 - 35, y: height - 35, width: 70, height: 22,
  };
  const controlsHint = {
    x: left + width / 2 - 177,
    y: zoomVisible ? zoomBadge.y - 26 : height - 32,
    width: 354,
    height: 12,
  };
  const centeredLandmarkX = left + width / 2 - landmarkWidth / 2;
  const footerTop = controlsVisible ? controlsHint.y : zoomVisible ? zoomBadge.y : height;
  const landmark = {
    x: postcardVisible ? Math.min(centeredLandmarkX, postcard.x - 14 - landmarkWidth) : centeredLandmarkX,
    y: Math.min(height - landmarkHeight - 30, footerTop - 14 - landmarkHeight),
    width: landmarkWidth,
    height: landmarkHeight,
  };
  return {
    recall, location, destination, trip, postcard, landmark, minimap,
    zoomBadge, controlsHint, dpad: null, tripInRecall: false, mode: viewport.mode, band,
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
