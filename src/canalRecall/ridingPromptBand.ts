// Where the riding question sits.
//
// The riding prompt is an HTML card (the same `#canal-card`, restyled as a
// strip), but its place is the HUD's: the slot the trivia card uses at the
// bottom of the screen, above the d-pad on a phone, shifted sideways to clear
// the postcard. Asking `hudLayout` for that slot — rather than hand-placing the
// card in CSS — is what lets `check-bottom-hud-layout.ts` prove it never lands
// on the trip readout, the overview, the postcard or the controls, and keeps it
// clear of the driving corridor in the middle of the screen.
//
// Sizes are in CSS pixels (that is what the card is styled in) and converted
// to canvas units for the layout.

import { hudLayout, landmarkCardWidth, type Rect } from './hudLayout.ts';
import type { Viewport } from './viewport.ts';

/** CSS px — widest the strip gets. */
export const RIDING_PROMPT_MAX_WIDTH = 560;
/** CSS px — below this the four options wrap to two rows of two. */
export const RIDING_PROMPT_NARROW_WIDTH = 480;
/** CSS px — one row of options under a one-line question. */
export const RIDING_PROMPT_HEIGHT = 92;
/** CSS px — two rows of options under a one-line question. */
export const RIDING_PROMPT_NARROW_HEIGHT = 128;

export interface RidingPromptSize {
  /** Canvas units. */
  width: number;
  height: number;
  /** CSS px. */
  cssWidth: number;
  cssHeight: number;
  /** Options per row: 4 on a wide strip, 2 on a narrow one. */
  columns: 2 | 4;
}

export function ridingPromptSize(viewport: Viewport): RidingPromptSize {
  const scale = viewport.scale || 1;
  const cssWidth = Math.min(RIDING_PROMPT_MAX_WIDTH, landmarkCardWidth(viewport, RIDING_PROMPT_MAX_WIDTH / scale) * scale);
  const columns = cssWidth < RIDING_PROMPT_NARROW_WIDTH ? 2 : 4;
  const cssHeight = columns === 4 ? RIDING_PROMPT_HEIGHT : RIDING_PROMPT_NARROW_HEIGHT;
  return { width: cssWidth / scale, height: cssHeight / scale, cssWidth, cssHeight, columns };
}

export interface RidingPromptBandInput {
  viewport: Viewport;
  tripWidth?: number;
  postcardVisible?: boolean;
  zoomVisible?: boolean;
  controlsVisible?: boolean;
  feedbackVisible?: boolean;
  neighborhoodVisible?: boolean;
  minimapVisible?: boolean;
}

/**
 * Whether the neighbourhood postcard gives way while a riding question is up.
 * On a desktop the postcard keeps its right-hand corner and the strip shifts
 * left to clear it. On a phone the postcard and the strip want the same row
 * above the d-pad, and a postcard stacked over a strip would climb into the
 * driving corridor, so the postcard waits (the one-card rule already hides it
 * while a question is open; this states it for the layout).
 */
export function postcardYieldsToRidingPrompt(viewport: Viewport): boolean {
  return viewport.mode === 'compact';
}

/** The riding prompt's rectangle in canvas units. */
export function ridingPromptRect(input: RidingPromptBandInput): Rect {
  const size = ridingPromptSize(input.viewport);
  return hudLayout({
    ...input,
    postcardVisible: !!input.postcardVisible && !postcardYieldsToRidingPrompt(input.viewport),
    tripWidth: input.tripWidth ?? 180,
    landmarkWidth: size.width,
    landmarkHeight: size.height,
  }).landmark;
}

/** The card's CSS placement for a canvas-unit rectangle. */
export function ridingPromptCss(rect: Rect, viewport: Viewport): { left: number; bottom: number; width: number } {
  const scale = viewport.scale || 1;
  return {
    left: Math.round(rect.x * scale),
    bottom: Math.round((viewport.height - (rect.y + rect.height)) * scale),
    width: Math.round(rect.width * scale),
  };
}
